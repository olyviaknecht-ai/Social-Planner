import type { ContentAsset } from '../types'
import { cls } from '../lib/ui'
import { driveView } from '../lib/drive'
import Thumbnail from './Thumbnail'
import DriveLink from './DriveLink'

export default function CarouselCard({
  assets,
  onSchedule,
  onUnschedule,
  onUngroup,
  onOpen,
}: {
  assets: ContentAsset[]
  onSchedule: () => void
  onUnschedule: () => void
  onUngroup: () => void
  onOpen: () => void
}) {
  const cover = assets[0]
  const rest = assets.slice(1, 4)
  const scheduled = assets.some((a) => a.status === 'scheduled' || a.status === 'posted')

  return (
    <div className="card relative flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      <span className="absolute left-2 top-2 z-10 chip bg-valmer-gold/20 text-[10px] text-valmer-gold">◫ Carousel · {assets.length}</span>
      {scheduled && <span className="absolute right-2 top-2 z-10 chip bg-emerald-600 text-[10px] text-white">Scheduled</span>}

      <div className="relative">
        <button onClick={onOpen} className="block w-full text-left" title="Open to reorder photos">
          <Thumbnail asset={cover} className="aspect-[4/3] w-full" />
        </button>
        {assets.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-1 bg-gradient-to-t from-black/40 to-transparent p-1.5">
            {rest.map((a) =>
              a.driveId ? (
                <a
                  key={a.id}
                  href={driveView(a.driveId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open this photo full quality in Drive"
                  className="pointer-events-auto h-8 w-8 overflow-hidden rounded ring-1 ring-white/60 hover:ring-2 hover:ring-valmer-sage"
                >
                  <Thumbnail asset={a} className="h-8 w-8" />
                </a>
              ) : (
                <div key={a.id} className="h-8 w-8 overflow-hidden rounded ring-1 ring-white/60">
                  <Thumbnail asset={a} className="h-8 w-8" />
                </div>
              ),
            )}
            {assets.length > 4 && (
              <div className="flex h-8 w-8 items-center justify-center rounded bg-black/50 text-[10px] font-medium text-white ring-1 ring-white/60">
                +{assets.length - 4}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <button onClick={onOpen} className="truncate text-left text-sm font-medium text-valmer-ink hover:text-valmer-sage">{cover.title || 'Carousel'}</button>
        <button onClick={onOpen} className="text-left text-[11px] text-valmer-slate/60 hover:text-valmer-sage">{assets.length} photos · tap to reorder{scheduled ? '' : ' · not scheduled'}</button>
        {cover.driveId && <DriveLink driveId={cover.driveId} label="Open cover in Drive" />}
        <div className="mt-auto flex gap-2 pt-1">
          {scheduled ? (
            <button onClick={onUnschedule} className="btn-outline flex-1 py-1 text-xs" title="Remove from the calendar, keep it here">Unschedule</button>
          ) : (
            <button onClick={onSchedule} className="btn-primary flex-1 py-1 text-xs">Schedule</button>
          )}
          <button onClick={onUngroup} className="btn-outline py-1 text-xs" title="Split back into separate photos">Ungroup</button>
        </div>
      </div>
    </div>
  )
}
