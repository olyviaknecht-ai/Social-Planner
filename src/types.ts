export type Platform = 'instagram' | 'reels' | 'facebook' | 'tiktok' | 'youtube' | 'email'

export const PLATFORMS: { id: Platform; label: string; short: string }[] = [
  { id: 'instagram', label: 'Instagram Feed', short: 'IG' },
  { id: 'reels', label: 'Instagram Reels', short: 'Reel' },
  { id: 'facebook', label: 'Facebook', short: 'FB' },
  { id: 'tiktok', label: 'TikTok', short: 'TT' },
  { id: 'youtube', label: 'YouTube', short: 'YT' },
  { id: 'email', label: 'Email', short: 'Email' },
]

export type FileType = 'photo' | 'video'

export type AssetStatus = 'unused' | 'scheduled' | 'posted' | 'unusable'

export type AssetStrength = 'hero' | 'support' | 'story' | 'needs-context' | 'archive'

export type PostStatus = 'idea' | 'drafted' | 'approved' | 'scheduled' | 'posted'

export const POST_STATUSES: PostStatus[] = ['idea', 'drafted', 'approved', 'scheduled', 'posted']

export type ContentTypeTag =
  | 'team'
  | 'event'
  | 'behind-the-scenes'
  | 'testimonial'
  | 'sponsor'
  | 'headshot'
  | 'podcast'
  | 'short-clip'
  | 'graphic'
  | 'community'
  | 'closing'
  | 'tool'

export type PostFormat =
  | 'single-image'
  | 'carousel'
  | 'reel'
  | 'story'
  | 'video'
  | 'email'
  | 'quote-graphic'

export interface AssetAnalysis {
  contentType: ContentTypeTag
  format: PostFormat
  emotionalAngle: string
  businessGoal: string
  captionDirection: string
  cta: string
  evergreen: boolean
  needsContext: boolean
  canLead: boolean // strong enough to lead a post vs support a carousel/recap
  keywords: string[]
  campaignSuggestion?: string
}

export interface ContentAsset {
  id: string
  fileUrl?: string // object URL (session) — blob persisted in IndexedDB
  thumbnailUrl?: string // data URL persisted
  driveId?: string // Google Drive file id — original stays in Drive at full quality
  fileType: FileType
  uploadedAt: string
  title: string
  notes: string
  people: string
  location: string
  event: string
  campaignId?: string
  folderId?: string
  tags: string[]
  suggestedPillars: string[] // pillar ids
  selectedPillarId?: string
  suggestedPlatforms: Platform[]
  selectedPlatforms: Platform[]
  timeSensitive: boolean
  expirationDate?: string
  hasCta: boolean
  ctaNote: string
  serviceToMention: string
  peopleToTag: string
  captionIdea: string
  status: AssetStatus
  strength?: AssetStrength // user override; otherwise derived from analysis
  useNote?: string // editable "suggested use" line; falls back to the computed suggestion
  carouselId?: string // groups assets into a carousel that lives in the library until scheduled
  analysis?: AssetAnalysis
}

export interface ContentPillar {
  id: string
  title: string
  description: string
  color: string
  goal: string
  active: boolean
  targetShare: number // 0-1 ideal proportion
}

export type CampaignStatus = 'planning' | 'active' | 'done'

export interface CampaignBeat {
  id: string
  stage: string
  description: string
  assetIds: string[]
  postId?: string
}

export interface Campaign {
  id: string
  title: string
  goal: string
  startDate: string
  endDate: string
  status: CampaignStatus
  color: string
  beats: CampaignBeat[]
}

export interface ScheduledPost {
  id: string
  scheduledDate: string // ISO date (yyyy-mm-dd)
  platforms: Platform[]
  pillarId?: string
  campaignId?: string
  assetIds: string[]
  title: string
  caption: string
  hook: string
  cta: string
  hashtags: string
  altText: string
  emailSubject: string
  emailPreview: string
  emailBody: string
  overlayIdeas: string
  notes: string
  promptNotes: string // extra info the user feeds the caption generator
  format?: PostFormat
  status: PostStatus
  optional: boolean // extra post beyond the 3x/week cadence
  phase: number // 1-4
}

// A brand / client the user creates content for. Each brand has its own content.
export interface Brand {
  id: string
  name: string
  brief?: string // AI-built brand voice + positioning summary, used to steer captions
}

// A user-made folder to organize the content library (e.g. Events, Headshots).
export interface Folder {
  id: string
  name: string
}

// A remembered person so captions can be specific about who is in a photo.
export interface PersonMemory {
  id: string
  name: string
  role: string // e.g. "closing coordinator", "agent partner"
  notes: string
}

// Settings for the optional AI caption writer (OpenAI / ChatGPT).
export interface AIConfig {
  enabled: boolean
  apiKey: string
  model: string
}

// Settings for publishing to Meta (Facebook Page via Graph API).
export interface MetaConfig {
  appId: string // public Meta App ID, used for Facebook Login
  configId: string // optional: "Facebook Login for Business" configuration ID (uses this instead of scopes)
  pageId: string
  pageToken: string // auto-filled by Facebook Login, or pasted manually (advanced)
  pageName: string
  igUserId: string
}

export interface StorylineWeek {
  id: string
  index: number // 0-based week number
  weekStart: string
  weekEnd: string
  phase: number // 1-4
  theme: string
  goal: string
  recommendedPillarIds: string[]
  notes: string
}

export interface StrategyAnalysis {
  dateGenerated: string
  score: number
  pillarBalance: { pillarId: string; actual: number; target: number }[]
  platformBalance: { platform: Platform; count: number }[]
  facesFrequency: number
  ctaFrequency: number
  proofFrequency: number
  recommendations: GapNote[]
}

export type GapSeverity = 'good' | 'warn' | 'alert'

export interface GapNote {
  severity: GapSeverity
  message: string
  weekIndex?: number
}
