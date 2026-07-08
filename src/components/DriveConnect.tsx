import { useState } from 'react'
import { useStore } from '../store/useStore'
import { parseDriveFolderId } from '../lib/drive'

export default function DriveConnect({ onClose }: { onClose: () => void }) {
  const { driveFolderId, driveApiKey, setDrive, syncDrive } = useStore()
  const [apiKey, setApiKey] = useState(driveApiKey)
  const [folderLink, setFolderLink] = useState(driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const sync = async () => {
    const folderId = parseDriveFolderId(folderLink)
    if (!apiKey.trim()) return setErr('Enter your Google API key.')
    if (!folderId) return setErr('Paste a Google Drive folder link.')
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      setDrive({ driveApiKey: apiKey.trim(), driveFolderId: folderId })
      const { added, total } = await syncDrive()
      setMsg(added ? `Imported ${added} new file${added > 1 ? 's' : ''} from Drive (${total} in the folder).` : `Already up to date. ${total} files in the folder.`)
    } catch (e: any) {
      setErr(e?.message || 'Could not read the folder.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-2xl bg-valmer-mist shadow-2xl animate-fadeup" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <div>
            <div className="font-serif text-lg text-valmer-ink">Connect Google Drive</div>
            <div className="text-xs text-valmer-slate/60">Pull this brand's folder in. Originals stay in Drive at full quality.</div>
          </div>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="label">Google Drive folder link</label>
            <input value={folderLink} onChange={(e) => setFolderLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" className="input" />
            <p className="mt-1 text-[11px] text-valmer-slate/55">The folder must be shared <b>Anyone with the link → Viewer</b>.</p>
          </div>

          <div>
            <label className="label">Google API key</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza…" className="input font-mono text-xs" spellCheck={false} />
          </div>

          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
          {msg && <div className="rounded-lg bg-valmer-sage/15 px-3 py-2 text-sm text-valmer-sage">{msg}</div>}

          <button onClick={sync} disabled={busy} className="btn-primary w-full">
            {busy ? 'Importing…' : driveFolderId ? 'Sync folder' : 'Import folder'}
          </button>

          <details className="rounded-lg bg-white p-3 text-xs text-valmer-slate/80">
            <summary className="cursor-pointer font-medium text-valmer-slate">One-time setup: get an API key</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Go to console.cloud.google.com → create a project (any name).</li>
              <li>APIs &amp; Services → Library → search <b>Google Drive API</b> → Enable.</li>
              <li>APIs &amp; Services → Credentials → Create credentials → <b>API key</b> → copy it here.</li>
              <li>In Google Drive, right-click your brand's folder → Share → General access → <b>Anyone with the link → Viewer</b> → copy the folder link here.</li>
              <li>Click Import. After that, new files you add to the Drive folder show up automatically.</li>
            </ol>
            <p className="mt-2">Tip: in Credentials you can restrict the API key to just the Drive API for safety.</p>
          </details>
        </div>
      </div>
    </div>
  )
}
