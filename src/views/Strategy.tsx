import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { analyzeStrategy } from '../engine/strategy'
import type { GapSeverity } from '../types'
import PageHeader from '../components/PageHeader'
import { cls } from '../lib/ui'

const SEV_STYLE: Record<GapSeverity, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  alert: 'border-rose-200 bg-rose-50 text-rose-800',
}
const SEV_ICON: Record<GapSeverity, string> = { good: '✓', warn: '!', alert: '⚠' }

export default function Strategy() {
  const { posts, pillars, assets } = useStore()
  const s = useMemo(() => analyzeStrategy(posts, pillars, assets), [posts, pillars, assets])
  const platTotal = s.platformBalance.reduce((n, p) => n + p.count, 0) || 1

  return (
    <div className="p-6">
      <PageHeader title="Strategy Score" subtitle="A read on whether your 90 days actually tells a balanced story." />

      <div className="grid grid-cols-3 gap-6">
        <div className="card flex flex-col items-center justify-center p-6">
          <div className={cls('font-serif text-6xl', s.score >= 80 ? 'text-emerald-600' : s.score >= 60 ? 'text-amber-600' : 'text-rose-600')}>{s.score}</div>
          <div className="mt-1 text-sm text-valmer-slate/60">out of 100</div>
          <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
            <Metric label="Faces" value={s.facesFrequency} />
            <Metric label="CTAs" value={s.ctaFrequency} />
            <Metric label="Proof" value={s.proofFrequency} />
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 font-serif text-valmer-slate">Pillar balance</div>
          <div className="space-y-2">
            {s.pillarBalance.map((pb) => {
              const pillar = pillars.find((p) => p.id === pb.pillarId)!
              const over = pb.actual - pb.target > 0.1
              const under = pb.target - pb.actual > 0.1
              return (
                <div key={pb.pillarId}>
                  <div className="flex justify-between text-xs">
                    <span className="text-valmer-slate/70">{pillar.title}</span>
                    <span className={cls('tabular-nums', over ? 'text-rose-600' : under ? 'text-amber-600' : 'text-valmer-slate/60')}>
                      {Math.round(pb.actual * 100)}% / {Math.round(pb.target * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/5">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pb.actual * 100)}%`, backgroundColor: pillar.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 font-serif text-valmer-slate">Platform balance</div>
          {s.platformBalance.length === 0 ? (
            <div className="text-sm text-valmer-slate/50">No posts scheduled yet.</div>
          ) : (
            <div className="space-y-2">
              {s.platformBalance.map((p) => (
                <div key={p.platform}>
                  <div className="flex justify-between text-xs">
                    <span className="capitalize text-valmer-slate/70">{p.platform}</span>
                    <span className="tabular-nums text-valmer-slate/60">{p.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/5">
                    <div className="h-full rounded-full bg-valmer-slate" style={{ width: `${(p.count / platTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 font-serif text-lg text-valmer-ink">What the strategist notices</div>
        <div className="space-y-2">
          {s.recommendations.map((r, i) => (
            <div key={i} className={cls('flex items-start gap-3 rounded-lg border p-3 text-sm', SEV_STYLE[r.severity])}>
              <span className="mt-0.5 font-bold">{SEV_ICON[r.severity]}</span>
              <span>{r.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/5 py-2">
      <div className="font-semibold tabular-nums text-valmer-ink">{Math.round(value * 100)}%</div>
      <div className="text-[10px] uppercase tracking-wide text-valmer-slate/50">{label}</div>
    </div>
  )
}
