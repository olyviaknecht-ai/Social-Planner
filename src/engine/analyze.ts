import type {
  AssetAnalysis,
  ContentAsset,
  ContentTypeTag,
  FileType,
  Platform,
  PostFormat,
} from '../types'

interface Signal {
  type: ContentTypeTag
  pillar: string
  keywords: string[]
}

// Keyword → content type + default pillar.
const SIGNALS: Signal[] = [
  { type: 'team', pillar: 'people', keywords: ['team', 'staff', 'office crew', 'coworker', 'our people', 'birthday', 'anniversary', 'culture', 'meet'] },
  { type: 'behind-the-scenes', pillar: 'people', keywords: ['behind the scenes', 'bts', 'day in the life', 'morning', 'desk', 'prep', 'setup', 'candid'] },
  { type: 'headshot', pillar: 'growth', keywords: ['headshot', 'portrait', 'photo day', 'branding photo'] },
  { type: 'testimonial', pillar: 'proof', keywords: ['testimonial', 'review', 'feedback', 'quote', 'thank you', 'kind words', 'shoutout', 'win', 'milestone', 'results'] },
  { type: 'event', pillar: 'events', keywords: ['event', 'workshop', 'power hour', 'agent advantage', 'ce ', 'class', 'seminar', 'rsvp', 'register', 'happy hour', 'mixer', 'good talk', 'content day'] },
  { type: 'community', pillar: 'community', keywords: ['rmhc', 'charity', 'community', 'volunteer', 'donation', 'real producers', 'ypn', 'local', 'partner', 'sponsor', 'fundraiser', 'ribbon'] },
  { type: 'sponsor', pillar: 'community', keywords: ['sponsor', 'partner', 'collaboration', 'vendor'] },
  { type: 'closing', pillar: 'closing', keywords: ['closing', 'closing table', 'signing', 'wire', 'escrow', 'title', 'keys', 'sold'] },
  { type: 'tool', pillar: 'tools', keywords: ['insider', 'agent os', 'closinglock', 'title toolbox', 'app', 'platform', 'software', 'ai', 'request system', 'tech', 'dashboard'] },
  { type: 'podcast', pillar: 'growth', keywords: ['podcast', 'episode', 'mic', 'good talk club', 'cosi', 'american dream', 'interview'] },
  { type: 'short-clip', pillar: 'people', keywords: ['clip', 'reel', 'short', 'tiktok', 'b-roll', 'broll'] },
  { type: 'graphic', pillar: 'growth', keywords: ['graphic', 'flyer', 'screenshot', 'announcement', 'infographic', 'tip', 'quote graphic'] },
]

function haystack(a: Partial<ContentAsset>): string {
  return [a.title, a.notes, a.event, a.people, a.location, a.captionIdea, ...(a.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function detectType(text: string, fileType: FileType): { type: ContentTypeTag; pillar: string; score: number }[] {
  const hits: { type: ContentTypeTag; pillar: string; score: number }[] = []
  for (const sig of SIGNALS) {
    let score = 0
    for (const kw of sig.keywords) if (text.includes(kw)) score += kw.length > 6 ? 2 : 1
    if (score > 0) hits.push({ type: sig.type, pillar: sig.pillar, score })
  }
  if (hits.length === 0) {
    hits.push({ type: fileType === 'video' ? 'short-clip' : 'team', pillar: 'people', score: 1 })
  }
  return hits.sort((a, b) => b.score - a.score)
}

function pickFormat(type: ContentTypeTag, fileType: FileType, multi: boolean): PostFormat {
  if (fileType === 'video') return type === 'podcast' ? 'reel' : 'reel'
  if (multi) return 'carousel'
  switch (type) {
    case 'testimonial':
      return 'quote-graphic'
    case 'event':
    case 'community':
      return 'carousel'
    case 'graphic':
      return 'single-image'
    default:
      return 'single-image'
  }
}

const EMOTION: Record<ContentTypeTag, string> = {
  team: 'Warmth and belonging — the human side of the company.',
  'behind-the-scenes': 'Familiarity — letting agents in on the everyday.',
  headshot: 'Confidence and pride in showing up well.',
  testimonial: 'Reassurance — proof that people like them trust Valmer.',
  event: 'Anticipation and belonging — a room worth being in.',
  sponsor: 'Shared values and local pride.',
  community: 'Rootedness — Valmer shows up where it matters.',
  closing: 'Calm and trust — the hard part handled quietly.',
  tool: 'Relief and forward motion — work made lighter.',
  podcast: 'Curiosity and connection — real conversations.',
  'short-clip': 'Energy and personality.',
  graphic: 'Clarity — something useful at a glance.',
}

const GOAL: Record<ContentTypeTag, string> = {
  team: 'Emotional connection',
  'behind-the-scenes': 'Emotional connection',
  headshot: 'Agent growth / value',
  testimonial: 'Build credibility',
  event: 'Drive registrations',
  sponsor: 'Community trust',
  community: 'Community trust',
  closing: 'Reinforce professionalism',
  tool: 'Differentiation',
  podcast: 'Agent growth / value',
  'short-clip': 'Reach and engagement',
  graphic: 'Educate / inform',
}

function platformsFor(type: ContentTypeTag, fileType: FileType): Platform[] {
  if (fileType === 'video') {
    if (type === 'podcast' || type === 'short-clip') return ['reels', 'tiktok', 'facebook']
    return ['reels', 'tiktok', 'instagram', 'facebook']
  }
  switch (type) {
    case 'testimonial':
      return ['instagram', 'facebook', 'email']
    case 'event':
      return ['instagram', 'facebook', 'email']
    case 'graphic':
    case 'tool':
      return ['instagram', 'facebook']
    case 'community':
      return ['instagram', 'facebook']
    default:
      return ['instagram', 'facebook']
  }
}

const CTA: Record<ContentTypeTag, string> = {
  team: 'Say hi to the team in the comments.',
  'behind-the-scenes': 'Follow along this week.',
  headshot: 'Want fresh headshots? Ask us about photo day.',
  testimonial: 'Curious what working with us is like? Reach out.',
  event: 'Save your spot — link in bio.',
  sponsor: 'Get to know our partners.',
  community: 'Tag someone who loves this part of town.',
  closing: 'Have a closing coming up? We are ready.',
  tool: 'Ask us for a walkthrough.',
  podcast: 'Listen to the full episode — link in bio.',
  'short-clip': 'Send this to an agent who gets it.',
  graphic: 'Save this for later.',
}

export function analyzeAsset(asset: ContentAsset): AssetAnalysis {
  const text = haystack(asset)
  const ranked = detectType(text, asset.fileType)
  const top = ranked[0]
  const multi = false

  const suggestedPillars = Array.from(new Set(ranked.slice(0, 3).map((r) => r.pillar)))
  const timeSensitive =
    asset.timeSensitive ||
    /today|tonight|tomorrow|this week|last call|reminder|rsvp|register|deadline|seats|spots/.test(text)
  const evergreen = !timeSensitive && ['team', 'behind-the-scenes', 'tool', 'closing', 'testimonial'].includes(top.type)

  const captionDir = captionDirectionFor(top.type, asset)

  const campaignSuggestion = detectCampaign(text)

  return {
    contentType: top.type,
    format: pickFormat(top.type, asset.fileType, multi),
    emotionalAngle: EMOTION[top.type],
    businessGoal: GOAL[top.type],
    captionDirection: captionDir,
    cta: asset.ctaNote || CTA[top.type],
    evergreen,
    needsContext: ['testimonial', 'closing', 'tool', 'podcast'].includes(top.type) && !asset.notes,
    canLead: top.score >= 2 || asset.fileType === 'video' || ['testimonial', 'event', 'team'].includes(top.type),
    keywords: extractKeywords(text),
    campaignSuggestion,
  }
}

function captionDirectionFor(type: ContentTypeTag, asset: ContentAsset): string {
  const who = asset.people ? asset.people.split(',')[0].trim() : ''
  switch (type) {
    case 'team':
      return `Lead with the person${who ? ` (${who})` : ''}, then why this kind of team makes the work feel less transactional.`
    case 'behind-the-scenes':
      return 'Show the ordinary moment, then point to the care behind it that agents do not usually see.'
    case 'testimonial':
      return 'Open with the feeling behind the win, let the quote carry the proof, close with a soft invitation.'
    case 'event':
      return 'Sell the room and the reason to be there, not just the logistics. Name what an agent walks away with.'
    case 'community':
      return 'Connect Valmer to the place and the people, not the brand. Make it about belonging.'
    case 'closing':
      return 'Reframe a “simple” closing as quiet, careful work so the people at the table feel taken care of.'
    case 'tool':
      return 'Lead with the agent problem it solves, then the tool. Keep it plain, not techy.'
    case 'podcast':
      return 'Pull the most honest line from the conversation and build the caption around it.'
    case 'headshot':
      return 'Tie a good photo to showing up confidently in their business.'
    default:
      return 'Answer why it matters and what an agent should feel or do next.'
  }
}

function detectCampaign(text: string): string | undefined {
  if (/agent advantage/.test(text)) return 'Agent Advantage'
  if (/power hour/.test(text)) return 'Marketing Power Hour'
  if (/good talk/.test(text)) return 'Good Talk Club'
  if (/insider/.test(text)) return 'Valmer Insider Launch'
  if (/toolbox/.test(text)) return 'Title Toolbox Promotion'
  if (/rmhc|charity|fundraiser/.test(text)) return 'RMHC / Community Initiative'
  if (/podcast|cosi|american dream/.test(text)) return 'Podcast Episode Launch'
  if (/headshot|content day/.test(text)) return 'Content Day / Headshots'
  return undefined
}

const STOP = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'our', 'from', 'are', 'was', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'is', 'it'])

function extractKeywords(text: string): string[] {
  const words = text.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w))
  const freq = new Map<string, number>()
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1)
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map((e) => e[0])
}
