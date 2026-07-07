import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function BrandVoice({ onClose }: { onClose: () => void }) {
  const { brands, activeBrandId, brief, voice, setBrief, setVoice } = useStore()
  const active = brands.find((b) => b.id === activeBrandId)
  const [saved, setSaved] = useState(false)

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 1200) }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-xl overflow-auto rounded-2xl bg-valmer-mist shadow-2xl animate-fadeup" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-black/10 bg-white px-5 py-3">
          <div>
            <div className="font-serif text-lg text-valmer-ink">{active?.name} voice</div>
            <div className="text-xs text-valmer-slate/60">Teach the AI how this brand sounds. Used every time it writes a caption.</div>
          </div>
          <button onClick={onClose} className="btn-ghost px-2">✕</button>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <label className="label">Paste past posts (the best examples of the brand's voice)</label>
            <textarea
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              onBlur={flashSaved}
              rows={10}
              placeholder={'Paste a few real Facebook/Instagram captions here, one after another. The more real examples, the more the AI sounds like you.\n\ne.g.\n"There’s something about a full room on a Monday morning…"\n"We don’t just work here, we live here too…"'}
              className="input font-normal leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-valmer-slate/55">The AI studies these and matches the tone, rhythm, and vocabulary.</p>
          </div>

          <div>
            <label className="label">Brand in a sentence or two (positioning + audience)</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onBlur={flashSaved}
              rows={3}
              placeholder="e.g. A warm, local title company for real estate agents. Relationship-first, never corporate."
              className="input"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className={saved ? 'text-sm text-valmer-sage' : 'text-sm text-valmer-slate/40'}>{saved ? 'Saved' : 'Saves automatically'}</span>
            <button onClick={onClose} className="btn-primary">Done</button>
          </div>
        </div>
      </div>
    </div>
  )
}
