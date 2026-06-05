import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useStore } from './store/useStore'
import { analyzeStrategy } from './engine/strategy'
import { aiReady } from './engine/ai'
import { metaReady } from './engine/meta'
import AISettings from './components/AISettings'
import MetaSettings from './components/MetaSettings'
import { cls } from './lib/ui'
import Library from './views/Library'
import PillarBoard from './views/PillarBoard'
import Storyline from './views/Storyline'
import Calendar from './views/Calendar'
import Campaigns from './views/Campaigns'
import Strategy from './views/Strategy'

const NAV = [
  { to: '/library', label: 'Content Library', icon: '◳' },
  { to: '/pillars', label: 'Pillar Board', icon: '▦' },
  { to: '/storyline', label: 'Storyline', icon: '◷' },
  { to: '/calendar', label: 'Calendar', icon: '▤' },
  { to: '/campaigns', label: 'Campaigns', icon: '◆' },
  { to: '/strategy', label: 'Strategy Score', icon: '◎' },
]

export default function App() {
  const { posts, pillars, assets, aiConfig, metaConfig, generatePlan, resetAll } = useStore()
  const strategy = useMemo(() => analyzeStrategy(posts, pillars, assets), [posts, pillars, assets])
  const [aiOpen, setAiOpen] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const aiOn = aiReady(aiConfig)
  const metaOn = metaReady(metaConfig)

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 bg-valmer-ink text-white flex flex-col">
        <div className="px-5 py-6 border-b border-white/10">
          <div className="font-serif text-xl leading-tight">Valmer</div>
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Content Storyboard</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cls(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <span className="text-base opacity-80">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Strategy score</span>
            <span
              className={cls(
                'font-semibold tabular-nums',
                strategy.score >= 80 ? 'text-emerald-300' : strategy.score >= 60 ? 'text-amber-300' : 'text-rose-300',
              )}
            >
              {strategy.score}
            </span>
          </div>
          <button onClick={generatePlan} className="btn w-full bg-valmer-clay text-white hover:bg-valmer-clay/90">
            Generate 90-day plan
          </button>
          <button
            onClick={() => setAiOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
          >
            <span>AI caption writer</span>
            <span className={cls('chip text-[10px]', aiOn ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/50')}>
              {aiOn ? 'On' : 'Off'}
            </span>
          </button>
          <button
            onClick={() => setMetaOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
          >
            <span>Publish to Meta</span>
            <span className={cls('chip text-[10px]', metaOn ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/50')}>
              {metaOn ? 'Connected' : 'Off'}
            </span>
          </button>
          <div className="flex items-center justify-between text-[11px] text-white/40 leading-snug">
            <span>{assets.length} assets · {posts.length} posts planned</span>
            <button
              onClick={() => {
                if (confirm('Clear all content, posts, and campaigns? This cannot be undone.')) resetAll()
              }}
              className="text-white/40 underline hover:text-white/70"
            >
              Reset
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<Library />} />
          <Route path="/pillars" element={<PillarBoard />} />
          <Route path="/storyline" element={<Storyline />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/strategy" element={<Strategy />} />
        </Routes>
      </main>

      {aiOpen && <AISettings onClose={() => setAiOpen(false)} />}
      {metaOpen && <MetaSettings onClose={() => setMetaOpen(false)} />}
    </div>
  )
}
