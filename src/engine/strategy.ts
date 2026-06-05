import { differenceInCalendarDays } from 'date-fns'
import type {
  ContentAsset,
  ContentPillar,
  GapNote,
  Platform,
  ScheduledPost,
  StrategyAnalysis,
} from '../types'

const FACE_PILLARS = ['people']
const PROOF_PILLARS = ['proof']
const EVENT_PILLARS = ['events']

function isFaceAsset(post: ScheduledPost, assets: ContentAsset[]): boolean {
  if (FACE_PILLARS.includes(post.pillarId || '')) return true
  return post.assetIds.some((id) => {
    const a = assets.find((x) => x.id === id)
    return a && (a.people?.trim() || a.analysis?.contentType === 'team' || a.fileType === 'video')
  })
}

export function analyzeStrategy(
  posts: ScheduledPost[],
  pillars: ContentPillar[],
  assets: ContentAsset[],
): StrategyAnalysis {
  const active = pillars.filter((p) => p.active)
  if (posts.length === 0) {
    return {
      dateGenerated: new Date().toISOString(),
      score: 0,
      pillarBalance: active.map((p) => ({ pillarId: p.id, actual: 0, target: p.targetShare })),
      platformBalance: [],
      facesFrequency: 0,
      ctaFrequency: 0,
      proofFrequency: 0,
      recommendations: [
        { severity: 'warn', message: 'No posts planned yet. Upload content and hit “Generate 90-day plan” to start the story.' },
      ],
    }
  }
  const total = posts.length || 1

  // Pillar balance
  const pillarCounts = new Map<string, number>()
  for (const p of posts) if (p.pillarId) pillarCounts.set(p.pillarId, (pillarCounts.get(p.pillarId) || 0) + 1)
  const pillarBalance = active.map((p) => ({
    pillarId: p.id,
    actual: (pillarCounts.get(p.id) || 0) / total,
    target: p.targetShare,
  }))

  // Platform balance
  const platCounts = new Map<Platform, number>()
  for (const p of posts) for (const pl of p.platforms) platCounts.set(pl, (platCounts.get(pl) || 0) + 1)
  const platformBalance = Array.from(platCounts.entries()).map(([platform, count]) => ({ platform, count }))

  const faces = posts.filter((p) => isFaceAsset(p, assets)).length
  const ctas = posts.filter((p) => p.cta?.trim()).length
  const proof = posts.filter((p) => PROOF_PILLARS.includes(p.pillarId || '')).length

  const facesFrequency = faces / total
  const ctaFrequency = ctas / total
  const proofFrequency = proof / total

  const recommendations = buildGapNotes(posts, pillarBalance, assets, {
    facesFrequency,
    proofFrequency,
    ctaFrequency,
  })

  // Score: start 100, subtract penalties from each alert/warn.
  let score = 100
  for (const r of recommendations) {
    if (r.severity === 'alert') score -= 8
    else if (r.severity === 'warn') score -= 4
  }
  // imbalance penalty
  for (const pb of pillarBalance) score -= Math.min(10, Math.abs(pb.actual - pb.target) * 30)
  score = Math.max(0, Math.min(100, Math.round(score)))

  return {
    dateGenerated: new Date().toISOString(),
    score,
    pillarBalance,
    platformBalance,
    facesFrequency,
    ctaFrequency,
    proofFrequency,
    recommendations,
  }
}

function buildGapNotes(
  posts: ScheduledPost[],
  pillarBalance: { pillarId: string; actual: number; target: number }[],
  assets: ContentAsset[],
  freq: { facesFrequency: number; proofFrequency: number; ctaFrequency: number },
): GapNote[] {
  const notes: GapNote[] = []
  const sorted = [...posts].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))

  // Too many event promos in a row
  let run = 0
  for (let i = 0; i < sorted.length; i++) {
    if (EVENT_PILLARS.includes(sorted[i].pillarId || '')) {
      run++
      if (run >= 3) {
        notes.push({
          severity: 'alert',
          message: 'You have several event promos in a row. Add a people or proof post between them so it does not feel like nonstop asks.',
        })
        run = 0
      }
    } else run = 0
  }

  // Event cluster within a short window
  const eventDates = sorted.filter((p) => EVENT_PILLARS.includes(p.pillarId || '')).map((p) => p.scheduledDate)
  for (let i = 0; i + 3 < eventDates.length; i++) {
    if (differenceInCalendarDays(new Date(eventDates[i + 3]), new Date(eventDates[i])) <= 8) {
      notes.push({
        severity: 'warn',
        message: 'There are 4 event posts inside 8 days. Slot a people or proof post between them to keep pacing human.',
      })
      break
    }
  }

  // Faces frequency
  if (freq.facesFrequency < 0.2)
    notes.push({
      severity: 'alert',
      message: 'Your plan is light on faces and video. Add more people content before asking agents to register for anything.',
    })

  // Proof frequency / dry spell
  if (freq.proofFrequency < 0.1)
    notes.push({
      severity: 'warn',
      message: 'This 90-day plan is light on proof and testimonials. Work in a few wins so the asks have credibility behind them.',
    })

  // Three-week proof dry spell
  const weeks = new Map<number, ScheduledPost[]>()
  sorted.forEach((p, idx) => {
    const wk = Math.floor(idx / 3)
    if (!weeks.has(wk)) weeks.set(wk, [])
    weeks.get(wk)!.push(p)
  })
  let dry = 0
  for (const [wk, ps] of Array.from(weeks.entries()).sort((a, b) => a[0] - b[0])) {
    const hasProof = ps.some((p) => PROOF_PILLARS.includes(p.pillarId || ''))
    dry = hasProof ? 0 : dry + 1
    if (dry >= 3) {
      notes.push({
        severity: 'warn',
        message: `No testimonial or proof point for about three weeks (around week ${wk + 1}). Drop one in to rebuild trust.`,
        weekIndex: wk,
      })
      dry = 0
    }
  }

  // Weeks with no direct CTA
  for (const [wk, ps] of weeks.entries()) {
    const hasCta = ps.some((p) => p.cta?.trim())
    if (!hasCta)
      notes.push({ severity: 'warn', message: `Week ${wk + 1} has no direct CTA. Give agents one clear next step.`, weekIndex: wk })
  }

  // Pillar imbalance
  for (const pb of pillarBalance) {
    if (pb.actual - pb.target > 0.12)
      notes.push({ severity: 'warn', message: `You are heavy on one pillar (${Math.round(pb.actual * 100)}% vs target ${Math.round(pb.target * 100)}%). Spread it out.` })
  }

  // Format variety — too many graphics
  const graphicShare =
    posts.filter((p) => p.assetIds.some((id) => assets.find((a) => a.id === id)?.analysis?.contentType === 'graphic')).length /
    (posts.length || 1)
  if (graphicShare > 0.4)
    notes.push({ severity: 'warn', message: 'Your calendar leans heavy on graphics. Add more faces and video to keep it human.' })

  // Warm-up before campaign RSVP
  const campaignPosts = sorted.filter((p) => p.campaignId)
  if (campaignPosts.length) {
    const firstIsAsk = /register|rsvp|save your spot|sign up/i.test(campaignPosts[0].caption + campaignPosts[0].cta)
    if (firstIsAsk)
      notes.push({ severity: 'warn', message: 'A campaign opens on an RSVP push. Add a warm-up or tease post before the ask.' })
  }

  if (notes.length === 0)
    notes.push({ severity: 'good', message: 'Balanced pacing across pillars, faces, proof, and CTAs. This reads like a story, not a feed.' })

  return notes
}

// Repurposing suggestions for a single asset.
export function repurposeIdeas(asset: ContentAsset): string[] {
  const t = asset.analysis?.contentType
  if (asset.fileType === 'video')
    return [
      'Cut the strongest 20 seconds into a Reel.',
      'Post the same cut to TikTok with a hook caption.',
      'Drop a Facebook Reel version for the older agent audience.',
      'Pull one line into an email teaser linking the full clip.',
      'Screenshot a frame for a feed post or story.',
    ]
  switch (t) {
    case 'testimonial':
      return ['Make it a feed quote-graphic.', 'Reshare to a story with a poll.', 'Use the quote as an email pull-quote.']
    case 'event':
      return ['Turn event photos into a recap carousel.', 'Use the best shot as a single feed lead.', 'Send a post-event recap email.', 'Cut a 15s highlight Reel from clips.']
    case 'team':
      return ['Use as a People of Valmer post.', 'Repurpose as a culture/recruitment post.', 'Add to a “meet the team” carousel.']
    case 'community':
      return ['Build a community carousel.', 'Tag the partner in a story.', 'Feature in a monthly community email.']
    default:
      return ['Pair with related shots into a carousel.', 'Add a story version with text overlay.', 'Reference it in an email roundup.']
  }
}
