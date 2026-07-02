import { useState } from 'react'
import { useStore } from '../store/useStore'
import { aiBuildBrand, aiReady } from '../engine/ai'
import type { BrandAnswers } from '../engine/ai'
import type { ContentPillar } from '../types'

const COLORS = ['#ec4899', '#8b5cf6', '#f59e0b', '#6366f1', '#06b6d4', '#14b8a6', '#f43f5e']

const STARTER: { title: string; description: string; goal: string; share: number }[] = [
  { title: 'People & Faces', description: 'Team, founders, customers, real humans.', goal: 'Emotional connection.', share: 0.22 },
  { title: 'Behind the Scenes', description: 'How the work really happens.', goal: 'Familiarity and trust.', share: 0.18 },
  { title: 'Proof & Reviews', description: 'Testimonials, results, wins.', goal: 'Credibility.', share: 0.17 },
  { title: 'Education & Tips', description: 'Useful, save-worthy value.', goal: 'Authority.', share: 0.18 },
  { title: 'Community & Local', description: 'Events, partners, local presence.', goal: 'Belonging.', share: 0.13 },
  { title: 'Offers & Events', description: 'Launches, invites, calls to action.', goal: 'Drive action.', share: 0.12 },
]

function toPillars(list: { title: string; description: string; goal: string; share: number }[]): ContentPillar[] {
  const total = list.reduce((n, p) => n + (p.share || 0), 0) || 1
  return list.map((p, i) => ({
    id: `pillar-${Date.now().toString(36)}-${i}`,
    title: p.title,
    description: p.description,
    color: COLORS[i % COLORS.length],
    goal: p.goal,
    active: true,
    targetShare: (p.share || 0) / total,
  }))
}

const QUESTIONS: { key: keyof BrandAnswers; label: string; placeholder: string }[] = [
  { key: 'about', label: 'What does this brand do?', placeholder: 'e.g. A boutique fitness studio offering small-group strength classes.' },
  { key: 'audience', label: 'Who is the audience?', placeholder: 'e.g. Busy women 30-50 who want to feel strong, not just skinny.' },
  { key: 'goals', label: 'What are the goals?', placeholder: 'e.g. Fill classes, build community, grow the membership.' },
  { key: 'vibe', label: 'What makes it different / the vibe?', placeholder: 'e.g. Warm, no-ego, encouraging. Not a bootcamp.' },
  { key: 'highlights', label: 'Anything to highlight? (services, events, people)', placeholder: 'e.g. Founder Jess, monthly challenges, the Saturday social.' },
]

export default function BrandOnboarding({ onClose, onOpenAI }: { onClose: () => void; onOpenAI: () => void }) {
  const { brands, activeBrandId, aiConfig, setPillars, updateBrand } = useStore()
  const active = brands.find((b) => b.id === activeBrandId)
  const [a, setA] = useState<BrandAnswers>({ name: active?.name || '', about: '', audience: '', goals: '', vibe: '', highlights: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ready = aiReady(aiConfig)
  const set = (k: keyof BrandAnswers, v: string) => setA((p) => ({ ...p, [k]: v }))

  const build = async () => {
    setBusy(true)
    setErr(null)
    try {
      const res = await aiBuildBrand(aiConfig, { ...a, name: active?.name || a.name })
      setPillars(toPillars(res.pillars))
      updateBrand(activeBrandId, { brief: res.brief })
      onClose()
    } catch (e: any) {
      setErr(e?.message || 'Could not build the brand. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const useStarter = () => {
    setPillars(toPillars(STARTER))
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-2xl bg-valmer-mist shadow-2xl animate-fadeup">
        <div className="sticky top-0 border-b border-black/10 bg-white px-5 py-4">
          <div className="font-serif text-xl text-valmer-ink">Let's build {active?.name || 'this brand'}</div>
          <div className="text-sm text-valmer-slate/60">Answer a few questions and ChatGPT will shape the content pillars and voice. You can edit everything after.</div>
        </div>

        <div className="space-y-4 p-5">
          {QUESTIONS.map((q) => (
            <div key={q.key}>
              <label className="label">{q.label}</label>
              <textarea value={a[q.key]} onChange={(e) => set(q.key, e.target.value)} rows={2} placeholder={q.placeholder} className="input" />
            </div>
          ))}

          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

          {!ready && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Turn on the AI caption writer to use ChatGPT for this.{' '}
              <button onClick={onOpenAI} className="font-semibold underline">Open AI settings</button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button onClick={useStarter} className="btn-ghost text-sm">Skip, use starter pillars</button>
            <button onClick={build} disabled={busy || !ready || !a.about.trim()} className="btn-primary">
              {busy ? 'Building…' : 'Build my brand with ChatGPT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
