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
  { phase: 1, name: 'Familiarity', weeks: [0, 1, 2], goal: 'Remind agents who Valmer is — faces, warmth, culture, local connection.' },
  { phase: 2, name: 'Trust', weeks: [3, 4, 5], goal: 'Show proof, competence, and how Valmer makes things easier.' },
  { phase: 3, name: 'Value', weeks: [6, 7, 8], goal: 'Highlight tools, resources, marketing support, and agent growth.' },
  { phase: 4, name: 'Action', weeks: [9, 10, 11], goal: 'Drive event registrations, meetings, and deeper engagement.' },
]

const WEEK_THEMES: { theme: string; goal: string; pillars: string[] }[] = [
  { theme: 'Reintroduce the people behind Valmer', goal: 'Put faces to the name.', pillars: ['people'] },
  { theme: 'Show our community presence', goal: 'Prove we are local and invested.', pillars: ['community', 'people'] },
  { theme: 'Open the curtain on the everyday', goal: 'Build familiarity through behind-the-scenes.', pillars: ['people', 'closing'] },
  { theme: 'Build trust with proof', goal: 'Let agents and clients vouch for us.', pillars: ['proof'] },
  { theme: 'Closings done with care', goal: 'Reframe smooth closings as quiet, careful work.', pillars: ['closing', 'proof'] },
  { theme: 'Recap what people experienced', goal: 'Show turnout and real moments.', pillars: ['proof', 'events'] },
  { theme: 'Highlight agent support', goal: 'Show the help agents can actually use.', pillars: ['growth'] },
  { theme: 'Introduce modern tools', goal: 'Position Valmer as forward-thinking.', pillars: ['tools', 'growth'] },
  { theme: 'Tease upcoming event value', goal: 'Make the next event feel worth it.', pillars: ['events', 'growth'] },
  { theme: 'Invite agents into the experience', goal: 'Open registrations with warmth.', pillars: ['events', 'people'] },
  { theme: 'Reminders and last call', goal: 'Push RSVPs without nagging.', pillars: ['events', 'proof'] },
  { theme: 'Recap and follow-up', goal: 'Close the loop and hand over a resource.', pillars: ['proof', 'growth', 'tools'] },
]

export function buildStoryline(start?: Date): StorylineWeek[] {
  const base = start ? startOfWeek(start, { weekStartsOn: 1 }) : nextMonday(new Date())
  return WEEK_THEMES.map((w, i) => {
    const weekStart = addDays(base, i * 7)
    const phase = PHASES.find((p) => p.weeks.includes(i))!
    return {
      id: `week-${i}`,
      index: i,
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(addDays(weekStart, 6), 'yyyy-MM-dd'),
      phase: phase.phase,
      theme: w.theme,
      goal: w.goal,
      recommendedPillarIds: w.pillars,
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
    const themeMeta = WEEK_THEMES[week.index]
    for (let d = 0; d < 3; d++) {
      const date = format(addDays(new Date(week.weekStart), POST_DAYS[d]), 'yyyy-MM-dd')
      const pillarId = themeMeta.pillars[d % themeMeta.pillars.length]
      const pillar = pillars.find((p) => p.id === pillarId)
      const asset = pickAsset(themeMeta.pillars, assets, used)
      if (asset) used.add(asset.id)

      const gen = asset
        ? generateCaption(asset, pillar, { people })
        : { caption: '', hook: themeMeta.theme, cta: '', hashtags: '' }

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
        title: asset?.title || `${themeMeta.theme}`,
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
