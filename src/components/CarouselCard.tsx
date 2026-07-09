import type { ContentAsset } from '../types'
import { cls } from '../lib/ui'
import Thumbnail from './Thumbnail'

export default function CarouselCard({
  assets,
  onSchedule,
  onUngroup,
  onOpenAsset,
}: {
  assets: ContentAsset[]
  onSchedule: () => void
  onUngroup: () => void
  onOpenAsset: (id: string) => void
}) {
  const cover = assets[0]
  const rest = assets.slice(1, 4)
  const scheduled = assets.some((a) => a.status === 'scheduled' || a.status === 'posted')

  return (
    <div className="card relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <span className="absolute left-2 top-2 z-10 chip bg-valmer-gold/20 text-[10px] text-valmer-gold">◫ Carousel · {assets.length}</span>
      {scheduled && <span className="absolute right-2 top-2 z-10 chip bg-emerald-600 text-[10px] text-white">Scheduled</span>}

      <button onClick={() => onOpenAsset(cover.id)} className="relative block text-left" title="View photos">
        <Thumbnail asset={cover} className="aspect-[4/3] w-full" />
        {assets.length > 1 && (
          <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/40 to-transparent p-1.5">
            {rest.map((a) => (
              <div key={a.id} className="h-8 w-8 overflow-hidden rounded ring-1 ring-white/60">
                <Thumbnail asset={a} className="h-8 w-8" />
              </div>
            ))}
            {assets.length > 4 && (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-black/50 text-[10px] font-medium text-white ring-1 ring-white/60">
                +{assets.length - 4}
              </div>
            )}
          </div>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="truncate text-sm font-medium text-valmer-ink">{cover.title || 'Carousel'}</div>
        <div className="text-[11px] text-valmer-slate/60">{assets.length} photos grouped together. Not scheduled yet.</div>
        <div className="mt-auto flex gap-2 pt-1">
          <button onClick={onSchedule} className={cls('btn-primary flex-1 py-1 text-xs', scheduled && 'opacity-70')}>
            {scheduled ? 'Scheduled' : 'Schedule'}
          </button>
          <button onClick={onUngroup} className="btn-outline py-1 text-xs" title="Split back into separate photos">Ungroup</button>
        </div>
      </div>
    </div>
  )
}
