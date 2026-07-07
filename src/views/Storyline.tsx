import { format } from 'date-fns'
import { useStore } from '../store/useStore'
import { PHASES } from '../engine/planner'
import { buildStoryline } from '../engine/planner'
import PageHeader from '../components/PageHeader'
import { cls } from '../lib/ui'

const PHASE_COLORS = ['#ec4899', '#a855f7', '#6366f1', '#06b6d4']

export default function Storyline() {
  const { weeks, posts, pillars, updateWeek, generatePlan } = useStore()
  const setWeeks = useStore.setState

  // Move a week's narrative content up/down; the calendar slot (dates/phase) stays.
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= weeks.length) return
    const next = weeks.map((w) => ({ ...w }))
    const a = next[i]
    const b = next[j]
    ;[a.theme, b.theme] = [b.theme, a.theme]
    ;[a.goal, b.goal] = [b.goal, a.goal]
    ;[a.recommendedPillarIds, b.recommendedPillarIds] = [b.recommendedPillarIds, a.recommendedPillarIds]
    setWeeks({ weeks: next })
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Storyline"
        subtitle="Your 90-day arc. Edit any theme, goal, or focus, and drag the story around. It builds from familiarity to trust to value to action."
        action={
          <button onClick={() => { if (confirm('Rebuild the storyline from your pillars? Your theme edits will be replaced.')) setWeeks({ weeks: buildStoryline(undefined, pillars) }) }} className="btn-outline">
            Regenerate arc
          </button>
        }
      />

      {weeks.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="font-serif text-lg text-valmer-ink">No storyline yet</div>
          <p className="mt-1 text-sm text-valmer-slate/60">Generate the 90-day plan and your storyline appears here, ready to edit.</p>
          <button onClick={generatePlan} className="btn-primary mt-4">Generate 90-day plan</button>
        </div>
      ) : (
        <>
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
            {weeks.map((w, i) => {
              const weekPosts = posts.filter((p) => p.scheduledDate >= w.weekStart && p.scheduledDate <= w.weekEnd)
              const focusPillar = w.recommendedPillarIds[0] || ''
              return (
                <div key={w.id} className="card flex gap-4 p-4">
                  <div className="flex w-24 shrink-0 flex-col items-center justify-center rounded-lg text-white" style={{ backgroundColor: PHASE_COLORS[w.phase - 1] }}>
                    <div className="text-xs opacity-80">Week</div>
                    <div className="font-serif text-3xl">{i + 1}</div>
                    <div className="text-[10px] opacity-80">{format(new Date(w.weekStart), 'MMM d')}</div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <input
                      value={w.theme}
                      onChange={(e) => updateWeek(w.id, { theme: e.target.value })}
                      placeholder="Week theme…"
                      className="w-full rounded-lg px-2 py-1 font-serif text-lg text-valmer-ink outline-none transition-colors hover:bg-black/[0.03] focus:bg-white focus:ring-2 focus:ring-valmer-sage/25"
                    />
                    <input
                      value={w.goal}
                      onChange={(e) => updateWeek(w.id, { goal: e.target.value })}
                      placeholder="What this week should do…"
                      className="w-full rounded-lg px-2 py-1 text-sm text-valmer-slate/70 outline-none transition-colors hover:bg-black/[0.03] focus:bg-white focus:ring-2 focus:ring-valmer-sage/25"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2 px-2">
                      <span className="text-[11px] text-valmer-slate/50">Focus:</span>
                      <select
                        value={focusPillar}
                        onChange={(e) => updateWeek(w.id, { recommendedPillarIds: e.target.value ? [e.target.value] : [] })}
                        className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs text-valmer-ink"
                      >
                        <option value="">Any pillar</option>
                        {pillars.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                      <span className="ml-auto text-xs text-valmer-slate/50">
                        {weekPosts.length} posts · {weekPosts.filter((p) => p.cta?.trim()).length} with CTA
                      </span>
                    </div>
                    {weekPosts.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 px-2">
                        {weekPosts.map((p) => (
                          <span key={p.id} className={cls('chip text-[10px]', p.status === 'idea' ? 'bg-gray-100 text-gray-500' : 'bg-valmer-sage/15 text-valmer-sage')}>
                            {format(new Date(p.scheduledDate), 'EEE')}: {p.title.slice(0, 22)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col justify-center gap-1 text-valmer-slate/40">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded px-1.5 py-0.5 hover:bg-black/5 hover:text-valmer-slate disabled:opacity-30" title="Move up">▲</button>
                    <button onClick={() => move(i, 1)} disabled={i === weeks.length - 1} className="rounded px-1.5 py-0.5 hover:bg-black/5 hover:text-valmer-slate disabled:opacity-30" title="Move down">▼</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
