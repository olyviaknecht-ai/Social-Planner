import type { ContentAsset, ContentPillar, ContentTypeTag, PersonMemory, Platform } from '../types'
import { analyzeAsset } from './analyze'

export interface CaptionOpts {
  people?: PersonMemory[]
  guidance?: string
  carousel?: boolean
}

// Resolve names in an asset's "who is in this" field against the people directory.
function resolvePeople(names: string, dir?: PersonMemory[]): string[] {
  if (!names.trim()) return []
  return names
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => {
      const match = dir?.find((p) => p.name && n.toLowerCase().includes(p.name.toLowerCase()))
      return match && match.role ? `${match.name}, ${match.role}` : n
    })
}

function ensureSentence(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return ''
  const capped = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(capped) ? capped : capped + '.'
}

// Re-prompt guidance can mix facts ("this was our holiday party") with tone
// directives ("make it warmer"). Keep the facts as caption content; drop the
// directives, since tone is handled by the caption-control buttons.
const DIRECTIVE = /^(make|keep|write|rewrite|reword|focus|emphasi[sz]e|sound|be|use|add|mention|highlight|lead with|talk about|less|more|don'?t|do not|avoid)\b/i

function factsFromGuidance(guidance: string): string {
  const sentences = guidance.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
  const facts = sentences.filter((s) => !DIRECTIVE.test(s))
  return facts.join(' ').trim()
}

// Words/phrases that make captions sound generic or like every other title company.
const BANNED: { pattern: RegExp; replace: string }[] = [
  { pattern: /—/g, replace: ',' }, // em dash
  { pattern: /\s—\s/g, replace: ', ' },
  { pattern: /\belevate\b/gi, replace: 'lift' },
  { pattern: /\bseamless(ly)?\b/gi, replace: 'smooth' },
  { pattern: /your trusted partner/gi, replace: 'a team you can lean on' },
  { pattern: /valuable insights?/gi, replace: 'a few real takeaways' },
  { pattern: /in today'?s market/gi, replace: 'right now' },
  { pattern: /whether you'?re buying or selling/gi, replace: 'whatever the deal looks like' },
  { pattern: /leverage/gi, replace: 'use' },
  { pattern: /unlock/gi, replace: 'open up' },
  { pattern: /game[- ]chang(er|ing)/gi, replace: 'real difference' },
]

export function sanitizeVoice(text: string): string {
  let out = text
  for (const b of BANNED) out = out.replace(b.pattern, b.replace)
  // collapse multiple exclamation points to one, then most to a period
  out = out.replace(/!+/g, '!')
  // limit exclamation points to one per caption
  let seen = false
  out = out.replace(/!/g, () => {
    if (seen) return '.'
    seen = true
    return '!'
  })
  return out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

interface Ctx {
  asset: ContentAsset
  pillar?: ContentPillar
  type: ContentTypeTag
  who: string
  peopleList: string[]
  event: string
  cta: string
  guidance: string
  carousel: boolean
}

function ctx(asset: ContentAsset, pillar?: ContentPillar, opts?: CaptionOpts): Ctx {
  const analysis = asset.analysis || analyzeAsset(asset)
  const peopleList = resolvePeople(asset.people, opts?.people)
  const guidance = factsFromGuidance((opts?.guidance || '').trim())
  return {
    asset,
    pillar,
    type: analysis.contentType,
    who: peopleList[0] || '',
    peopleList,
    event: asset.event || guidance || '',
    cta: asset.ctaNote || analysis.cta,
    guidance,
    carousel: !!opts?.carousel,
  }
}

// Body builders per content type. Each answers: why it matters / what it shows / why an agent cares.
const BODY: Record<ContentTypeTag, (c: Ctx) => string> = {
  team: (c) =>
    `${c.who ? `This is ${c.who}.` : 'Meet part of the team.'} The names behind your file matter more than people think. When you know who is picking up the phone, a closing stops feeling like paperwork and starts feeling like people looking out for you.`,
  'behind-the-scenes': (c) =>
    `Most of what we do never makes it into a photo. ${c.event ? `Here is a look at ${c.event}.` : 'Here is a quiet look behind the curtain.'} The double-checking, the early starts, the small calls. It is the part that keeps your deals from becoming your problem.`,
  testimonial: (c) =>
    `Wins like this are the whole point.${c.asset.captionIdea ? ` "${c.asset.captionIdea.trim()}"` : ' Hearing it from an agent we work with means more than anything we could say about ourselves.'} When the people around you trust a team, it makes the choice easier.`,
  event: (c) =>
    `There is something different about being in a room full of agents who are genuinely trying to get better.${c.event ? ` ${c.event} is built for exactly that.` : ''} Not just networking. Real ideas, better questions, and the kind of relationships that make this business feel less lonely.`,
  community: (c) =>
    `${c.event || c.asset.location ? `${c.event || c.asset.location}. ` : ''}We do not just work in this community, we are part of it. Showing up for the people and places around us is not a marketing line. It is the reason this work feels worth doing.`,
  sponsor: (c) =>
    `Good partners make everything better. ${c.who ? `Grateful for ${c.who}. ` : ''}When local businesses look out for each other, the whole community feels it.`,
  closing: (c) =>
    `A smooth closing usually looks simple from the outside. That is the point. Behind every signed document is a team checking details, answering questions, and making sure the people at the table feel taken care of.`,
  tool: (c) =>
    `The right tool should make your day lighter, not louder.${c.event ? ` ${c.event} does exactly that.` : ''} Less chasing, less guessing, more time for the parts of your business only you can do.`,
  podcast: (c) =>
    `The best conversations are the honest ones.${c.event ? ` On ${c.event}, ` : ' '}we got into the real stuff, the parts of this business people usually leave out. Worth a listen if you have ever felt like you were figuring it out alone.`,
  headshot: (c) =>
    `${c.who ? `Looking sharp, ${c.who}. ` : ''}A good photo is not vanity. It is how agents recognize you, trust you, and remember you before you ever say a word.`,
  'short-clip': (c) =>
    `${c.event ? `${c.event}. ` : ''}A quick one, but it says a lot about how we show up.`,
  graphic: (c) =>
    `Saving you a search. ${c.asset.title || 'Here is something useful to keep handy.'} Small things like this add up over a busy week.`,
}

const HOOK: Record<ContentTypeTag, string> = {
  team: 'The people behind your file.',
  'behind-the-scenes': 'The part you never see.',
  testimonial: 'In their words.',
  event: 'Worth being in the room for.',
  community: 'Rooted right here.',
  sponsor: 'Better together.',
  closing: 'Simple is the hard part.',
  tool: 'Less chasing, more closing.',
  podcast: 'The honest version.',
  headshot: 'Show up like you mean it.',
  'short-clip': 'Quick, but it counts.',
  graphic: 'Save this one.',
}

export function generateCaption(asset: ContentAsset, pillar?: ContentPillar, opts?: CaptionOpts): { caption: string; hook: string; cta: string; hashtags: string } {
  const c = ctx(asset, pillar, opts)
  let body = BODY[c.type](c)

  // Name extra people beyond the lead when we know who they are.
  if (c.carousel && c.peopleList.length > 1) {
    body += ` In these shots: ${c.peopleList.join(', ')}.`
  }

  // Lead with the new info from a re-prompt so the caption reflects it.
  const lead = c.guidance && !body.toLowerCase().includes(c.guidance.toLowerCase()) ? `${ensureSentence(c.guidance)} ` : ''
  const carouselNote = c.carousel ? '\n\nSwipe through.' : ''

  const caption = sanitizeVoice(`${lead}${body}${carouselNote}\n\n${c.cta}`)
  return {
    caption,
    hook: HOOK[c.type],
    cta: sanitizeVoice(c.cta),
    hashtags: hashtagsFor(c.type),
  }
}

function hashtagsFor(type: ContentTypeTag): string {
  const base = ['#ValmerLandTitle', '#TitleDoneRight']
  const extra: Record<string, string[]> = {
    event: ['#AgentAdvantage', '#RealEstateEvents'],
    community: ['#LocalFirst', '#CommunityMatters'],
    testimonial: ['#AgentLove', '#ClientWins'],
    tool: ['#RealEstateTools', '#WorkSmarter'],
    closing: ['#ClosingDay', '#TitleTips'],
  }
  return [...base, ...(extra[type] || ['#RealEstate', '#AgentSupport'])].join(' ')
}

// ---- Platform-specific versions ----

export function platformVersion(caption: string, platform: Platform, asset: ContentAsset): string {
  const firstLine = caption.split('\n').find((l) => l.trim())?.trim() || caption
  switch (platform) {
    case 'instagram':
      return caption
    case 'facebook':
      return sanitizeVoice(caption.replace(/#\w+/g, '').trim())
    case 'tiktok': {
      const short = caption.split('\n')[0]
      return sanitizeVoice(`${short}\n\n${hashtagsFor(asset.analysis?.contentType || 'team').replace('#ValmerLandTitle', '#valmer')}`)
    }
    case 'reels':
      return sanitizeVoice(caption.split('\n').slice(0, 2).join('\n'))
    case 'email':
      return caption
    default:
      return caption
  }
}

export function generateEmail(asset: ContentAsset, pillar?: ContentPillar, opts?: CaptionOpts): { subject: string; preview: string; body: string; cta: string } {
  const c = ctx(asset, pillar, opts)
  const lead = c.guidance ? `${ensureSentence(c.guidance)} ` : ''
  const base = lead + BODY[c.type](c)
  const subjectMap: Partial<Record<ContentTypeTag, string>> = {
    event: c.event ? `Save your spot: ${c.event}` : 'An invite worth opening',
    testimonial: 'What agents are saying about us',
    tool: c.event ? `Meet ${c.event}` : 'A tool to make your week lighter',
    community: 'Out in the community this month',
    team: 'The people behind your closings',
  }
  const subject = sanitizeVoice(subjectMap[c.type] || asset.title || 'A quick note from Valmer')
  const preview = sanitizeVoice(HOOK[c.type])
  const body = sanitizeVoice(
    `Hi there,\n\n${base}\n\nIf any of this lands, here is the easy next step:\n\n${c.cta}\n\nTalk soon,\nThe Valmer Team`,
  )
  return { subject, preview, body, cta: ctaButton(c.type) }
}

function ctaButton(type: ContentTypeTag): string {
  switch (type) {
    case 'event':
      return 'Save my spot'
    case 'tool':
      return 'Show me how'
    case 'testimonial':
      return 'Work with us'
    default:
      return 'Learn more'
  }
}

// ---- AI caption controls ----

export type CaptionControl =
  | 'warmer'
  | 'less-ai'
  | 'shorter'
  | 'more-personal'
  | 'more-direct'
  | 'more-emotional'
  | 'stronger-cta'
  | 'more-valmer'
  | 'less-salesy'

export const CAPTION_CONTROLS: { id: CaptionControl; label: string }[] = [
  { id: 'warmer', label: 'Make it warmer' },
  { id: 'less-ai', label: 'Make it less AI' },
  { id: 'shorter', label: 'Make it shorter' },
  { id: 'more-personal', label: 'More personal' },
  { id: 'more-direct', label: 'More direct' },
  { id: 'more-emotional', label: 'More emotional' },
  { id: 'stronger-cta', label: 'Stronger CTA' },
  { id: 'more-valmer', label: 'More Valmer' },
  { id: 'less-salesy', label: 'Less salesy' },
]

export function applyControl(text: string, control: CaptionControl, cta: string): string {
  let out = text
  switch (control) {
    case 'warmer':
      out = `${out}\n\nGrateful you are here for it.`
      break
    case 'less-ai':
      out = sanitizeVoice(out)
        .replace(/\bmoreover\b|\bfurthermore\b|\badditionally\b/gi, 'and')
        .replace(/\butilize\b/gi, 'use')
        .replace(/\bin conclusion\b/gi, 'so')
      break
    case 'shorter': {
      const sentences = out.replace(/\n+/g, ' ').match(/[^.!?]+[.!?]/g) || [out]
      out = sentences.slice(0, 2).join(' ').trim()
      break
    }
    case 'more-personal':
      out = out.replace(/\bagents\b/gi, 'you').replace(/\bthe people at the table\b/gi, 'you and your clients')
      break
    case 'more-direct':
      out = `${(out.match(/[^.!?]+[.!?]/g) || [out])[0].trim()}\n\n${cta}`
      break
    case 'more-emotional':
      out = `${out}\n\nThis is the part of the job that still gives us chills.`
      break
    case 'stronger-cta':
      out = `${out}\n\n${cta} Do it now while it is in front of you.`
      break
    case 'more-valmer':
      out = out.replace(/our team/gi, 'the Valmer team').replace(/\bwe\b/, 'At Valmer, we')
      break
    case 'less-salesy':
      out = out
        .replace(/save your spot|sign up|register now|don'?t miss/gi, 'come hang out')
        .replace(/link in bio/gi, 'details below')
      break
  }
  return sanitizeVoice(out)
}
