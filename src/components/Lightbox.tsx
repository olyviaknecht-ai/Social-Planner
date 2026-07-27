import { useEffect, useState } from 'react'
import type { ContentAsset } from '../types'
import { loadBlobUrl } from '../store/blobs'
import { drivePreview, driveView } from '../lib/drive'

// Views one asset, or a whole carousel you can arrow-key through.
// For images we can show the little thumbnail instantly then upgrade to full res.
// For videos the thumbnail is a poster image, which must NOT be fed to <video>.
function posterFor(a?: ContentAsset): string | undefined {
  return a && !a.driveId && a.fileType !== 'video' ? a.thumbnailUrl : undefined
}

export default function Lightbox({ assets, startIndex = 0, onClose }: { assets: ContentAsset[]; startIndex?: number; onClose: () => void }) {
  const [cur, setCur] = useState(Math.min(startIndex, Math.max(assets.length - 1, 0)))
  const asset = assets[cur]
  const [url, setUrl] = useState<string | undefined>(posterFor(asset))
  const [failed, setFailed] = useState(false)
  const many = assets.length > 1

  const go = (d: number) => setCur((c) => (c + d + assets.length) % assets.length)

  useEffect(() => {
    let live = true
    setUrl(posterFor(asset))
    setFailed(false)
    if (asset && !asset.driveId) loadBlobUrl(asset.id).then((u) => { if (live && u) setUrl(u) })
    return () => { live = false }
  }, [asset?.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.length])

  if (!asset) return null
  const isVideo = asset.fileType === 'video'

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/85 p-6" onClick={onClose}>
      <button onClick={onClose} className="absolute right-5 top-4 text-2xl text-white/80 hover:text-white">✕</button>

      {many && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); go(-1) }}
            className="absolute left-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl text-white hover:bg-white/30 sm:left-5"
            title="Previous (←)"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); go(1) }}
            className="absolute right-2 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-3xl text-white hover:bg-white/30 sm:right-5"
            title="Next (→)"
          >
            ›
          </button>
        </>
      )}

      {asset.driveId ? (
        <iframe src={drivePreview(asset.driveId)} className="h-[74vh] w-[90vw] max-w-4xl rounded-lg bg-black" onClick={(e) => e.stopPropagation()} allow="autoplay" title={asset.title} />
      ) : isVideo ? (
        url && !failed ? (
          <video
            key={url}
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-[80vh] max-w-[86vw] rounded-lg"
            onClick={(e) => e.stopPropagation()}
            onError={() => setFailed(true)}
          />
        ) : failed ? (
          <div className="flex max-w-md flex-col items-center gap-3 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="text-white/70">This video can’t play in the browser. That usually means the format (often iPhone .mov / HEVC).</div>
            {url && (
              <a href={url} download={`${(asset.title || 'video').replace(/[^\w.-]+/g, '_')}.mp4`} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-valmer-ink shadow hover:bg-valmer-sage hover:text-white">
                ⬇ Download the video
              </a>
            )}
          </div>
        ) : (
          <div className="text-white/60">Loading video…</div>
        )
      ) : url ? (
        <img src={url} alt={asset.title} className="max-h-[80vh] max-w-[86vw] rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      ) : (
        <div className="text-white/60">Loading…</div>
      )}

      {asset.driveId && (
        <a
          href={driveView(asset.driveId)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-valmer-ink shadow hover:bg-valmer-sage hover:text-white"
        >
          {isVideo ? '▶ Watch in Google Drive' : '↗ Open full quality in Google Drive'}
        </a>
      )}
      {asset.driveId && isVideo && <div className="mt-2 text-xs text-white/60">If the video won't play here, use the button above to watch it in Drive.</div>}

      <div className="mt-3 text-sm text-white/80">
        {many ? <span className="mr-2 rounded bg-white/15 px-2 py-0.5 text-xs">{cur + 1} / {assets.length}</span> : null}
        {asset.title}
      </div>
      {many && <div className="mt-1 text-[11px] text-white/45">Use ← and → to move through the carousel.</div>}
    </div>
  )
}
