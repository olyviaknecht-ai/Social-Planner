import { useMemo } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store/useStore'
import type { ContentAsset } from '../types'
import { cls } from '../lib/ui'
import Thumbnail from './Thumbnail'
import DriveLink from './DriveLink'

export default function CarouselModal({
  carouselId,
  onSchedule,
  onUnschedule,
  onUngroup,
  onClose,
}: {
  carouselId: string
  onSchedule: (orderedIds: string[]) => void
  onUnschedule: (orderedIds: string[]) => void
  onUngroup: () => void
  onClose: () => void
}) {
  const { assets, reorderCarousel, removeAsset } = useStore()
  const members = useMemo(
    () => assets.filter((a) => a.carouselId === carouselId).sort((a, b) => (a.carouselOrder ?? 0) - (b.carouselOrder ?? 0)),
    [assets, carouselId],
  )
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const scheduled = members.some((a) => a.status === 'scheduled' || a.status === 'posted')
  const orderedIds = members.map((a) => a.id)

  if (members.length === 0) {
    onClose()
    return null
  }

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = orderedIds.indexOf(String(active.id))
    const to = orderedIds.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    reorderCarousel(arrayMove(orderedIds, from, to))
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-2xl bg-valmer-mist shadow-2xl animate-fadeup" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <div>
            <div className="font-serif text-lg text-valmer-ink">Carousel · {members.length} photos</div>
            <div className="text-xs text-valmer-slate/60">Drag to set the order they post in. The first photo is the cover.</div>
          </div>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>

        <div className="p-5">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={orderedIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {members.map((a, i) => (
                  <SortableTile key={a.id} asset={a} index={i} onRemove={() => removeAsset(a.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="mt-5 flex flex-wrap gap-2">
            {scheduled ? (
              <button onClick={() => { onUnschedule(orderedIds); onClose() }} className="btn-outline">Unschedule</button>
            ) : (
              <button onClick={() => { onSchedule(orderedIds); onClose() }} className="btn-primary">Schedule this carousel</button>
            )}
            <button onClick={() => { onUngroup(); onClose() }} className="btn-outline">Ungroup</button>
            <button onClick={onClose} className="btn-ghost ml-auto">Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SortableTile({ asset, index, onRemove }: { asset: ContentAsset; index: number; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cls('group relative overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm', isDragging && 'z-10 opacity-70 ring-2 ring-valmer-sage')}
    >
      <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-semibold text-white">{index + 1}</span>
      <button
        onClick={onRemove}
        className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-xs text-rose-600 opacity-0 shadow transition-opacity group-hover:opacity-100"
        title="Remove from carousel"
      >
        ✕
      </button>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing" title="Drag to reorder">
        <Thumbnail asset={asset} className="aspect-square w-full" />
      </div>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5">
        <span className="truncate text-[11px] text-valmer-slate/70">{asset.title}</span>
        {asset.driveId && <DriveLink driveId={asset.driveId} label="Drive" className="shrink-0 text-[10px]" />}
      </div>
    </div>
  )
}
