import type { ContentPillar, Platform, PostStatus } from '../types'
import { PLATFORMS } from '../types'
import { PLATFORM_STYLES, STATUS_STYLES, cls } from '../lib/ui'

export function PillarBadge({ pillar, className }: { pillar?: ContentPillar; className?: string }) {
  if (!pillar) return <span className={cls('chip bg-gray-100 text-gray-500', className)}>No pillar</span>
  return (
    <span
      className={cls('chip', className)}
      style={{ backgroundColor: pillar.color + '22', color: pillar.color }}
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pillar.color }} />
      {pillar.title}
    </span>
  )
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  const meta = PLATFORMS.find((p) => p.id === platform)
  return <span className={cls('chip', PLATFORM_STYLES[platform])}>{meta?.short || platform}</span>
}

export function StatusBadge({ status }: { status: PostStatus }) {
  return <span className={cls('chip capitalize', STATUS_STYLES[status])}>{status}</span>
}
