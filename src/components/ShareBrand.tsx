import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { formatDistanceToNow } from 'date-fns'

export default function ShareBrand({ onClose }: { onClose: () => void }) {
  const { brands, activeBrandId, members, invites, role, shareActiveBrand, inviteLink, removeAccess, loadActivity } = useStore()
  const [linkCopied, setLinkCopied] = useState(false)
  const active = brands.find((b) => b.id === activeBrandId)
  const [email, setEmail] = useState('')
  const [shareRole, setShareRole] = useState('editor')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [activity, setActivity] = useState<{ at: string; summary: string; name: string; email: string }[]>([])

  useEffect(() => {
    loadActivity().then(setActivity).catch(() => {})
  }, [activeBrandId])

  const share = async () => {
    if (!email.trim()) return
    setBusy(true)
    setMsg(null)
    try {
      const res = await shareActiveBrand(email.trim(), shareRole)
      setMsg(res.status === 'invited' ? `Invite saved. ${email} gets access as soon as they sign up with this email.` : `${email} now has access.`)
      setEmail('')
    } catch (e: any) {
      setMsg(e?.message || 'Could not share.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-valmer-mist shadow-2xl animate-fadeup" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <div>
            <div className="font-serif text-lg text-valmer-ink">Share {active?.name}</div>
            <div className="text-xs text-valmer-slate/60">People you add can open this brand on their own login.</div>
          </div>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>

        <div className="space-y-5 p-5">
          {role !== 'owner' ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Only the brand owner can invite people.</div>
          ) : (
            <>
            <div>
              <label className="label">Share a link</label>
              <p className="-mt-0.5 mb-2 text-[11px] text-valmer-slate/55">Anyone who opens this link and signs up joins the brand as an editor.</p>
              <button
                onClick={async () => {
                  try {
                    const link = await inviteLink('editor')
                    await navigator.clipboard.writeText(link)
                    setLinkCopied(true)
                    setTimeout(() => setLinkCopied(false), 2000)
                  } catch { setMsg('Could not create the link.') }
                }}
                className="btn-primary w-full"
              >
                {linkCopied ? '✓ Link copied — paste it to them' : 'Copy invite link'}
              </button>
            </div>

            <div>
              <label className="label">Or invite by email</label>
              <div className="flex gap-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" className="input" type="email" />
                <select value={shareRole} onChange={(e) => setShareRole(e.target.value)} className="input w-28">
                  <option value="editor">Can edit</option>
                  <option value="viewer">View only</option>
                </select>
                <button onClick={share} disabled={busy || !email.trim()} className="btn-primary shrink-0">{busy ? '…' : 'Share'}</button>
              </div>
              {msg && <div className="mt-2 rounded-lg bg-valmer-sage/15 px-3 py-2 text-sm text-valmer-sage">{msg}</div>}
            </div>
            </>
          )}

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-valmer-slate/50">People with access</div>
            <div className="space-y-1">
              {members.map((m) => (
                <div key={m.email} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{m.name || m.email}{m.name && <span className="text-valmer-slate/40"> · {m.email}</span>}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="chip bg-black/5 text-[10px] capitalize text-valmer-slate/60">{m.role}</span>
                    {role === 'owner' && m.role !== 'owner' && (
                      <button onClick={() => { if (confirm(`Remove ${m.email} from this brand?`)) removeAccess(m.email) }} className="text-valmer-slate/40 hover:text-rose-500" title="Remove access">✕</button>
                    )}
                  </div>
                </div>
              ))}
              {invites.map((iv) => (
                <div key={iv.email} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-valmer-slate/70">{iv.email}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="chip bg-amber-100 text-[10px] text-amber-700">invite pending</span>
                    {role === 'owner' && (
                      <button onClick={() => removeAccess(iv.email)} className="text-valmer-slate/40 hover:text-rose-500" title="Cancel invite">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-valmer-slate/50">Recent edits</div>
            <div className="space-y-1">
              {activity.length === 0 && <div className="text-sm text-valmer-slate/50">No edits yet.</div>}
              {activity.map((e, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                  <span><span className="font-medium">{e.name || e.email}</span> <span className="text-valmer-slate/60">{e.summary}</span></span>
                  <span className="text-[11px] text-valmer-slate/40">{timeAgo(e.at)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return ''
  }
}
