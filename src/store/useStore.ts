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
import { api } from '../lib/api'
import type { ApiUser } from '../lib/api'
import { listDriveFolder } from '../lib/drive'

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
  brief: string
  voice: string
  driveFolderId: string
  driveApiKey: string
  dismissedDriveIds: string[]
}
function bucketFrom(s: Bucket): Bucket {
  return { assets: s.assets, pillars: s.pillars, campaigns: s.campaigns, posts: s.posts, weeks: s.weeks, people: s.people, folders: s.folders, metaConfig: s.metaConfig, brief: s.brief, voice: s.voice, driveFolderId: s.driveFolderId, driveApiKey: s.driveApiKey, dismissedDriveIds: s.dismissedDriveIds }
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
  return { assets: [], pillars: [], campaigns: [], posts: [], weeks: [], people: [], folders: DEFAULT_FOLDERS.map((f) => ({ ...f })), metaConfig: freshMeta(), brief: '', voice: '', driveFolderId: '', driveApiKey: '', dismissedDriveIds: [] }
}

interface State {
  // Session / account
  sessionStatus: 'loading' | 'out' | 'in'
  user: ApiUser | null
  authError: string | null
  role: string // my role on the active brand
  members: { email: string; name: string; role: string }[]
  invites: { email: string; role: string }[]
  brandLoading: boolean

  brands: Brand[]
  activeBrandId: string
  assets: ContentAsset[]
  pillars: ContentPillar[]
  campaigns: Campaign[]
  posts: ScheduledPost[]
  weeks: StorylineWeek[]
  people: PersonMemory[]
  folders: Folder[]
  brief: string
  voice: string
  driveFolderId: string
  driveApiKey: string
  dismissedDriveIds: string[]
  aiConfig: AIConfig
  metaConfig: MetaConfig

  setBrief: (brief: string) => void
  setVoice: (voice: string) => void
  setDrive: (patch: { driveFolderId?: string; driveApiKey?: string }) => void
  syncDrive: () => Promise<{ added: number; total: number }>
  initSession: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  loadBrands: () => Promise<void>
  openBrand: (id: string) => Promise<void>
  shareActiveBrand: (email: string, role: string) => Promise<{ status: string; email: string }>
  inviteLink: (role: string) => Promise<string>
  removeAccess: (email: string) => Promise<void>
  loadActivity: () => Promise<{ at: string; summary: string; name: string; email: string }[]>

  addBrand: (name: string) => Promise<void>
  switchBrand: (id: string) => Promise<void>
  renameBrand: (id: string, name: string) => void
  updateBrand: (id: string, patch: Partial<Brand>) => void
  removeBrand: (id: string) => Promise<void>
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

  groupCarousel: (assetIds: string[]) => string
  ungroupCarousel: (carouselId: string) => void
  unscheduleAsset: (assetId: string) => void
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
  clearPosts: () => void
  regenerateCaptionForPost: (id: string) => void
  addEmailVersionToPost: (id: string) => void

  updateWeek: (id: string, patch: Partial<StorylineWeek>) => void

  generatePlan: () => void
  resetAll: () => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      sessionStatus: 'loading',
      user: null,
      authError: null,
      role: 'owner',
      members: [],
      invites: [],
      brandLoading: false,
      brands: [],
      activeBrandId: '',
      assets: [],
      pillars: [],
      campaigns: [],
      posts: [],
      weeks: [],
      people: [],
      folders: DEFAULT_FOLDERS.map((f) => ({ ...f })),
      brief: '',
      voice: '',
      driveFolderId: '',
      driveApiKey: '',
      dismissedDriveIds: [],
      aiConfig: { enabled: false, apiKey: '', model: 'gpt-4o-mini' },
      metaConfig: freshMeta(),

      setBrief: (brief) => set({ brief }),
      setVoice: (voice) => set({ voice }),
      setDrive: (patch) => set(patch),
      syncDrive: async () => {
        const { driveApiKey, driveFolderId } = get()
        if (!driveApiKey.trim() || !driveFolderId.trim()) return { added: 0, total: 0 }
        const files = await listDriveFolder(driveApiKey, driveFolderId)
        const existing = new Set(get().assets.map((a) => a.driveId).filter(Boolean))
        const dismissed = new Set(get().dismissedDriveIds)
        let added = 0
        for (const f of files) {
          if (existing.has(f.id) || dismissed.has(f.id)) continue
          get().addAsset({ fileType: f.mimeType.startsWith('video/') ? 'video' : 'photo', title: f.name.replace(/\.[^.]+$/, ''), driveId: f.id })
          added++
        }
        return { added, total: files.length }
      },
      initSession: async () => {
        try {
          const { user } = await api.me()
          set({ sessionStatus: 'in', user, authError: null })
          await afterAuth(get)
        } catch {
          set({ sessionStatus: 'out', user: null })
        }
      },
      login: async (email, password) => {
        set({ authError: null })
        try {
          const { user } = await api.login(email, password)
          set({ sessionStatus: 'in', user })
          await afterAuth(get)
        } catch (e: any) {
          set({ authError: e?.message || 'Login failed' })
          throw e
        }
      },
      signup: async (email, password, name) => {
        set({ authError: null })
        try {
          const { user } = await api.signup(email, password, name)
          set({ sessionStatus: 'in', user })
          await afterAuth(get)
        } catch (e: any) {
          set({ authError: e?.message || 'Sign up failed' })
          throw e
        }
      },
      logout: async () => {
        markSaved('') // stop autosave from firing on the cleared state
        try { await api.logout() } catch { /* ignore */ }
        set({ sessionStatus: 'out', user: null, brands: [], activeBrandId: '', ...freshBucket(), pillars: [] })
      },

      loadBrands: async () => {
        const { brands } = await api.listBrands()
        // First login with nothing on the server: seed one brand from local content
        // if we have any, otherwise a blank one, so the user always lands somewhere.
        if (!brands.length) {
          const local = localImportBucket()
          const created = await api.createBrand(local ? local.name : 'My Brand', local ? local.bucket : freshBucket())
          await get().loadBrands()
          await get().openBrand(created.id)
          return
        }
        set({ brands: brands.map((b) => ({ id: b.id, name: b.name })) })
        const active = get().activeBrandId && brands.some((b) => b.id === get().activeBrandId) ? get().activeBrandId : brands[0].id
        await get().openBrand(active)
      },
      openBrand: async (id) => {
        const data = await api.getBrand(id)
        let bucket = freshBucket()
        try {
          const parsed = data.content ? JSON.parse(data.content) : null
          if (parsed && typeof parsed === 'object') bucket = { ...bucket, ...parsed }
        } catch { /* keep fresh */ }
        set({ activeBrandId: id, role: data.role, members: data.members || [], invites: data.invites || [], ...bucket })
        markSaved(JSON.stringify(bucketFrom(get())))
      },

      shareActiveBrand: async (email, role) => {
        const res = await api.shareBrand(get().activeBrandId, email, role)
        const data = await api.getBrand(get().activeBrandId).catch(() => null)
        if (data) set({ members: data.members || [], invites: data.invites || [] })
        return res
      },
      inviteLink: async (role) => {
        const { token } = await api.createInviteLink(get().activeBrandId, role)
        return `${window.location.origin}/#/join/${token}`
      },
      removeAccess: async (email) => {
        await api.unshareBrand(get().activeBrandId, email)
        const data = await api.getBrand(get().activeBrandId).catch(() => null)
        if (data) set({ members: data.members || [], invites: data.invites || [] })
      },
      loadActivity: async () => (await api.activity(get().activeBrandId)).activity,

      addBrand: async (name) => {
        const created = await api.createBrand(name.trim() || 'New brand', freshBucket())
        await get().loadBrands()
        await get().openBrand(created.id)
      },
      switchBrand: async (id) => {
        if (id === get().activeBrandId) return
        set({ brandLoading: true })
        // Save the current brand in the background (snapshot is captured synchronously),
        // so the switch only waits on loading the next brand, not uploading this one.
        flushSave()
        try {
          await get().openBrand(id)
        } finally {
          set({ brandLoading: false })
        }
      },
      renameBrand: (id, name) => {
        set((s) => ({ brands: s.brands.map((b) => (b.id === id ? { ...b, name } : b)) }))
        api.renameBrand(id, name).catch(() => {})
      },
      updateBrand: (id, patch) => set((s) => ({ brands: s.brands.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      setPillars: (pillars) => set({ pillars }),
      removeBrand: async (id) => {
        if (get().brands.length <= 1) return
        await api.deleteBrand(id).catch(() => {})
        await get().loadBrands()
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
          driveId: a.driveId,
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
        set((s) => {
          const a = s.assets.find((x) => x.id === id)
          const dismissed = a?.driveId ? Array.from(new Set([...s.dismissedDriveIds, a.driveId])) : s.dismissedDriveIds
          return {
            assets: s.assets.filter((x) => x.id !== id),
            posts: s.posts.map((p) => ({ ...p, assetIds: p.assetIds.filter((x) => x !== id) })),
            dismissedDriveIds: dismissed,
          }
        })
      },

      removeAssets: (ids) => {
        const idset = new Set(ids)
        ids.forEach(removeBlob)
        set((s) => {
          const drive = s.assets.filter((a) => idset.has(a.id) && a.driveId).map((a) => a.driveId!)
          return {
            assets: s.assets.filter((a) => !idset.has(a.id)),
            posts: s.posts.map((p) => ({ ...p, assetIds: p.assetIds.filter((x) => !idset.has(x)) })),
            dismissedDriveIds: Array.from(new Set([...s.dismissedDriveIds, ...drive])),
          }
        })
      },

      addPerson: (p) => {
        const id = uid('person')
        set((s) => ({ people: [...s.people, { id, name: p?.name || '', role: p?.role || '', notes: p?.notes || '' }] }))
        return id
      },
      updatePerson: (id, patch) =>
        set((s) => ({ people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      removePerson: (id) => set((s) => ({ people: s.people.filter((p) => p.id !== id) })),

      groupCarousel: (assetIds) => {
        const cid = uid('carousel')
        const idset = new Set(assetIds)
        set((s) => ({ assets: s.assets.map((a) => (idset.has(a.id) ? { ...a, carouselId: cid } : a)) }))
        return cid
      },

      ungroupCarousel: (carouselId) =>
        set((s) => ({ assets: s.assets.map((a) => (a.carouselId === carouselId ? { ...a, carouselId: undefined } : a)) })),

      // Remove the calendar post(s) that use this asset and send the freed photos back to the library.
      unscheduleAsset: (assetId) =>
        set((s) => {
          const kill = new Set(s.posts.filter((p) => p.assetIds.includes(assetId)).map((p) => p.id))
          if (!kill.size) return {}
          const freed = new Set<string>()
          s.posts.forEach((p) => { if (kill.has(p.id)) p.assetIds.forEach((id) => freed.add(id)) })
          return {
            posts: s.posts.filter((p) => !kill.has(p.id)),
            assets: s.assets.map((a) => (freed.has(a.id) && a.status === 'scheduled' ? { ...a, status: 'unused' } : a)),
          }
        }),

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

      clearPosts: () =>
        set((s) => ({
          posts: [],
          // Freed-up assets go back to being options in the library.
          assets: s.assets.map((a) => (a.status === 'scheduled' ? { ...a, status: 'unused' } : a)),
        })),

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
        const fresh = stale ? buildStoryline(undefined, pillars) : weeks
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
        set({ ...freshBucket() }),
    }),
    {
      name: 'valmer-storyboard',
      // Only the AI key/settings stay on this device now; all brand content lives
      // on the server so it syncs across computers and shared users.
      partialize: (s) => ({ aiConfig: s.aiConfig }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<State>
        return { ...current, aiConfig: { ...current.aiConfig, ...(p.aiConfig || {}) } }
      },
    },
  ),
)

// ---- Server sync: autosave the active brand's content (debounced) ----
let lastSaved = ''
let saveTimer: ReturnType<typeof setTimeout> | null = null

function markSaved(snap: string) {
  lastSaved = snap
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
}

async function flushSave() {
  const s = useStore.getState()
  if (s.sessionStatus !== 'in' || !s.activeBrandId || s.role === 'viewer') return
  const snap = JSON.stringify(bucketFrom(s))
  if (snap === lastSaved) return
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  lastSaved = snap
  try { await api.saveBrand(s.activeBrandId, JSON.parse(snap), 'edited') } catch { /* offline */ }
}

useStore.subscribe((s) => {
  if (s.sessionStatus !== 'in' || !s.activeBrandId || s.role === 'viewer') return
  const snap = JSON.stringify(bucketFrom(s))
  if (snap === lastSaved) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    lastSaved = snap
    api.saveBrand(s.activeBrandId, JSON.parse(snap), 'edited').catch(() => {})
  }, 1000)
})

// One-time import of any pre-existing local content, captured before persist rewrites it.
const legacyRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('valmer-storyboard') : null
function localImportBucket(): { name: string; bucket: Bucket } | null {
  try {
    if (!legacyRaw) return null
    const st = JSON.parse(legacyRaw).state
    if (!st || !st.assets) return null
    const bucket: Bucket = {
      assets: st.assets || [], pillars: st.pillars || [], campaigns: st.campaigns || [], posts: st.posts || [],
      weeks: st.weeks || [], people: st.people || [], folders: st.folders || DEFAULT_FOLDERS, metaConfig: st.metaConfig || freshMeta(), brief: st.brief || '', voice: st.voice || '', driveFolderId: st.driveFolderId || '', driveApiKey: st.driveApiKey || '', dismissedDriveIds: st.dismissedDriveIds || [],
    }
    if (!bucket.assets.length && !bucket.pillars.length && !bucket.posts.length) return null
    const name = (st.brands && st.brands.find((b: Brand) => b.id === st.activeBrandId)?.name) || 'My Brand'
    return { name, bucket }
  } catch {
    return null
  }
}

// If the app was opened from an invite link (#/join/<token>), stash the token and
// clean the URL so the router doesn't choke on it.
try {
  const m = window.location.hash.match(/#\/join\/([a-z0-9]+)/i)
  if (m) {
    localStorage.setItem('pendingJoin', m[1])
    window.location.hash = '#/calendar'
  }
} catch { /* ignore */ }

// After any successful auth: claim a pending invite, then load brands (opening the
// just-joined brand if there was one).
async function afterAuth(get: () => State) {
  let joined: string | null = null
  const token = localStorage.getItem('pendingJoin')
  if (token) {
    try { joined = (await api.acceptInvite(token)).brandId } catch { /* invalid/expired */ }
    localStorage.removeItem('pendingJoin')
  }
  await get().loadBrands()
  if (joined) await get().openBrand(joined)
}

// Kick off session check on load.
useStore.getState().initSession()

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
  if (a.fileType === 'video') return ['reels', 'tiktok', 'youtube', 'facebook']
  const t = a.analysis?.contentType
  if (t === 'testimonial' || t === 'event') return ['instagram', 'facebook', 'email']
  return ['instagram', 'facebook']
}
