import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useStore } from './store/useStore'
import { analyzeStrategy } from './engine/strategy'
import { aiReady } from './engine/ai'
import { metaReady } from './engine/meta'
import AISettings from './components/AISettings'
import MetaSettings from './components/MetaSettings'
import BrandSwitcher from './components/BrandSwitcher'
import BrandOnboarding from './components/BrandOnboarding'
import Login from './components/Login'
import { cls } from './lib/ui'
import Library from './views/Library'
import PillarBoard from './views/PillarBoard'
import Storyline from './views/Storyline'
import Calendar from './views/Calendar'
import Campaigns from './views/Campaigns'
import Strategy from './views/Strategy'

const NAV = [
  { to: '/calendar', label: 'Calendar', icon: '▤' },
  { to: '/library', label: 'Content Library', icon: '◳' },
  { to: '/storyline', label: 'Storyline', icon: '◷' },
  { to: '/pillars', label: 'Pillar Board', icon: '▦' },
  { to: '/campaigns', label: 'Campaigns', icon: '◆' },
  { to: '/strategy', label: 'Strategy Score', icon: '◎' },
]

export default function App() {
  const { posts, pillars, assets, aiConfig, metaConfig, activeBrandId, sessionStatus, user, role, logout, generatePlan, resetAll } = useStore()
  const strategy = useMemo(() => analyzeStrategy(posts, pillars, assets), [posts, pillars, assets])
  const [aiOpen, setAiOpen] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)
  const [onboardDismissed, setOnboardDismissed] = useState<string | null>(null)
  const aiOn = aiReady(aiConfig)
  const metaOn = metaReady(metaConfig)
  const needsOnboarding = sessionStatus === 'in' && !!activeBrandId && pillars.length === 0 && onboardDismissed !== activeBrandId

  if (sessionStatus === 'loading') {
    return <div className="flex h-full items-center justify-center text-valmer-slate/50">Loading…</div>
  }
  if (sessionStatus === 'out') return <Login />

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 flex flex-col text-white" style={{ background: 'linear-gradient(165deg, #6366f1 0%, #a855f7 45%, #ec4899 100%)' }}>
        <div className="px-4 pt-5 pb-4 border-b border-white/15">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 font-serif text-xs font-semibold backdrop-blur">V</span>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Content Storyboard</div>
          </div>
          <BrandSwitcher />
          <div className="mt-3 px-1 text-sm text-white/60">{greeting}, <span className="text-white/90">Olyvia</span></div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cls('nav-link', isActive ? 'bg-white/15 text-white shadow-sm' : 'text-white/65 hover:bg-white/10 hover:text-white')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-white" />}
                  <span className={cls('text-base transition-transform', isActive ? 'opacity-100' : 'opacity-70')}>{n.icon}</span>
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10 space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Strategy score</span>
              <span className={cls('font-semibold tabular-nums', strategy.score >= 80 ? 'text-emerald-300' : strategy.score >= 60 ? 'text-amber-300' : 'text-rose-300')}>
                {strategy.score}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={cls('h-full rounded-full transition-all duration-500', strategy.score >= 80 ? 'bg-emerald-400' : strategy.score >= 60 ? 'bg-amber-400' : 'bg-rose-400')}
                style={{ width: `${strategy.score}%` }}
              />
            </div>
          </div>
          <button onClick={generatePlan} className="btn w-full bg-white font-semibold text-valmer-ink shadow-md hover:bg-white/90">
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
            <span>{assets.length} assets · {posts.length} posts</span>
            <button
              onClick={() => {
                if (confirm('Clear this brand\'s content, posts, and campaigns? This cannot be undone.')) resetAll()
              }}
              className="text-white/40 underline hover:text-white/70"
            >
              Reset
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px] text-white/50">
            <span className="truncate">{user?.name || user?.email}{role === 'viewer' ? ' · view only' : ''}</span>
            <button onClick={() => logout()} className="text-white/50 underline hover:text-white/80">Log out</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/calendar" replace />} />
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
      {needsOnboarding && <BrandOnboarding onClose={() => setOnboardDismissed(activeBrandId)} onOpenAI={() => setAiOpen(true)} />}
    </div>
  )
}
