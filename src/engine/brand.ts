import type { BrandAnswers, BrandBuildResult } from './ai'

function shorten(text: string, words = 8): string {
  const w = text.trim().split(/\s+/)
  return w.length <= words ? text.trim() : w.slice(0, words).join(' ') + '…'
}

// Build a brand brief + content pillars from the onboarding answers, no AI needed.
export function buildBrandLocally(a: BrandAnswers): BrandBuildResult {
  const name = a.name?.trim() || 'this brand'
  const brief = [
    a.about?.trim(),
    a.audience?.trim() ? `For ${a.audience.trim()}.` : '',
    a.vibe?.trim() ? `Voice: ${a.vibe.trim()}.` : '',
    a.goals?.trim() ? `Goal: ${a.goals.trim()}.` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const highlights = a.highlights?.trim()
  const pillars = [
    { title: 'People & Faces', description: `The humans behind ${name}.`, goal: 'Emotional connection.', share: 0.22 },
    { title: 'Behind the Scenes', description: 'How the work really happens day to day.', goal: 'Familiarity and trust.', share: 0.16 },
    { title: 'Proof & Reviews', description: 'Testimonials, results, and real wins.', goal: 'Build credibility.', share: 0.16 },
    { title: 'Education & Tips', description: a.about?.trim() ? `Useful, save-worthy tips around ${shorten(a.about, 6)}` : 'Useful, save-worthy value.', goal: 'Show authority.', share: 0.16 },
    { title: 'Community & Local', description: 'Events, partners, and local presence.', goal: 'Create belonging.', share: 0.14 },
    { title: 'Offers & Events', description: highlights ? `Highlight ${shorten(highlights, 10)}` : 'Launches, invites, and clear calls to action.', goal: a.goals?.trim() ? shorten(a.goals, 8) : 'Drive action.', share: 0.16 },
  ]

  return { brief, pillars }
}
