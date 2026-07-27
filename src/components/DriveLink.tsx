import { driveView } from '../lib/drive'
import { cls } from '../lib/ui'

// Direct link to the full-quality original in Google Drive. Renders nothing for
// assets that were uploaded straight to the app (no Drive backing). For videos it
// reads "Watch in Drive" — Drive's own player is more reliable than any embed.
export default function DriveLink({ driveId, className, label, video }: { driveId?: string; className?: string; label?: string; video?: boolean }) {
  if (!driveId) return null
  const text = label ?? (video ? 'Watch full quality in Drive' : 'Open full quality in Drive')
  const icon = video ? '▶' : '↗'
  return (
    <a
      href={driveView(driveId)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={video ? 'Play the video in Google Drive' : 'Open the full-quality original in Google Drive'}
      className={cls('inline-flex items-center gap-1 text-[11px] font-medium text-valmer-sage hover:underline', className)}
    >
      {icon} {text}
    </a>
  )
}
