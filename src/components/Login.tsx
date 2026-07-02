import { useState } from 'react'
import { useStore } from '../store/useStore'

export default function Login() {
  const { login, signup, authError } = useStore()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signup') await signup(email, password, name)
      else await login(email, password)
    } catch {
      /* authError shown from store */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full w-full items-center justify-center p-6" style={{ background: 'linear-gradient(165deg, #6366f1 0%, #a855f7 45%, #ec4899 100%)' }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl animate-fadeup">
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-valmer-clay font-serif text-sm font-semibold text-white">V</span>
          <div className="text-[10px] uppercase tracking-[0.2em] text-valmer-slate/50">Content Storyboard</div>
        </div>
        <h1 className="mb-5 font-serif text-2xl text-valmer-ink">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="label">Your name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Olyvia" />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@brand.com" autoComplete="email" required />
          </div>
          <div>
            <label className="label">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="6+ characters" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required />
          </div>

          {authError && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{authError}</div>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-valmer-slate/60">
          {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
          <button onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')} className="font-semibold text-valmer-clay underline">
            {mode === 'signup' ? 'Log in' : 'Create one'}
          </button>
        </div>
      </div>
    </div>
  )
}
