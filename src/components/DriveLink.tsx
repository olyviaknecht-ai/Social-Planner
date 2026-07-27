import { driveView } from '../lib/drive'
import { cls } from '../lib/ui'

// Direct link to the full-quality original in Google Drive. Renders nothing for
// assets that were uploaded straight to the app (no Drive backing).
export default function DriveLink({ driveId, className, label = 'Open full quality in Drive' }: { driveId?: string; className?: string; label?: string }) {
  if (!driveId) return null
  return (
    <a
      href={driveView(driveId)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Open the full-quality original in Google Drive"
      className={cls('inline-flex items-center gap-1 text-[11px] font-medium text-valmer-sage hover:underline', className)}
    >
      ↗ {label}
    </a>
  )
}
