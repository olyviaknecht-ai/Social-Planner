import type { ContentPillar, PostStatus, Platform } from '../types'

export function pillarById(pillars: ContentPillar[], id?: string): ContentPillar | undefined {
  return pillars.find((p) => p.id === id)
}

export const STATUS_STYLES: Record<PostStatus, string> = {
  idea: 'bg-gray-100 text-gray-600',
  drafted: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  scheduled: 'bg-amber-100 text-amber-700',
  posted: 'bg-valmer-sage/20 text-valmer-sage',
}

export const PLATFORM_STYLES: Record<Platform, string> = {
  instagram: 'bg-pink-100 text-pink-700',
  reels: 'bg-fuchsia-100 text-fuchsia-700',
  facebook: 'bg-blue-100 text-blue-700',
  tiktok: 'bg-slate-200 text-slate-800',
  youtube: 'bg-red-100 text-red-700',
  email: 'bg-amber-100 text-amber-800',
}

export function cls(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ')
}

export function downloadFile(name: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export async function makeThumbnail(file: File): Promise<string | undefined> {
  if (file.type.startsWith('image/')) {
    return downscaleImage(file)
  }
  if (file.type.startsWith('video/')) {
    return videoFrame(file).catch(() => undefined)
  }
  return undefined
}

function downscaleImage(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const max = 400
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = img.width * scale
      c.height = img.height * scale
      const ctx = c.getContext('2d')
      if (!ctx) return resolve(undefined)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = () => resolve(undefined)
    img.src = url
  })
}

function videoFrame(file: File): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.muted = true
    video.src = url
    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2 || 0.5)
    }
    video.onseeked = () => {
      const max = 400
      const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight))
      const c = document.createElement('canvas')
      c.width = (video.videoWidth || 320) * scale
      c.height = (video.videoHeight || 240) * scale
      const ctx = c.getContext('2d')
      if (!ctx) return reject()
      ctx.drawImage(video, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    video.onerror = () => reject()
  })
}
