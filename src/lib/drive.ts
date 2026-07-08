// Pull a Google Drive file id out of the many link formats (or a bare id).
export function parseDriveId(input: string): string | null {
  const s = input.trim()
  let m = s.match(/\/file\/d\/([-\w]{20,})/)
  if (m) return m[1]
  m = s.match(/[?&]id=([-\w]{20,})/)
  if (m) return m[1]
  m = s.match(/\/d\/([-\w]{20,})/)
  if (m) return m[1]
  if (/^[-\w]{20,}$/.test(s)) return s
  return null
}

// Preview thumbnail for a publicly-shared Drive file (works for photos and videos).
export function driveThumb(id: string, size = 600): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`
}

// Open/view the full-quality original in Google Drive.
export function driveView(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`
}

// Embeddable preview (plays videos, shows full images) for the lightbox.
export function drivePreview(id: string): string {
  return `https://drive.google.com/file/d/${id}/preview`
}

// Pull a Drive folder id from a folder link (or bare id).
export function parseDriveFolderId(input: string): string | null {
  const s = input.trim()
  let m = s.match(/\/folders\/([-\w]{20,})/)
  if (m) return m[1]
  m = s.match(/[?&]id=([-\w]{20,})/)
  if (m) return m[1]
  if (/^[-\w]{20,}$/.test(s)) return s
  return null
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
}

// List image/video files in a public ("anyone with the link") Drive folder using
// just an API key. Google APIs allow browser (CORS) requests, so no proxy needed.
export async function listDriveFolder(apiKey: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      key: apiKey.trim(),
      fields: 'nextPageToken, files(id,name,mimeType)',
      pageSize: '1000',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    })
    if (pageToken) params.set('pageToken', pageToken)
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`)
    if (!res.ok) {
      let msg = `Google Drive error ${res.status}`
      if (res.status === 403 || res.status === 404) msg = 'Could not read that folder. Make sure it is shared "Anyone with the link", the link is a folder link, and the API key has the Drive API enabled.'
      else if (res.status === 400) msg = 'That does not look like a valid folder link or API key.'
      throw new Error(msg)
    }
    const data = await res.json()
    for (const f of data.files || []) files.push(f)
    pageToken = data.nextPageToken
  } while (pageToken)
  return files.filter((f) => f.mimeType?.startsWith('image/') || f.mimeType?.startsWith('video/'))
}
