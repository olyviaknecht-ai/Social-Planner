import { useState } from 'react'
import type { ContentAsset, ContentPillar } from '../types'
import { cls, STATUS_STYLES } from '../lib/ui'
import { STRENGTH_META, displayStatus, recommendedActions, strengthOf, suggestedUse } from '../lib/insights'
import type { AssetActionId } from '../lib/insights'
import Thumbnail from './Thumbnail'
import { PillarBadge, PlatformBadge } from './Badges'

export default function AssetCard({
  asset,
  posts,
  pillar,
  campaignLabel,
  selected,
  onToggle,
  onOpen,
  onAction,
}: {
  asset: ContentAsset
  posts: import('../types').ScheduledPost[]
  pillar?: ContentPillar
  campaignLabel?: string
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  onAction: (id: AssetActionId) => void
}) {
  const [menu, setMenu] = useState(false)
  const status = displayStatus(asset, posts)
  const strength = strengthOf(asset)
  const sMeta = STRENGTH_META[strength]
  const eventOrCampaign = campaignLabel || asset.event.trim()
  const used = asset.status === 'posted'

  return (
    <div className={cls('card relative flex flex-col overflow-hidden transition-shadow hover:shadow-md', selected && 'ring-2 ring-valmer-sage', (strength === 'archive' || used) && 'opacity-60')}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle() }}
        className={cls('absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md border text-xs shadow-sm', selected ? 'border-valmer-sage bg-valmer-sage text-white' : 'border-black/20 bg-white/90 text-transparent hover:text-valmer-slate/40')}
        aria-label="Select"
      >
        ✓
      </button>
      <span className={cls('absolute right-2 top-2 z-10 chip text-[10px]', used ? 'bg-emerald-600 text-white' : sMeta.cls)}>{used ? '✓ Used' : sMeta.label}</span>

      <button onClick={onOpen} className="block text-left">
        <Thumbnail asset={asset} className="aspect-[4/3] w-full" />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <button onClick={onOpen} className="truncate text-left text-sm font-medium text-valmer-ink">{asset.title}</button>

        <div className="flex flex-wrap items-center gap-1">
          <PillarBadge pillar={pillar} />
          {asset.selectedPlatforms.slice(0, 2).map((pl) => <PlatformBadge key={pl} platform={pl} />)}
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[10px]">
          <span className="chip bg-gray-100 capitalize text-gray-600">{asset.fileType}</span>
          <span className={cls('chip capitalize', STATUS_STYLES[status === 'unused' ? 'idea' : status])}>{status}</span>
          {asset.timeSensitive && <span className="chip bg-rose-100 text-rose-700">time-sensitive</span>}
        </div>

        {eventOrCampaign && (
          <div className="truncate text-[11px] text-valmer-slate/70">
            <span className="text-valmer-slate/40">{campaignLabel ? 'Campaign:' : 'Event:'}</span> {eventOrCampaign}
          </div>
        )}

        <div className="text-[11px] italic text-valmer-clay">{suggestedUse(asset)}</div>

        <div className="relative mt-auto pt-1">
          <button onClick={() => setMenu((v) => !v)} className="btn-outline w-full py-1 text-xs">Next action ▾</button>
          {menu && (
            <div className="absolute bottom-full left-0 z-20 mb-1 w-full overflow-hidden rounded-lg border border-black/10 bg-white shadow-lg">
              {recommendedActions(asset).map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setMenu(false); onAction(a.id) }}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-black/5"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
