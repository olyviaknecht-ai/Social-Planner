import { addDays, format, nextMonday, startOfWeek } from 'date-fns'
import type {
  ContentAsset,
  ContentPillar,
  PersonMemory,
  ScheduledPost,
  StorylineWeek,
} from '../types'
import { generateCaption } from './caption'
import { strengthOf } from '../lib/insights'

// Strongest assets get picked first; weaker ones stay as options in the library.
const STRENGTH_PRIORITY: Record<string, number> = { hero: 0, support: 1, 'needs-context': 2, story: 3, archive: 9 }

export const PHASES = [
  { phase: 1, name: 'Familiarity', weeks: [0, 1, 2], goal: 'Introduce who the brand is — faces, warmth, personality, connection.' },
  { phase: 2, name: 'Trust', weeks: [3, 4, 5], goal: 'Show proof, competence, and how the brand makes things easier.' },
  { phase: 3, name: 'Value', weeks: [6, 7, 8], goal: 'Give real value — tips, tools, resources, education.' },
  { phase: 4, name: 'Action', weeks: [9, 10, 11], goal: 'Drive action — events, offers, sign-ups, deeper engagement.' },
]

// Which of a brand's pillars fit each phase, matched by keywords in the title.
const PHASE_KEYWORDS: Record<number, string[]> = {
  1: ['people', 'face', 'team', 'behind', 'community', 'local', 'culture', 'story'],
  2: ['proof', 'review', 'testimonial', 'closing', 'trust', 'result', 'win'],
  3: ['education', 'tip', 'value', 'tool', 'growth', 'service', 'how', 'resource', 'innovation'],
  4: ['event', 'offer', 'launch', 'promo', 'invite', 'sale', 'experience', 'register'],
}
const PHASE_VERB: Record<number, string> = { 1: 'Introduce', 2: 'Build trust with', 3: 'Show your value:', 4: 'Drive action with' }

// Build the 90-day arc. When brand pillars are given, weekly themes are generated
// from THIS brand's pillars so the storyline reflects the brand, not a fixed script.
export function buildStoryline(start?: Date, pillars?: ContentPillar[]): StorylineWeek[] {
  const base = start ? startOfWeek(start, { weekStartsOn: 1 }) : nextMonday(new Date())
  const usable = (pillars || []).filter((p) => p.active !== false)

  return Array.from({ length: 12 }).map((_, i) => {
    const phase = PHASES.find((p) => p.weeks.includes(i))!
    const weekStart = addDays(base, i * 7)
    let theme = `${phase.name}: week ${i + 1}`
    let goal = phase.goal
    let recommended: string[] = []

    if (usable.length) {
      const kws = PHASE_KEYWORDS[phase.phase]
      const bucket = usable.filter((p) => kws.some((k) => p.title.toLowerCase().includes(k)))
      const pool = bucket.length ? bucket : usable
      const pillar = pool[i % pool.length]
      theme = `${PHASE_VERB[phase.phase]} ${pillar.title}`
      goal = pillar.goal || phase.goal
      recommended = [pillar.id]
    }

    return {
      id: `week-${i}`,
      index: i,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
      phase: phase.phase,
      theme,
      goal,
      recommendedPillarIds: recommended,
      notes: '',
    }
  })
}

const POST_DAYS = [0, 2, 4] // Mon, Wed, Fri offset from week start

// Choose an unused asset whose selected/suggested pillar matches a recommended pillar.
function pickAsset(
  recommended: string[],
  assets: ContentAsset[],
  used: Set<string>,
): ContentAsset | undefined {
  // Treat uploads as a pool of options: skip archived/story-only, and prefer the
  // strongest assets so we don't dump everything into the plan.
  const candidates = assets
    .filter((a) => a.status !== 'unusable' && !used.has(a.id) && !['archive', 'story'].includes(strengthOf(a)))
    .sort((a, b) => (STRENGTH_PRIORITY[strengthOf(a)] ?? 5) - (STRENGTH_PRIORITY[strengthOf(b)] ?? 5))
  for (const pid of recommended) {
    const match = candidates.find((a) => (a.selectedPillarId || a.suggestedPillars[0]) === pid)
    if (match) return match
  }
  return candidates[0]
}

export function buildSchedule(
  weeks: StorylineWeek[],
  assets: ContentAsset[],
  pillars: ContentPillar[],
  people: PersonMemory[] = [],
): ScheduledPost[] {
  const posts: ScheduledPost[] = []
  const used = new Set<string>()

  for (const week of weeks) {
    // The week's recommended pillars come from the brand-specific storyline; fall
    // back to all pillars so scheduling still works if a week has none.
    const weekPillars = week.recommendedPillarIds.length ? week.recommendedPillarIds : pillars.map((p) => p.id)
    for (let d = 0; d < 3; d++) {
      const date = format(addDays(new Date(week.weekStart), POST_DAYS[d]), 'yyyy-MM-dd')
      const pillarId = weekPillars[d % weekPillars.length]
      const pillar = pillars.find((p) => p.id === pillarId)
      const asset = pickAsset(weekPillars, assets, used)
      if (asset) used.add(asset.id)

      const gen = asset
        ? generateCaption(asset, pillar, { people })
        : { caption: '', hook: week.theme, cta: '', hashtags: '' }

      posts.push({
        id: `post-${week.index}-${d}-${Math.random().toString(36).slice(2, 7)}`,
        scheduledDate: date,
        platforms: asset?.selectedPlatforms?.length
          ? asset.selectedPlatforms
          : asset?.suggestedPlatforms?.length
            ? asset.suggestedPlatforms
            : ['instagram', 'facebook'],
        pillarId: asset?.selectedPillarId || pillarId,
        campaignId: asset?.campaignId,
        assetIds: asset ? [asset.id] : [],
        title: asset?.title || week.theme,
        caption: gen.caption,
        hook: gen.hook,
        cta: gen.cta,
        hashtags: gen.hashtags,
        altText: '',
        emailSubject: '',
        emailPreview: '',
        emailBody: '',
        overlayIdeas: '',
        notes: asset ? '' : 'Idea slot — no asset yet. Upload or assign content.',
        promptNotes: '',
        status: asset ? 'drafted' : 'idea',
        optional: false,
        phase: week.phase,
      })
    }
  }
  return posts
}
