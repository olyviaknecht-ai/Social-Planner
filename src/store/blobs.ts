import { del, get, set } from 'idb-keyval'

// File blobs live in IndexedDB so they survive reload without bloating localStorage.
export async function saveBlob(id: string, blob: Blob): Promise<void> {
  await set(`asset-blob-${id}`, blob)
}

export async function loadBlobUrl(id: string): Promise<string | undefined> {
  const blob = await get<Blob>(`asset-blob-${id}`)
  return blob ? URL.createObjectURL(blob) : undefined
}

export async function loadBlob(id: string): Promise<Blob | undefined> {
  return get<Blob>(`asset-blob-${id}`)
}

export async function removeBlob(id: string): Promise<void> {
  await del(`asset-blob-${id}`)
}
