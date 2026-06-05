import { format } from 'date-fns'
import { useStore } from '../store/useStore'
import { PHASES } from '../engine/planner'
import { buildStoryline } from '../engine/planner'
import PageHeader from '../components/PageHeader'
import { PillarBadge } from '../components/Badges'
import { cls } from '../lib/ui'

const PHASE_COLORS = ['#c0714f', '#9c5d6b', '#5b7c6f', '#c79a4b']

export default function Storyline() {
  const { weeks, posts, pillars, updateWeek } = useStore()
  const setWeeks = useStore.setState

  return (
    <div className="p-6">
      <PageHeader
        title="Storyline"
        subtitle="The 90-day arc, not just a calendar. It builds from familiarity to trust to value to action."
        action={
          <button onClick={() => setWeeks({ weeks: buildStoryline() })} className="btn-outline">
            Regenerate arc
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-4 gap-3">
        {PHASES.map((p, i) => (
          <div key={p.phase} className="rounded-xl p-4 text-white" style={{ backgroundColor: PHASE_COLORS[i] }}>
            <div className="text-xs uppercase tracking-wide opacity-80">Phase {p.phase} · Weeks {p.weeks[0] + 1}–{p.weeks[2] + 1}</div>
            <div className="font-serif text-lg">{p.name}</div>
            <div className="mt-1 text-xs opacity-90">{p.goal}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {weeks.map((w) => {
          const weekPosts = posts.filter((p) => p.scheduledDate >= w.weekStart && p.scheduledDate <= w.weekEnd)
          return (
            <div key={w.id} className="card flex gap-4 p-4">
              <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-lg text-white" style={{ backgroundColor: PHASE_COLORS[w.phase - 1] }}>
                <div className="text-xs opacity-80">Week</div>
                <div className="font-serif text-3xl">{w.index + 1}</div>
                <div className="text-[10px] opacity-80">{format(new Date(w.weekStart), 'MMM d')}</div>
              </div>
              <div className="min-w-0 flex-1">
                <input
                  value={w.theme}
                  onChange={(e) => updateWeek(w.id, { theme: e.target.value })}
                  className="w-full bg-transparent font-serif text-lg text-valmer-ink outline-none"
                />
                <input
                  value={w.goal}
                  onChange={(e) => updateWeek(w.id, { goal: e.target.value })}
                  className="w-full bg-transparent text-sm text-valmer-slate/70 outline-none"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {w.recommendedPillarIds.map((id) => (
                    <PillarBadge key={id} pillar={pillars.find((p) => p.id === id)} />
                  ))}
                  <span className="ml-auto text-xs text-valmer-slate/50">
                    {weekPosts.length} posts · {weekPosts.filter((p) => p.cta?.trim()).length} with CTA
                  </span>
                </div>
                {weekPosts.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {weekPosts.map((p) => (
                      <span key={p.id} className={cls('chip text-[10px]', p.status === 'idea' ? 'bg-gray-100 text-gray-500' : 'bg-valmer-sage/15 text-valmer-sage')}>
                        {format(new Date(p.scheduledDate), 'EEE')}: {p.title.slice(0, 22)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
