import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { useStore } from '../store/useStore'
import type { ContentAsset, ContentPillar } from '../types'
import Thumbnail from '../components/Thumbnail'
import AssetDrawer from '../components/AssetDrawer'
import PostEditor from '../components/PostEditor'
import PageHeader from '../components/PageHeader'
import { cls } from '../lib/ui'

export default function PillarBoard() {
  const { assets, pillars, posts, updateAsset, updatePillar, removePillar, addPillar } = useStore()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [dragId, setDragId] = useState<string | null>(null)
  const [openAsset, setOpenAsset] = useState<string | null>(null)
  const [openPost, setOpenPost] = useState<string | null>(null)

  const scheduled = new Set(posts.flatMap((p) => p.assetIds))
  const usable = assets.filter((a) => a.status !== 'unusable')

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null)
    if (e.over) {
      const pillarId = String(e.over.id).replace('pillar-', '')
      updateAsset(String(e.active.id), { selectedPillarId: pillarId === 'unassigned' ? undefined : pillarId })
    }
  }

  const dragAsset = assets.find((a) => a.id === dragId)

  return (
    <div className="p-6">
      <PageHeader
        title="Pillar Board"
        subtitle="Drag content between pillars. Rename, retarget, or add pillars. Watch the gaps."
        action={<button onClick={() => addPillar()} className="btn-outline">+ Add pillar</button>}
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pillars.map((p) => {
            const items = usable.filter((a) => a.selectedPillarId === p.id)
            return (
              <PillarColumn
                key={p.id}
                pillar={p}
                count={items.length}
                scheduledCount={items.filter((a) => scheduled.has(a.id)).length}
                onUpdate={(patch) => updatePillar(p.id, patch)}
                onRemove={() => removePillar(p.id)}
              >
                {items.map((a) => (
                  <AssetChip key={a.id} asset={a} scheduled={scheduled.has(a.id)} onOpen={() => setOpenAsset(a.id)} />
                ))}
                {items.length === 0 && <Gap pillar={p} />}
              </PillarColumn>
            )
          })}
          <PillarColumn pillar={{ id: 'unassigned', title: 'Unassigned', color: '#94a3b8', description: '', goal: '', active: true, targetShare: 0 }} count={usable.filter((a) => !a.selectedPillarId).length} scheduledCount={0} plain>
            {usable.filter((a) => !a.selectedPillarId).map((a) => (
              <AssetChip key={a.id} asset={a} scheduled={scheduled.has(a.id)} onOpen={() => setOpenAsset(a.id)} />
            ))}
          </PillarColumn>
        </div>

        <DragOverlay>
          {dragAsset && (
            <div className="card flex items-center gap-2 p-2 shadow-lg">
              <Thumbnail asset={dragAsset} className="h-9 w-9 rounded" />
              <span className="text-sm">{dragAsset.title}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {openAsset && <AssetDrawer assetId={openAsset} onClose={() => setOpenAsset(null)} onOpenPost={(id) => { setOpenAsset(null); setOpenPost(id) }} />}
      {openPost && <PostEditor postId={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  )
}

function PillarColumn({
  pillar,
  count,
  scheduledCount,
  children,
  onUpdate,
  onRemove,
  plain,
}: {
  pillar: ContentPillar
  count: number
  scheduledCount: number
  children: React.ReactNode
  onUpdate?: (patch: Partial<ContentPillar>) => void
  onRemove?: () => void
  plain?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `pillar-${pillar.id}` })
  const [editing, setEditing] = useState(false)
  return (
    <div
      ref={setNodeRef}
      className={cls('flex w-72 shrink-0 flex-col rounded-xl border bg-white/70 p-3 transition-colors', isOver ? 'border-valmer-sage bg-valmer-sage/10' : 'border-black/5')}
    >
      <div className="mb-2 flex items-start justify-between gap-2 border-b border-black/5 pb-2" style={{ borderColor: pillar.color + '33' }}>
        <div className="min-w-0">
          {editing && onUpdate ? (
            <input
              autoFocus
              defaultValue={pillar.title}
              onBlur={(e) => { onUpdate({ title: e.target.value }); setEditing(false) }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              className="input py-1 text-sm"
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: pillar.color }} />
              <button onClick={() => onUpdate && setEditing(true)} className="truncate text-sm font-semibold text-valmer-ink">{pillar.title}</button>
            </div>
          )}
          {!plain && <div className="mt-0.5 text-[11px] text-valmer-slate/50">{count} items · {scheduledCount} scheduled</div>}
        </div>
        {onRemove && !plain && (
          <div className="flex items-center gap-1">
            <span className="chip bg-black/5 text-[10px] text-valmer-slate/60">{Math.round(pillar.targetShare * 100)}%</span>
            <button onClick={onRemove} className="text-valmer-slate/30 hover:text-rose-500">✕</button>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto" style={{ minHeight: 80 }}>
        {children}
      </div>
    </div>
  )
}

function AssetChip({ asset, scheduled, onOpen }: { asset: ContentAsset; scheduled: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: asset.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cls('group flex cursor-grab items-center gap-2 rounded-lg border border-black/5 bg-white p-1.5 active:cursor-grabbing', isDragging && 'opacity-30')}
    >
      <Thumbnail asset={asset} className="h-9 w-9 shrink-0 rounded" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-valmer-ink">{asset.title}</div>
        <div className="text-[10px] text-valmer-slate/50">
          {asset.fileType}{scheduled ? ' · scheduled' : ''}
        </div>
      </div>
    </div>
  )
}

function Gap({ pillar }: { pillar: ContentPillar }) {
  return (
    <div className="rounded-lg border border-dashed border-valmer-clay/40 bg-valmer-clay/5 p-3 text-center text-[11px] text-valmer-clay">
      Gap: no content here yet. Goal — {pillar.goal || 'fill this pillar.'}
    </div>
  )
}
