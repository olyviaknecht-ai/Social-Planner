import type { AssetStrength, ContentAsset, PostStatus, ScheduledPost } from '../types'

// ---- Display status (where this asset is in the workflow) ----
export type DisplayStatus = 'unused' | 'drafted' | 'approved' | 'scheduled' | 'posted'

const STATUS_RANK: Record<PostStatus, number> = { idea: 1, drafted: 2, approved: 3, scheduled: 4, posted: 5 }

export function postsForAsset(assetId: string, posts: ScheduledPost[]): ScheduledPost[] {
  return posts.filter((p) => p.assetIds.includes(assetId))
}

export function displayStatus(asset: ContentAsset, posts: ScheduledPost[]): DisplayStatus {
  const mine = postsForAsset(asset.id, posts)
  if (!mine.length) return 'unused'
  const top = mine.reduce((a, b) => (STATUS_RANK[b.status] > STATUS_RANK[a.status] ? b : a))
  return top.status === 'idea' ? 'drafted' : (top.status as DisplayStatus)
}

export function needsCaption(asset: ContentAsset, posts: ScheduledPost[]): boolean {
  const mine = postsForAsset(asset.id, posts)
  if (!mine.length) return true
  return mine.some((p) => !p.caption.trim())
}

// ---- Content strength ----
export function strengthOf(asset: ContentAsset): AssetStrength {
  if (asset.strength) return asset.strength
  if (asset.status === 'unusable') return 'archive'
  const a = asset.analysis
  if (!a) return 'support'
  if (a.needsContext) return 'needs-context'
  if (a.contentType === 'graphic' || a.contentType === 'short-clip') return a.canLead ? 'support' : 'story'
  return a.canLead ? 'hero' : 'support'
}

export const STRENGTH_META: Record<AssetStrength, { label: string; cls: string }> = {
  hero: { label: 'Hero asset', cls: 'bg-amber-100 text-amber-800' },
  support: { label: 'Support asset', cls: 'bg-sky-100 text-sky-700' },
  story: { label: 'Story only', cls: 'bg-violet-100 text-violet-700' },
  'needs-context': { label: 'Needs context', cls: 'bg-rose-100 text-rose-700' },
  archive: { label: 'Archive', cls: 'bg-gray-200 text-gray-600' },
}

// ---- Suggested use (one short line) ----
// pillarTitle, when provided, makes the suggestion use the brand's own pillar name.
export function suggestedUse(asset: ContentAsset, pillarTitle?: string): string {
  const a = asset.analysis
  const inPillar = pillarTitle ? `Lead a ${pillarTitle} post.` : 'Use as a supporting post.'
  if (!a) return inPillar
  const strength = strengthOf(asset)
  if (strength === 'needs-context') return 'Add a note, then it can lead a post.'
  if (strength === 'story') return 'Best as a quick story moment.'
  if (strength === 'archive') return 'Set aside for later.'
  switch (a.contentType) {
    case 'testimonial':
      return 'Lead a proof post or pull a quote.'
    case 'event':
      return 'Anchor an event recap carousel.'
    case 'team':
      return pillarTitle ? `Feature in a ${pillarTitle} post.` : 'Feature your people.'
    case 'behind-the-scenes':
      return 'Build familiarity, pair into a carousel.'
    case 'community':
      return 'Show local presence, tag the partner.'
    case 'tool':
      return 'Lead with the benefit, then the tool.'
    case 'podcast':
      return 'Cut a Reel from the best line.'
    case 'headshot':
      return 'Use for branding or a promo.'
    case 'short-clip':
      return 'Turn into a Reel and a TikTok.'
    case 'graphic':
      return 'Save-worthy tip post.'
    default:
      return inPillar
  }
}

// ---- Recommended next actions per asset ----
export type AssetActionId =
  | 'reel'
  | 'recap'
  | 'schedule-next-week'
  | 'unschedule'
  | 'story-only'
  | 'save-future'
  | 'archive'

export function recommendedActions(asset: ContentAsset): { id: AssetActionId; label: string }[] {
  const a = asset.analysis
  const out: { id: AssetActionId; label: string }[] = []
  if (asset.fileType === 'video' || a?.contentType === 'short-clip' || a?.contentType === 'podcast') {
    out.push({ id: 'reel', label: 'Turn into Reel' })
  }
  if (a?.contentType === 'event' || a?.contentType === 'community') {
    out.push({ id: 'recap', label: 'Use as recap post' })
  }
  out.push({ id: 'schedule-next-week', label: 'Schedule next week' })
  if (strengthOf(asset) !== 'story') out.push({ id: 'story-only', label: 'Mark story only' })
  out.push({ id: 'save-future', label: 'Save for future campaign' })
  out.push({ id: 'archive', label: 'Archive' })
  return out
}

// ---- Filters ----
export interface FilterDef {
  id: string
  label: string
  test: (a: ContentAsset, ctx: { posts: ScheduledPost[] }) => boolean
}

export const FILTERS: FilterDef[] = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'unused', label: 'Unused', test: (a, c) => displayStatus(a, c.posts) === 'unused' },
  { id: 'needs-caption', label: 'Needs caption', test: (a, c) => needsCaption(a, c.posts) },
  { id: 'scheduled', label: 'Scheduled', test: (a, c) => displayStatus(a, c.posts) === 'scheduled' },
  { id: 'posted', label: 'Posted', test: (a, c) => displayStatus(a, c.posts) === 'posted' },
  { id: 'used', label: 'Used', test: (a) => a.status === 'posted' },
  { id: 'event', label: 'Event content', test: (a) => !!a.event.trim() || a.analysis?.contentType === 'event' },
  { id: 'faces', label: 'Team / faces', test: (a) => !!a.people.trim() || a.selectedPillarId === 'people' || a.analysis?.contentType === 'team' || a.analysis?.contentType === 'headshot' },
  { id: 'agent-value', label: 'Agent value', test: (a) => a.selectedPillarId === 'growth' || a.selectedPillarId === 'tools' || a.analysis?.contentType === 'tool' },
  { id: 'proof', label: 'Proof / testimonial', test: (a) => a.selectedPillarId === 'proof' || a.analysis?.contentType === 'testimonial' },
  { id: 'community', label: 'Community', test: (a) => a.selectedPillarId === 'community' || a.analysis?.contentType === 'community' },
  { id: 'strongest', label: 'Strongest', test: (a) => strengthOf(a) === 'hero' },
  { id: 'time', label: 'Time-sensitive', test: (a) => a.timeSensitive },
  { id: 'campaign', label: 'In a campaign', test: (a) => !!a.campaignId },
]

// ---- Grouping by event / campaign ----
export interface AssetGroup {
  key: string
  label: string
  kind: 'campaign' | 'event' | 'ungrouped'
  assets: ContentAsset[]
}

export function groupAssets(assets: ContentAsset[], campaignName: (id?: string) => string | undefined): AssetGroup[] {
  const groups = new Map<string, AssetGroup>()
  const ungrouped: ContentAsset[] = []
  for (const a of assets) {
    const camp = campaignName(a.campaignId)
    const key = a.campaignId ? `campaign:${a.campaignId}` : a.event.trim() ? `event:${a.event.trim().toLowerCase()}` : ''
    if (!key) {
      ungrouped.push(a)
      continue
    }
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        kind: a.campaignId ? 'campaign' : 'event',
        label: a.campaignId ? camp || 'Campaign' : a.event.trim(),
        assets: [],
      })
    }
    groups.get(key)!.assets.push(a)
  }
  const arr = Array.from(groups.values()).sort((x, y) => y.assets.length - x.assets.length)
  if (ungrouped.length) arr.push({ key: 'ungrouped', kind: 'ungrouped', label: 'Not tied to an event or campaign', assets: ungrouped })
  return arr
}
