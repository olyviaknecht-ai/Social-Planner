import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { connectFacebook, ensureFbSdk, metaTest } from '../engine/meta'
import type { FbDebug } from '../engine/meta'
import { cls } from '../lib/ui'

export default function MetaSettings({ onClose }: { onClose: () => void }) {
  const { metaConfig, setMetaConfig } = useStore()
  const [connecting, setConnecting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showToken, setShowToken] = useState(false)
  const [debug, setDebug] = useState<FbDebug | null>(null)
  const connected = metaConfig.pageToken.trim().length > 20

  // Preload the Facebook SDK as soon as we have an App ID, so the popup opens
  // inside the click gesture (avoids the browser blocking it).
  useEffect(() => {
    if (metaConfig.appId.trim().length >= 5) ensureFbSdk(metaConfig.appId).catch(() => {})
  }, [metaConfig.appId])

  const connect = async () => {
    setConnecting(true)
    setResult(null)
    setDebug(null)
    try {
      const { pageId, pageToken, pageName } = await connectFacebook(metaConfig.appId, metaConfig.pageId, setDebug)
      setMetaConfig({ pageId, pageToken, pageName })
      setResult({ ok: true, message: `Connected to “${pageName}”. You can publish now.` })
    } catch (e: any) {
      setResult({ ok: false, message: e?.message || 'Facebook login failed.' })
    } finally {
      setConnecting(false)
    }
  }

  const test = async () => {
    setTesting(true)
    setResult(null)
    setResult(await metaTest(metaConfig))
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-xl bg-valmer-mist shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <div>
            <div className="font-serif text-lg text-valmer-ink">Publish to Meta</div>
            <div className="text-xs text-valmer-slate/60">Connect once with Facebook. No token copying.</div>
          </div>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>

        <div className="space-y-4 p-5">
          {connected && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Connected{metaConfig.pageName ? ` to “${metaConfig.pageName}”` : ''}. You can publish from any Facebook post.
            </div>
          )}

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="font-semibold">The one thing Meta still requires</div>
            <p className="mt-1">
              To post on your behalf, Meta requires a one-time <b>App</b>. You create it once at developers.facebook.com and paste its <b>App ID</b> below (it is public, not a secret). After that, you just click <b>Connect Facebook</b> and log in. No tokens to copy.
            </p>
            <p className="mt-1"><b>Instagram</b> still can't auto-publish from this local tool (its API needs publicly hosted images). Facebook Page posts work.</p>
          </div>

          <div>
            <label className="label">Meta App ID</label>
            <input value={metaConfig.appId} onChange={(e) => setMetaConfig({ appId: e.target.value })} placeholder="e.g. 8123456789012345" className="input font-mono text-sm" />
          </div>

          <div>
            <label className="label">Facebook Page ID</label>
            <input value={metaConfig.pageId} onChange={(e) => setMetaConfig({ pageId: e.target.value })} placeholder="e.g. 1029384756" className="input" />
            <p className="mt-1 text-[11px] text-valmer-slate/55">Leave blank to use your first Page, or enter the specific Page ID you want to post to.</p>
          </div>

          <button onClick={connect} disabled={connecting || metaConfig.appId.trim().length < 5} className="btn w-full bg-[#1877F2] text-white hover:bg-[#166fe0]">
            {connecting ? 'Opening Facebook…' : connected ? 'Reconnect Facebook' : 'Connect Facebook'}
          </button>

          {result && (
            <div className={cls('rounded-md px-3 py-2 text-sm', result.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700')}>
              {result.ok ? '✓ ' : '✕ '}{result.message}
            </div>
          )}

          {debug && (
            <div className="rounded-md bg-valmer-ink/90 p-3 font-mono text-[11px] text-white/90">
              <div className="mb-1 text-white/50">Facebook login response (for debugging):</div>
              <div>status: <span className="text-amber-300">{debug.status || 'unknown'}</span></div>
              <div>granted: <span className="text-emerald-300">{debug.granted.join(', ') || '(none)'}</span></div>
              <div>declined: <span className="text-rose-300">{debug.declined.join(', ') || '(none)'}</span></div>
              <div className="mt-1 text-white/40">Full response is logged to the browser console.</div>
            </div>
          )}

          <details className="rounded-lg bg-white p-3 text-xs text-valmer-slate/80">
            <summary className="cursor-pointer font-medium text-valmer-slate">Set up the App ID (one time)</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Go to developers.facebook.com → Create App → type <b>Business</b>.</li>
              <li>Add the <b>Facebook Login for Business</b> (or Facebook Login) product.</li>
              <li>This app uses the <b>JavaScript SDK</b>, so the key setting is the allowed domain, not a redirect URI. In Facebook Login → Settings: turn <b>“Login with the JavaScript SDK”</b> = Yes, and add <code>http://localhost:5174/</code> under <b>Allowed Domains for the JavaScript SDK</b>.</li>
              <li>Under App Settings → Basic, add <code>localhost</code> to <b>App Domains</b>.</li>
              <li>Copy the <b>App ID</b> from the dashboard and paste it above.</li>
              <li>While the app is in <b>Development</b> mode, only people with an <b>Admin / Developer / Tester</b> role on the app can log in. Add yourself under App Roles. (Live posting to other users needs Meta's App Review.)</li>
            </ol>
          </details>

          <details className="rounded-lg bg-white p-3 text-xs text-valmer-slate/80">
            <summary className="cursor-pointer font-medium text-valmer-slate">Advanced: paste a token manually instead</summary>
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={metaConfig.pageToken}
                  onChange={(e) => setMetaConfig({ pageToken: e.target.value })}
                  placeholder="Page access token (EAAB...)"
                  className="input font-mono text-xs"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button onClick={() => setShowToken((v) => !v)} className="btn-outline px-3 text-xs">{showToken ? 'Hide' : 'Show'}</button>
              </div>
              <button onClick={test} disabled={testing || metaConfig.pageToken.trim().length < 20} className="btn-outline text-xs">
                {testing ? 'Testing…' : 'Test token'}
              </button>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
