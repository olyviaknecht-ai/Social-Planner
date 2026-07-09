import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format } from 'date-fns'
import { useStore } from '../store/useStore'
import { saveBlob } from '../store/blobs'
import { makeThumbnail, cls } from '../lib/ui'
import { generateCaption } from '../engine/caption'
import { FILTERS, groupAssets, strengthOf } from '../lib/insights'
import type { AssetActionId } from '../lib/insights'
import type { AssetStrength, ContentAsset } from '../types'
import AssetCard from '../components/AssetCard'
import AssetDrawer from '../components/AssetDrawer'
import PostEditor from '../components/PostEditor'
import PageHeader from '../components/PageHeader'
import PeopleManager from '../components/PeopleManager'
import DriveConnect from '../components/DriveConnect'

const STRENGTH_ORDER: Record<AssetStrength, number> = { hero: 0, support: 1, 'needs-context': 2, story: 3, archive: 4 }

export default function Library() {
  const { assets, pillars, posts, people, campaigns, folders, driveFolderId, syncDrive, addAsset, addFolder, removeFolder, addPost, updateAsset, updateAssets, removeAssets, createCarouselPost } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [openAsset, setOpenAsset] = useState<string | null>(null)
  const [openPost, setOpenPost] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [folderFilter, setFolderFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState('recommended')
  const [grouped, setGrouped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [driveOpen, setDriveOpen] = useState(false)

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200) }
  const campaignName = (id?: string) => campaigns.find((c) => c.id === id)?.title

  // Auto-sync a connected Google Drive folder: on open, then every 90s.
  useEffect(() => {
    if (!driveFolderId) return
    let alive = true
    const run = () => syncDrive().then((r) => { if (alive && r.added) flash(`${r.added} new from Google Drive`) }).catch(() => {})
    run()
    const t = setInterval(run, 90000)
    return () => { alive = false; clearInterval(t) }
  }, [driveFolderId])

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    for (const file of Array.from(files)) {
      const fileType = file.type.startsWith('video/') ? 'video' : 'photo'
      const thumb = await makeThumbnail(file)
      const id = addAsset({ fileType, title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), thumbnailUrl: thumb })
      await saveBlob(id, file)
    }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  const clear = () => setSelected(new Set())

  const filterDef = FILTERS.find((f) => f.id === filter) || FILTERS[0]
  const inFolder = (a: ContentAsset) => folderFilter === 'all' || (folderFilter === 'none' ? !a.folderId : a.folderId === folderFilter)
  const filtered = useMemo(
    () => {
      // Recommended: used photos sink to the bottom, then archived, then strongest first.
      const rank = (a: ContentAsset) => (a.status === 'posted' ? 2 : strengthOf(a) === 'archive' ? 1 : 0)
      return assets
        .filter((a) => inFolder(a) && filterDef.test(a, { posts }))
        .sort((a, b) => {
          switch (sortBy) {
            case 'newest': return b.uploadedAt.localeCompare(a.uploadedAt)
            case 'oldest': return a.uploadedAt.localeCompare(b.uploadedAt)
            case 'name': return a.title.localeCompare(b.title)
            case 'name-desc': return b.title.localeCompare(a.title)
            default: return rank(a) - rank(b) || STRENGTH_ORDER[strengthOf(a)] - STRENGTH_ORDER[strengthOf(b)] || b.uploadedAt.localeCompare(a.uploadedAt)
          }
        })
    },
    [assets, filterDef, posts, folderFilter, sortBy],
  )

  // ---- single-asset post creation ----
  const createPost = (a: ContentAsset, opts: { titleSuffix?: string; platforms?: ContentAsset['selectedPlatforms']; date?: string; status?: any; open?: boolean }) => {
    const pillar = pillars.find((p) => p.id === a.selectedPillarId)
    const gen = generateCaption(a, pillar, { people })
    const id = addPost({
      title: `${a.title}${opts.titleSuffix ? ' ' + opts.titleSuffix : ''}`,
      assetIds: [a.id],
      pillarId: a.selectedPillarId,
      campaignId: a.campaignId,
      platforms: opts.platforms || (a.selectedPlatforms.length ? a.selectedPlatforms : a.suggestedPlatforms),
      caption: gen.caption, hook: gen.hook, cta: gen.cta, hashtags: gen.hashtags,
      status: opts.status || 'drafted',
      scheduledDate: opts.date,
    })
    updateAsset(a.id, { status: 'scheduled' })
    if (opts.open) setOpenPost(id)
    return id
  }

  const onAction = (a: ContentAsset, id: AssetActionId) => {
    switch (id) {
      case 'reel': createPost(a, { titleSuffix: '(Reel)', platforms: ['reels', 'tiktok'], open: true }); break
      case 'recap': createPost(a, { titleSuffix: 'recap', open: true }); break
      case 'schedule-next-week': createPost(a, { date: format(addDays(new Date(), 7), 'yyyy-MM-dd'), status: 'scheduled' }); flash('Scheduled for next week'); break
      case 'story-only': updateAsset(a.id, { strength: 'story' }); flash('Marked as story only'); break
      case 'save-future': updateAsset(a.id, { tags: Array.from(new Set([...a.tags, 'future'])) }); flash('Saved for a future campaign'); break
      case 'archive': updateAsset(a.id, { strength: 'archive', status: 'unusable' }); flash('Archived'); break
    }
  }

  // ---- batch actions ----
  const selectedAssets = filtered.filter((a) => selected.has(a.id))
  const ids = selectedAssets.map((a) => a.id)
  const batchCaptions = () => {
    selectedAssets.forEach((a) => createPost(a, {}))
    flash(`${ids.length} captions drafted and added to the calendar`)
    clear()
  }
  const batchSchedule = () => {
    selectedAssets.forEach((a, i) => createPost(a, { date: format(addDays(new Date(), 3 + i * 2), 'yyyy-MM-dd'), status: 'scheduled' }))
    flash(`${ids.length} posts scheduled`)
    clear()
  }
  const batchCarousel = () => { const id = createCarouselPost(ids); clear(); setOpenPost(id) }

  return (
    <div className="p-6 pb-28">
      <PageHeader
        title="Content Library"
        subtitle="What you have, what's strongest, and what to do with it next."
        action={
          <div className="flex gap-2">
            <button onClick={() => setDriveOpen(true)} className="btn-outline">Google Drive</button>
            <button onClick={() => setGrouped((v) => !v)} className={cls('btn-outline', grouped && 'bg-valmer-slate text-white')}>
              {grouped ? 'Grid view' : 'Group by event'}
            </button>
            <button onClick={() => setPeopleOpen(true)} className="btn-outline">People{people.length ? ` (${people.length})` : ''}</button>
          </div>
        }
      />

      <div
        className="mb-5 rounded-xl border-2 border-dashed border-valmer-sage/40 bg-white/60 p-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
      >
        <div className="font-serif text-valmer-slate">Drop photos or videos here</div>
        <button onClick={() => fileRef.current?.click()} className="btn-primary mt-2" disabled={busy}>{busy ? 'Processing…' : 'Choose files'}</button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {/* folders */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-valmer-slate/50">Folders</span>
        <button onClick={() => setFolderFilter('all')} className={cls('chip border', folderFilter === 'all' ? 'bg-valmer-clay text-white border-valmer-clay' : 'border-black/15 text-valmer-slate')}>
          All
        </button>
        {folders.map((f) => {
          const count = assets.filter((a) => a.folderId === f.id).length
          return (
            <button key={f.id} onClick={() => setFolderFilter(f.id)} onDoubleClick={() => { if (confirm(`Delete folder "${f.name}"? Assets stay, just unfiled.`)) removeFolder(f.id) }} className={cls('chip border', folderFilter === f.id ? 'bg-valmer-clay text-white border-valmer-clay' : 'border-black/15 text-valmer-slate')} title="Double-click to delete">
              {f.name} <span className="opacity-50">{count}</span>
            </button>
          )
        })}
        <button onClick={() => setFolderFilter('none')} className={cls('chip border', folderFilter === 'none' ? 'bg-valmer-clay text-white border-valmer-clay' : 'border-black/15 text-valmer-slate/60')}>
          Unfiled
        </button>
        <button onClick={() => { const n = prompt('New folder name'); if (n?.trim()) { const id = addFolder(n.trim()); setFolderFilter(id) } }} className="chip border border-dashed border-black/25 text-valmer-slate/70 hover:bg-black/5">
          + New folder
        </button>
      </div>

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const count = f.id === 'all' ? assets.length : assets.filter((a) => f.test(a, { posts })).length
          return (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cls('chip border', filter === f.id ? 'bg-valmer-slate text-white border-valmer-slate' : 'border-black/15 text-valmer-slate')}>
              {f.label} <span className="opacity-50">{count}</span>
            </button>
          )
        })}
        <div className="ml-auto flex items-center gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-valmer-ink" title="Sort by">
            <option value="recommended">Sort: Recommended</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
        {filtered.length > 0 && (() => {
          const allSelected = filtered.every((a) => selected.has(a.id))
          return (
            <button
              onClick={() => setSelected(allSelected ? new Set() : new Set(filtered.map((a) => a.id)))}
              className="chip border border-valmer-slate/30 text-valmer-slate hover:bg-valmer-slate hover:text-white"
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-current text-[9px]">{allSelected ? '✓' : ''}</span>
              {allSelected ? 'Deselect all' : `Select all ${filtered.length}`}
            </button>
          )
        })()}
        </div>
      </div>

      {toast && <div className="mb-3 rounded-lg bg-valmer-sage/15 px-3 py-2 text-sm text-valmer-sage">{toast}</div>}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-black/5 bg-white p-12 text-center text-valmer-slate/50">No content here. Upload some, or pick a different filter.</div>
      ) : grouped ? (
        <div className="space-y-6">
          {groupAssets(filtered, campaignName).map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-black/5 pb-2">
                <span className={cls('chip text-[10px]', g.kind === 'campaign' ? 'bg-valmer-clay/15 text-valmer-clay' : g.kind === 'event' ? 'bg-valmer-gold/20 text-valmer-gold' : 'bg-gray-100 text-gray-500')}>
                  {g.kind === 'campaign' ? 'Campaign' : g.kind === 'event' ? 'Event' : 'Loose'}
                </span>
                <span className="font-serif text-valmer-ink">{g.label}</span>
                <span className="text-xs text-valmer-slate/50">{g.assets.length} assets</span>
                {g.assets.length >= 2 && g.kind !== 'ungrouped' && (
                  <div className="ml-auto flex gap-2">
                    <button onClick={() => { const id = createCarouselPost(g.assets.map((a) => a.id)); setOpenPost(id) }} className="btn-outline py-1 text-xs">Make sequence (carousel)</button>
                    <button onClick={() => { g.assets.forEach((a) => createPost(a, {})); flash(`${g.assets.length} captions drafted`) }} className="btn-outline py-1 text-xs">Draft all captions</button>
                  </div>
                )}
              </div>
              <Grid assets={g.assets} {...{ posts, pillars, campaignName, selected, toggle, setOpenAsset, onAction }} />
            </div>
          ))}
        </div>
      ) : (
        <Grid assets={filtered} {...{ posts, pillars, campaignName, selected, toggle, setOpenAsset, onAction }} />
      )}

      {/* batch bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-30 flex max-w-[95vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-xl">
          <span className="text-sm font-medium text-valmer-ink">{selected.size} selected</span>
          <span className="h-4 w-px bg-black/10" />
          <select onChange={(e) => { if (e.target.value) { updateAssets(ids, { selectedPillarId: e.target.value }); flash('Pillar assigned'); e.target.value = '' } }} className="rounded-lg border border-black/10 px-2 py-1 text-xs">
            <option value="">Assign pillar…</option>
            {pillars.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <select onChange={(e) => { if (e.target.value) { updateAssets(ids, { campaignId: e.target.value }); flash('Campaign assigned'); e.target.value = '' } }} className="rounded-lg border border-black/10 px-2 py-1 text-xs">
            <option value="">Assign campaign…</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select onChange={(e) => { if (e.target.value) { updateAssets(ids, { folderId: e.target.value === '__none' ? undefined : e.target.value }); flash('Moved to folder'); clear(); e.target.value = '' } }} className="rounded-lg border border-black/10 px-2 py-1 text-xs">
            <option value="">Move to folder…</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            <option value="__none">Remove from folder</option>
          </select>
          <button onClick={batchCaptions} className="btn-primary py-1.5 text-xs">Generate captions</button>
          <button onClick={batchCarousel} disabled={selected.size < 2} className="btn-outline py-1.5 text-xs disabled:opacity-40">Create carousel</button>
          <button onClick={batchSchedule} className="btn-outline py-1.5 text-xs">Schedule</button>
          <button onClick={() => { updateAssets(ids, { status: 'posted' }); flash('Marked as used'); clear() }} className="btn-outline py-1.5 text-xs">Mark used</button>
          <button onClick={() => { updateAssets(ids, { strength: 'archive', status: 'unusable' }); flash('Archived'); clear() }} className="btn-outline py-1.5 text-xs">Archive</button>
          <button onClick={() => { if (confirm(`Delete ${ids.length} photo${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) { removeAssets(ids); flash('Deleted'); clear() } }} className="btn py-1.5 text-xs text-rose-600 hover:bg-rose-50">Delete</button>
          <button onClick={clear} className="btn-ghost py-1.5 text-xs">Clear</button>
        </div>
      )}

      {openAsset && <AssetDrawer assetId={openAsset} onClose={() => setOpenAsset(null)} onOpenPost={(id) => { setOpenAsset(null); setOpenPost(id) }} />}
      {openPost && <PostEditor postId={openPost} onClose={() => setOpenPost(null)} />}
      {peopleOpen && <PeopleManager onClose={() => setPeopleOpen(false)} />}
      {driveOpen && <DriveConnect onClose={() => setDriveOpen(false)} />}
    </div>
  )
}

function Grid({ assets, posts, pillars, campaignName, selected, toggle, setOpenAsset, onAction }: any) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {assets.map((a: ContentAsset) => (
        <AssetCard
          key={a.id}
          asset={a}
          posts={posts}
          pillar={pillars.find((p: any) => p.id === a.selectedPillarId)}
          campaignLabel={campaignName(a.campaignId)}
          selected={selected.has(a.id)}
          onToggle={() => toggle(a.id)}
          onOpen={() => setOpenAsset(a.id)}
          onAction={(id: AssetActionId) => onAction(a, id)}
        />
      ))}
    </div>
  )
}
