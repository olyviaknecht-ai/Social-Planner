import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AIConfig,
  Brand,
  Campaign,
  ContentAsset,
  ContentPillar,
  Folder,
  MetaConfig,
  PersonMemory,
  ScheduledPost,
  StorylineWeek,
} from '../types'
import { SEED_PILLARS } from '../data/seed'
import { analyzeAsset } from '../engine/analyze'
import { buildSchedule, buildStoryline } from '../engine/planner'
import { generateCaption, generateEmail } from '../engine/caption'
import { removeBlob } from './blobs'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// ---- Per-brand content buckets ----
// The flat top-level state (assets, pillars, posts…) is always the ACTIVE brand's
// content. Other brands' content lives in their own localStorage keys and is
// swapped in on switch. This keeps every screen working unchanged.
const DEFAULT_FOLDERS: Folder[] = [
  { id: 'f-events', name: 'Events' },
  { id: 'f-headshots', name: 'Headshots' },
  { id: 'f-team', name: 'Team' },
  { id: 'f-community', name: 'Community' },
]
const freshMeta = (): MetaConfig => ({ appId: '', configId: '', pageId: '', pageToken: '', pageName: '', igUserId: '' })
const BRAND_KEY = (id: string) => `valmer-brand-${id}`

interface Bucket {
  assets: ContentAsset[]
  pillars: ContentPillar[]
  campaigns: Campaign[]
  posts: ScheduledPost[]
  weeks: StorylineWeek[]
  people: PersonMemory[]
  folders: Folder[]
  metaConfig: MetaConfig
}
function bucketFrom(s: Bucket): Bucket {
  return { assets: s.assets, pillars: s.pillars, campaigns: s.campaigns, posts: s.posts, weeks: s.weeks, people: s.people, folders: s.folders, metaConfig: s.metaConfig }
}
function saveBucket(id: string, s: Bucket) {
  try { localStorage.setItem(BRAND_KEY(id), JSON.stringify(bucketFrom(s))) } catch { /* quota */ }
}
function loadBucket(id: string): Bucket | null {
  try { const r = localStorage.getItem(BRAND_KEY(id)); return r ? JSON.parse(r) : null } catch { return null }
}
// A brand-new brand is a blank slate — no pillars or storyline carry over.
// Onboarding (ChatGPT) builds the pillars; "Generate plan" builds the storyline.
function freshBucket(): Bucket {
  return { assets: [], pillars: [], campaigns: [], posts: [], weeks: [], people: [], folders: DEFAULT_FOLDERS.map((f) => ({ ...f })), metaConfig: freshMeta() }
}

interface State {
  brands: Brand[]
  activeBrandId: string
  assets: ContentAsset[]
  pillars: ContentPillar[]
  campaigns: Campaign[]
  posts: ScheduledPost[]
  weeks: StorylineWeek[]
  people: PersonMemory[]
  folders: Folder[]
  aiConfig: AIConfig
  metaConfig: MetaConfig

  addBrand: (name: string) => string
  switchBrand: (id: string) => void
  renameBrand: (id: string, name: string) => void
  updateBrand: (id: string, patch: Partial<Brand>) => void
  removeBrand: (id: string) => void
  setPillars: (pillars: ContentPillar[]) => void

  addFolder: (name: string) => string
  renameFolder: (id: string, name: string) => void
  removeFolder: (id: string) => void

  setAIConfig: (patch: Partial<AIConfig>) => void
  setMetaConfig: (patch: Partial<MetaConfig>) => void

  addAsset: (a: Partial<ContentAsset> & { fileType: ContentAsset['fileType'] }) => string
  updateAsset: (id: string, patch: Partial<ContentAsset>) => void
  updateAssets: (ids: string[], patch: Partial<ContentAsset>) => void
  removeAsset: (id: string) => void
  removeAssets: (ids: string[]) => void
  reanalyzeAsset: (id: string) => void

  addPerson: (p?: Partial<PersonMemory>) => string
  updatePerson: (id: string, patch: Partial<PersonMemory>) => void
  removePerson: (id: string) => void

  createCarouselPost: (assetIds: string[]) => string
  repromptCaption: (postId: string, guidance: string) => void

  addPillar: (p?: Partial<ContentPillar>) => void
  updatePillar: (id: string, patch: Partial<ContentPillar>) => void
  removePillar: (id: string) => void

  addCampaign: (c: Partial<Campaign> & { title: string }) => string
  updateCampaign: (id: string, patch: Partial<Campaign>) => void
  removeCampaign: (id: string) => void
  attachAssetToCampaign: (assetId: string, campaignId: string) => void

  addPost: (p?: Partial<ScheduledPost>) => string
  updatePost: (id: string, patch: Partial<ScheduledPost>) => void
  removePost: (id: string) => void
  regenerateCaptionForPost: (id: string) => void
  addEmailVersionToPost: (id: string) => void

  updateWeek: (id: string, patch: Partial<StorylineWeek>) => void

  generatePlan: () => void
  resetAll: () => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      brands: [{ id: 'brand-1', name: 'Valmer Land Title' }],
      activeBrandId: 'brand-1',
      assets: [],
      pillars: SEED_PILLARS,
      campaigns: [],
      posts: [],
      weeks: buildStoryline(),
      people: [],
      folders: DEFAULT_FOLDERS.map((f) => ({ ...f })),
      aiConfig: { enabled: false, apiKey: '', model: 'gpt-4o-mini' },
      metaConfig: freshMeta(),

      addBrand: (name) => {
        const s = get()
        saveBucket(s.activeBrandId, s)
        const id = uid('brand')
        const b = freshBucket()
        saveBucket(id, b)
        set({ brands: [...s.brands, { id, name: name.trim() || 'New brand' }], activeBrandId: id, ...b })
        return id
      },
      switchBrand: (id) => {
        const s = get()
        if (id === s.activeBrandId) return
        saveBucket(s.activeBrandId, s)
        const b = loadBucket(id) || freshBucket()
        set({ activeBrandId: id, ...b })
      },
      renameBrand: (id, name) => set((s) => ({ brands: s.brands.map((b) => (b.id === id ? { ...b, name } : b)) })),
      updateBrand: (id, patch) => set((s) => ({ brands: s.brands.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      setPillars: (pillars) => set({ pillars }),
      removeBrand: (id) => {
        const s = get()
        if (s.brands.length <= 1) return
        try { localStorage.removeItem(BRAND_KEY(id)) } catch { /* ignore */ }
        const remaining = s.brands.filter((b) => b.id !== id)
        if (id === s.activeBrandId) {
          const next = remaining[0]
          const b = loadBucket(next.id) || freshBucket()
          set({ brands: remaining, activeBrandId: next.id, ...b })
        } else {
          set({ brands: remaining })
        }
      },

      addFolder: (name) => {
        const id = uid('folder')
        set((s) => ({ folders: [...s.folders, { id, name: name.trim() || 'New folder' }] }))
        return id
      },
      renameFolder: (id, name) => set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),
      removeFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          assets: s.assets.map((a) => (a.folderId === id ? { ...a, folderId: undefined } : a)),
        })),

      setAIConfig: (patch) => set((s) => ({ aiConfig: { ...s.aiConfig, ...patch } })),
      setMetaConfig: (patch) => set((s) => ({ metaConfig: { ...s.metaConfig, ...patch } })),

      addAsset: (a) => {
        const id = uid('asset')
        const base: ContentAsset = {
          id,
          fileUrl: a.fileUrl,
          thumbnailUrl: a.thumbnailUrl,
          fileType: a.fileType,
          uploadedAt: new Date().toISOString(),
          title: a.title || 'Untitled upload',
          notes: a.notes || '',
          people: a.people || '',
          location: a.location || '',
          event: a.event || '',
          campaignId: a.campaignId,
          tags: a.tags || [],
          suggestedPillars: [],
          selectedPillarId: a.selectedPillarId,
          suggestedPlatforms: [],
          selectedPlatforms: a.selectedPlatforms || [],
          timeSensitive: a.timeSensitive ?? false,
          expirationDate: a.expirationDate,
          hasCta: a.hasCta ?? false,
          ctaNote: a.ctaNote || '',
          serviceToMention: a.serviceToMention || '',
          peopleToTag: a.peopleToTag || '',
          captionIdea: a.captionIdea || '',
          status: 'unused',
        }
        base.analysis = analyzeAsset(base)
        base.suggestedPillars = suggestedPillarsFor(base)
        base.suggestedPlatforms = suggestedPlatformsFor(base)
        if (!base.selectedPillarId) base.selectedPillarId = base.suggestedPillars[0]
        if (base.selectedPlatforms.length === 0) base.selectedPlatforms = base.suggestedPlatforms
        set((s) => ({ assets: [base, ...s.assets] }))
        return id
      },

      updateAsset: (id, patch) =>
        set((s) => ({ assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),

      updateAssets: (ids, patch) => {
        const idset = new Set(ids)
        set((s) => ({ assets: s.assets.map((a) => (idset.has(a.id) ? { ...a, ...patch } : a)) }))
      },

      removeAsset: (id) => {
        removeBlob(id)
        set((s) => ({
          assets: s.assets.filter((a) => a.id !== id),
          posts: s.posts.map((p) => ({ ...p, assetIds: p.assetIds.filter((x) => x !== id) })),
        }))
      },

      removeAssets: (ids) => {
        const idset = new Set(ids)
        ids.forEach(removeBlob)
        set((s) => ({
          assets: s.assets.filter((a) => !idset.has(a.id)),
          posts: s.posts.map((p) => ({ ...p, assetIds: p.assetIds.filter((x) => !idset.has(x)) })),
        }))
      },

      addPerson: (p) => {
        const id = uid('person')
        set((s) => ({ people: [...s.people, { id, name: p?.name || '', role: p?.role || '', notes: p?.notes || '' }] }))
        return id
      },
      updatePerson: (id, patch) =>
        set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePerson: (id) => set((s) => ({ people: s.people.filter((p) => p.id !== id) })),

      createCarouselPost: (assetIds) => {
        const id = uid('post')
        const { assets, pillars, people } = get()
        const lead = assets.find((a) => a.id === assetIds[0])
        const pillar = pillars.find((p) => p.id === lead?.selectedPillarId)
        const gen = lead ? generateCaption(lead, pillar, { people, carousel: true }) : { caption: '', hook: '', cta: '', hashtags: '' }
        const platforms = lead?.selectedPlatforms?.length ? lead.selectedPlatforms : (['instagram', 'facebook'] as ScheduledPost['platforms'])
        set((s) => ({
          posts: [
            ...s.posts,
            {
              id,
              scheduledDate: new Date().toISOString().slice(0, 10),
              platforms,
              pillarId: lead?.selectedPillarId,
              campaignId: lead?.campaignId,
              assetIds: [...assetIds],
              title: lead ? `${lead.title} (carousel)` : 'Carousel',
              caption: gen.caption,
              hook: gen.hook,
              cta: gen.cta,
              hashtags: gen.hashtags,
              altText: '',
              emailSubject: '',
              emailPreview: '',
              emailBody: '',
              overlayIdeas: '',
              notes: '',
              promptNotes: '',
              format: 'carousel',
              status: 'drafted',
              optional: false,
              phase: 1,
            },
          ],
          assets: s.assets.map((a) => (idset(assetIds).has(a.id) && a.status === 'unused' ? { ...a, status: 'scheduled' } : a)),
        }))
        return id
      },

      repromptCaption: (postId, guidance) =>
        set((s) => {
          const post = s.posts.find((p) => p.id === postId)
          if (!post) return {}
          const asset = s.assets.find((a) => post.assetIds.includes(a.id))
          if (!asset) return {}
          const pillar = s.pillars.find((p) => p.id === post.pillarId)
          const gen = generateCaption(asset, pillar, { people: s.people, guidance, carousel: post.format === 'carousel' })
          return {
            posts: s.posts.map((p) =>
              p.id === postId ? { ...p, caption: gen.caption, hook: gen.hook, cta: gen.cta, hashtags: gen.hashtags, promptNotes: guidance } : p,
            ),
          }
        }),

      reanalyzeAsset: (id) =>
        set((s) => ({
          assets: s.assets.map((a) => {
            if (a.id !== id) return a
            const analysis = analyzeAsset(a)
            return {
              ...a,
              analysis,
              suggestedPillars: suggestedPillarsFor({ ...a, analysis }),
              suggestedPlatforms: suggestedPlatformsFor({ ...a, analysis }),
            }
          }),
        })),

      addPillar: (p) =>
        set((s) => ({
          pillars: [
            ...s.pillars,
            {
              id: uid('pillar'),
              title: p?.title || 'New Pillar',
              description: p?.description || '',
              color: p?.color || '#7a6cae',
              goal: p?.goal || '',
              active: true,
              targetShare: p?.targetShare ?? 0.1,
            },
          ],
        })),

      updatePillar: (id, patch) =>
        set((s) => ({ pillars: s.pillars.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      removePillar: (id) =>
        set((s) => ({ pillars: s.pillars.filter((p) => p.id !== id) })),

      addCampaign: (c) => {
        const id = uid('camp')
        set((s) => ({
          campaigns: [
            ...s.campaigns,
            {
              id,
              title: c.title,
              goal: c.goal || '',
              startDate: c.startDate || new Date().toISOString().slice(0, 10),
              endDate: c.endDate || new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10),
              status: c.status || 'planning',
              color: c.color || '#c0714f',
              beats: c.beats || [],
            },
          ],
        }))
        return id
      },

      updateCampaign: (id, patch) =>
        set((s) => ({ campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      removeCampaign: (id) =>
        set((s) => ({
          campaigns: s.campaigns.filter((c) => c.id !== id),
          assets: s.assets.map((a) => (a.campaignId === id ? { ...a, campaignId: undefined } : a)),
          posts: s.posts.map((p) => (p.campaignId === id ? { ...p, campaignId: undefined } : p)),
        })),

      attachAssetToCampaign: (assetId, campaignId) =>
        set((s) => ({
          assets: s.assets.map((a) => (a.id === assetId ? { ...a, campaignId } : a)),
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId && !c.beats.some((b) => b.assetIds.includes(assetId))
              ? c
              : c,
          ),
        })),

      addPost: (p) => {
        const id = uid('post')
        set((s) => ({
          posts: [
            ...s.posts,
            {
              id,
              scheduledDate: p?.scheduledDate || new Date().toISOString().slice(0, 10),
              platforms: p?.platforms || ['instagram'],
              pillarId: p?.pillarId,
              campaignId: p?.campaignId,
              assetIds: p?.assetIds || [],
              title: p?.title || 'New post',
              caption: p?.caption || '',
              hook: p?.hook || '',
              cta: p?.cta || '',
              hashtags: p?.hashtags || '',
              altText: p?.altText || '',
              emailSubject: p?.emailSubject || '',
              emailPreview: p?.emailPreview || '',
              emailBody: p?.emailBody || '',
              overlayIdeas: p?.overlayIdeas || '',
              notes: p?.notes || '',
              promptNotes: p?.promptNotes || '',
              format: p?.format,
              status: p?.status || 'idea',
              optional: p?.optional ?? false,
              phase: p?.phase ?? 1,
            },
          ],
        }))
        return id
      },

      updatePost: (id, patch) =>
        set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      removePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),

      regenerateCaptionForPost: (id) =>
        set((s) => {
          const post = s.posts.find((p) => p.id === id)
          if (!post) return {}
          const asset = s.assets.find((a) => post.assetIds.includes(a.id))
          if (!asset) return {}
          const pillar = s.pillars.find((p) => p.id === post.pillarId)
          const gen = generateCaption(asset, pillar, { people: s.people, guidance: post.promptNotes, carousel: post.format === 'carousel' })
          return {
            posts: s.posts.map((p) =>
              p.id === id ? { ...p, caption: gen.caption, hook: gen.hook, cta: gen.cta, hashtags: gen.hashtags } : p,
            ),
          }
        }),

      addEmailVersionToPost: (id) =>
        set((s) => {
          const post = s.posts.find((p) => p.id === id)
          if (!post) return {}
          const asset = s.assets.find((a) => post.assetIds.includes(a.id))
          const pillar = s.pillars.find((p) => p.id === post.pillarId)
          const email = asset
            ? generateEmail(asset, pillar, { people: s.people, guidance: post.promptNotes })
            : { subject: post.title, preview: post.hook, body: post.caption, cta: 'Learn more' }
          return {
            posts: s.posts.map((p) =>
              p.id === id
                ? {
                    ...p,
                    platforms: uniq([...p.platforms, 'email']) as ScheduledPost['platforms'],
                    emailSubject: email.subject,
                    emailPreview: email.preview,
                    emailBody: email.body,
                  }
                : p,
            ),
          }
        }),

      updateWeek: (id, patch) =>
        set((s) => ({ weeks: s.weeks.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),

      generatePlan: () => {
        const { weeks, assets, pillars, people } = get()
        // Anchor to real upcoming dates: rebuild the arc if it is missing, starts in
        // the past, or is not aligned to a Monday (stale data from an older version).
        const today = new Date().toISOString().slice(0, 10)
        const startsMonday = weeks.length && new Date(weeks[0].weekStart).getUTCDay() === 1
        const stale = !weeks.length || weeks[0].weekStart < today || !startsMonday
        const fresh = stale ? buildStoryline() : weeks
        const posts = buildSchedule(fresh, assets, pillars, people)
        const usedIds = new Set(posts.flatMap((p) => p.assetIds))
        set((s) => ({
          weeks: fresh,
          posts,
          assets: s.assets.map((a) =>
            usedIds.has(a.id) && a.status === 'unused' ? { ...a, status: 'scheduled' } : a,
          ),
        }))
      },

      resetAll: () =>
        set({ assets: [], pillars: SEED_PILLARS, campaigns: [], posts: [], weeks: buildStoryline(), people: [] }),
    }),
    {
      name: 'valmer-storyboard',
      partialize: (s) => ({
        brands: s.brands,
        activeBrandId: s.activeBrandId,
        assets: s.assets,
        pillars: s.pillars,
        campaigns: s.campaigns,
        posts: s.posts,
        weeks: s.weeks,
        people: s.people,
        folders: s.folders,
        aiConfig: s.aiConfig,
        metaConfig: s.metaConfig,
      }),
      // Deep-merge nested config objects so new fields added in updates get their
      // defaults instead of being dropped by the default shallow merge.
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<State>
        // Existing single-workspace users: fold their content into a first brand.
        const brands = p.brands && p.brands.length ? p.brands : [{ id: 'brand-1', name: 'Valmer Land Title' }]
        const activeBrandId = p.activeBrandId && brands.some((b) => b.id === p.activeBrandId) ? p.activeBrandId : brands[0].id
        // Refresh default pillar colors to the new palette, but only where the user
        // hasn't customized them (i.e. the stored color is the old default).
        const OLD: Record<string, string> = {
          people: '#c0714f', growth: '#5b7c6f', events: '#c79a4b', proof: '#7a6cae',
          community: '#4a8db5', tools: '#3f7d7a', closing: '#9c5d6b',
        }
        const pillars = (p.pillars || current.pillars).map((pl) => {
          const fresh = SEED_PILLARS.find((s) => s.id === pl.id)
          return fresh && OLD[pl.id] === pl.color ? { ...pl, color: fresh.color } : pl
        })
        return {
          ...current,
          ...p,
          brands,
          activeBrandId,
          pillars,
          aiConfig: { ...current.aiConfig, ...(p.aiConfig || {}) },
          metaConfig: { ...current.metaConfig, ...(p.metaConfig || {}) },
        }
      },
    },
  ),
)

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function idset(arr: string[]): Set<string> {
  return new Set(arr)
}

function suggestedPillarsFor(a: ContentAsset): string[] {
  const map: Record<string, string> = {
    team: 'people',
    'behind-the-scenes': 'people',
    headshot: 'growth',
    testimonial: 'proof',
    event: 'events',
    community: 'community',
    sponsor: 'community',
    closing: 'closing',
    tool: 'tools',
    podcast: 'growth',
    'short-clip': 'people',
    graphic: 'growth',
  }
  const primary = a.analysis ? map[a.analysis.contentType] : 'people'
  return uniq([primary, 'people', 'proof']).slice(0, 3)
}

function suggestedPlatformsFor(a: ContentAsset): ContentAsset['suggestedPlatforms'] {
  if (a.fileType === 'video') return ['reels', 'tiktok', 'facebook']
  const t = a.analysis?.contentType
  if (t === 'testimonial' || t === 'event') return ['instagram', 'facebook', 'email']
  return ['instagram', 'facebook']
}
