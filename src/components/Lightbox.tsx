import { useEffect, useState } from 'react'
import type { ContentAsset } from '../types'
import { loadBlobUrl } from '../store/blobs'

export default function Lightbox({ asset, onClose }: { asset: ContentAsset; onClose: () => void }) {
  const [url, setUrl] = useState<string | undefined>(asset.thumbnailUrl)

  useEffect(() => {
    let live = true
    loadBlobUrl(asset.id).then((u) => {
      if (live && u) setUrl(u)
    })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      live = false
      window.removeEventListener('keydown', onKey)
    }
  }, [asset.id])

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-6" onClick={onClose}>
      <button onClick={onClose} className="absolute right-5 top-4 text-2xl text-white/80 hover:text-white">✕</button>
      {asset.fileType === 'video' ? (
        url ? (
          <video src={url} controls autoPlay className="max-h-[85vh] max-w-[90vw] rounded-lg" onClick={(e) => e.stopPropagation()} />
        ) : (
          <div className="text-white/60">Loading video…</div>
        )
      ) : url ? (
        <img src={url} alt={asset.title} className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      ) : (
        <div className="text-white/60">Loading…</div>
      )}
      <div className="mt-3 text-sm text-white/80">{asset.title}</div>
    </div>
  )
}
