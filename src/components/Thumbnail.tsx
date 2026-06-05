import { useEffect, useState } from 'react'
import type { ContentAsset } from '../types'
import { loadBlobUrl } from '../store/blobs'
import { cls } from '../lib/ui'

export default function Thumbnail({ asset, className }: { asset?: ContentAsset; className?: string }) {
  const [url, setUrl] = useState<string | undefined>(asset?.thumbnailUrl)

  useEffect(() => {
    let live = true
    if (asset && !asset.thumbnailUrl) {
      loadBlobUrl(asset.id).then((u) => live && setUrl(u))
    } else {
      setUrl(asset?.thumbnailUrl)
    }
    return () => {
      live = false
    }
  }, [asset?.id, asset?.thumbnailUrl])

  if (!asset) {
    return (
      <div className={cls('flex items-center justify-center bg-valmer-sand/60 text-valmer-slate/40 text-xs', className)}>
        no asset
      </div>
    )
  }

  return (
    <div className={cls('relative overflow-hidden bg-valmer-sand/60', className)}>
      {url ? (
        <img src={url} alt={asset.title} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-valmer-slate/40 text-2xl">
          {asset.fileType === 'video' ? '▶' : '◳'}
        </div>
      )}
      {asset.fileType === 'video' && (
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] text-white">video</span>
      )}
    </div>
  )
}
