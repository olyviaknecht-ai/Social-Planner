import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { saveBlob } from '../store/blobs'
import { makeThumbnail, cls } from '../lib/ui'
import Thumbnail from '../components/Thumbnail'
import { PillarBadge, PlatformBadge } from '../components/Badges'
import AssetDrawer from '../components/AssetDrawer'
import PostEditor from '../components/PostEditor'
import PageHeader from '../components/PageHeader'
import PeopleManager from '../components/PeopleManager'

export default function Library() {
  const { assets, pillars, posts, people, addAsset, removeAssets, createCarouselPost } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [openAsset, setOpenAsset] = useState<string | null>(null)
  const [openPost, setOpenPost] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [peopleOpen, setPeopleOpen] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    for (const file of Array.from(files)) {
      const fileType = file.type.startsWith('video/') ? 'video' : 'photo'
      const thumb = await makeThumbnail(file)
      const id = addAsset({
        fileType,
        title: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
        thumbnailUrl: thumb,
      })
      await saveBlob(id, file)
    }
    setBusy(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const clearSelection = () => setSelected(new Set())

  const deleteSelected = () => {
    if (confirm(`Delete ${selected.size} item${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) {
      removeAssets(Array.from(selected))
      clearSelection()
    }
  }

  const makeCarousel = () => {
    // Keep selection order stable by filtering assets in display order.
    const ids = assets.filter((a) => selected.has(a.id)).map((a) => a.id)
    const id = createCarouselPost(ids)
    clearSelection()
    setOpenPost(id)
  }

  const scheduledAssetIds = new Set(posts.flatMap((p) => p.assetIds))
  const filtered = assets.filter((a) => {
    if (filter === 'all') return true
    if (filter === 'unscheduled') return !scheduledAssetIds.has(a.id)
    if (filter === 'video') return a.fileType === 'video'
    if (filter === 'time') return a.timeSensitive
    return a.selectedPillarId === filter
  })

  return (
    <div className="p-6 pb-24">
      <PageHeader
        title="Content Library"
        subtitle="Upload Valmer's real photos and videos. The strategist tags each one and suggests where it fits."
        action={
          <button onClick={() => setPeopleOpen(true)} className="btn-outline">
            People{people.length ? ` (${people.length})` : ''}
          </button>
        }
      />

      <div
        className="mb-5 rounded-xl border-2 border-dashed border-valmer-sage/40 bg-white/60 p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleFiles(e.dataTransfer.files)
        }}
      >
        <div className="font-serif text-lg text-valmer-slate">Drop photos or videos here</div>
        <div className="mt-1 text-sm text-valmer-slate/60">team photos, event clips, testimonials, behind-the-scenes, podcast clips, graphics</div>
        <button onClick={() => fileRef.current?.click()} className="btn-primary mt-3" disabled={busy}>
          {busy ? 'Processing…' : 'Choose files'}
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[
          { id: 'all', label: 'All' },
          { id: 'unscheduled', label: 'Unscheduled' },
          { id: 'video', label: 'Video' },
          { id: 'time', label: 'Time-sensitive' },
          ...pillars.map((p) => ({ id: p.id, label: p.title })),
        ].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={cls('chip border', filter === f.id ? 'bg-valmer-slate text-white border-valmer-slate' : 'border-black/15 text-valmer-slate')}>
            {f.label}
          </button>
        ))}
        {filtered.length > 0 && (
          <button
            onClick={() => setSelected(new Set(filtered.map((a) => a.id)))}
            className="ml-auto text-xs text-valmer-slate/60 underline hover:text-valmer-slate"
          >
            Select all
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-black/5 bg-white p-12 text-center text-valmer-slate/50">
          No content yet. Upload a few photos or videos to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((a) => {
            const pillar = pillars.find((p) => p.id === a.selectedPillarId)
            const scheduled = scheduledAssetIds.has(a.id)
            const isSel = selected.has(a.id)
            return (
              <div
                key={a.id}
                className={cls('card relative overflow-hidden text-left transition-shadow hover:shadow-md', isSel && 'ring-2 ring-valmer-sage')}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleSelect(a.id)
                  }}
                  className={cls(
                    'absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border text-xs shadow-sm transition-colors',
                    isSel ? 'border-valmer-sage bg-valmer-sage text-white' : 'border-black/20 bg-white/90 text-transparent hover:text-valmer-slate/40',
                  )}
                  aria-label="Select"
                >
                  ✓
                </button>
                <button onClick={() => setOpenAsset(a.id)} className="block w-full text-left">
                  <Thumbnail asset={a} className="aspect-[4/3] w-full" />
                  <div className="space-y-2 p-3">
                    <div className="truncate text-sm font-medium text-valmer-ink">{a.title}</div>
                    <PillarBadge pillar={pillar} />
                    <div className="flex flex-wrap gap-1">
                      {a.selectedPlatforms.slice(0, 3).map((pl) => (
                        <PlatformBadge key={pl} platform={pl} />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {a.timeSensitive && <span className="chip bg-rose-100 text-rose-700">time-sensitive</span>}
                      {scheduled ? (
                        <span className="chip bg-emerald-100 text-emerald-700">scheduled</span>
                      ) : (
                        <span className="chip bg-gray-100 text-gray-500">unscheduled</span>
                      )}
                      {a.status === 'unusable' && <span className="chip bg-rose-100 text-rose-700">unusable</span>}
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-black/10 bg-white px-4 py-2.5 shadow-xl">
          <span className="text-sm font-medium text-valmer-ink">{selected.size} selected</span>
          <span className="h-4 w-px bg-black/10" />
          <button onClick={makeCarousel} disabled={selected.size < 2} className="btn-primary py-1.5 text-sm disabled:opacity-40" title={selected.size < 2 ? 'Select at least 2 to group' : ''}>
            Group into carousel
          </button>
          <button onClick={deleteSelected} className="btn py-1.5 text-sm text-rose-600 hover:bg-rose-50">
            Delete
          </button>
          <button onClick={clearSelection} className="btn-ghost py-1.5 text-sm">
            Clear
          </button>
        </div>
      )}

      {openAsset && <AssetDrawer assetId={openAsset} onClose={() => setOpenAsset(null)} onOpenPost={(id) => { setOpenAsset(null); setOpenPost(id) }} />}
      {openPost && <PostEditor postId={openPost} onClose={() => setOpenPost(null)} />}
      {peopleOpen && <PeopleManager onClose={() => setPeopleOpen(false)} />}
    </div>
  )
}
