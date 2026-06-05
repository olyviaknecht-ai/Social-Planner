import { useState } from 'react'
import { useStore } from '../store/useStore'
import { aiTestKey } from '../engine/ai'
import { cls } from '../lib/ui'

const MODELS = [
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini — fast & cheap (good default)' },
  { id: 'gpt-4o', label: 'gpt-4o — higher quality, costs more' },
  { id: 'gpt-4.1', label: 'gpt-4.1 — newest, highest quality' },
  { id: 'gpt-4.1-mini', label: 'gpt-4.1-mini — fast, newer' },
]

export default function AISettings({ onClose }: { onClose: () => void }) {
  const { aiConfig, setAIConfig } = useStore()
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showKey, setShowKey] = useState(false)

  const test = async () => {
    setTesting(true)
    setResult(null)
    const r = await aiTestKey(aiConfig)
    setResult(r)
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-valmer-mist shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <div>
            <div className="font-serif text-lg text-valmer-ink">AI caption writer</div>
            <div className="text-xs text-valmer-slate/60">Use ChatGPT (OpenAI) to write captions in Valmer's voice.</div>
          </div>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>

        <div className="space-y-4 p-5">
          <label className="flex items-center justify-between rounded-lg bg-white p-3">
            <div>
              <div className="font-medium text-valmer-ink">Use AI for captions</div>
              <div className="text-xs text-valmer-slate/60">When off, the built-in writer is used (no key needed).</div>
            </div>
            <button
              onClick={() => setAIConfig({ enabled: !aiConfig.enabled })}
              className={cls('relative h-6 w-11 rounded-full transition-colors', aiConfig.enabled ? 'bg-valmer-sage' : 'bg-black/15')}
            >
              <span className={cls('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', aiConfig.enabled ? 'left-[22px]' : 'left-0.5')} />
            </button>
          </label>

          <div>
            <label className="label">OpenAI API key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? 'text' : 'password'}
                value={aiConfig.apiKey}
                onChange={(e) => setAIConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                className="input font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <button onClick={() => setShowKey((v) => !v)} className="btn-outline px-3 text-xs">{showKey ? 'Hide' : 'Show'}</button>
            </div>
            <p className="mt-1 text-[11px] text-valmer-slate/55">
              Stored only in this browser, sent straight to OpenAI. Get a key at platform.openai.com → API keys. Usage is billed to your OpenAI account.
            </p>
          </div>

          <div>
            <label className="label">Model</label>
            <select value={aiConfig.model} onChange={(e) => setAIConfig({ model: e.target.value })} className="input">
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={test} disabled={testing || aiConfig.apiKey.trim().length < 10} className="btn-primary">
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            {result && (
              <span className={cls('text-sm', result.ok ? 'text-valmer-sage' : 'text-rose-600')}>
                {result.ok ? '✓ ' : '✕ '}
                {result.message}
              </span>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
            Note: because this app has no server, the key lives in your browser and is visible in network requests from this machine. That is fine for a personal internal tool. Do not use a shared or production key, and remove it before sharing this browser profile.
          </div>
        </div>
      </div>
    </div>
  )
}
