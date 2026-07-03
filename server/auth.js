import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { db } from './db.js'

const nowISO = () => new Date().toISOString()

async function setSession(res, userId) {
  const token = crypto.randomUUID()
  await db.run('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)', [token, userId, nowISO()])
  res.cookie('sid', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  })
}

export async function currentUser(req) {
  const token = req.cookies?.sid
  if (!token) return null
  const s = await db.get('SELECT user_id FROM sessions WHERE token=?', [token])
  if (!s) return null
  return (await db.get('SELECT id, email, name FROM users WHERE id=?', [s.user_id])) || null
}

export async function requireAuth(req, res, next) {
  try {
    const u = await currentUser(req)
    if (!u) return res.status(401).json({ error: 'Not logged in' })
    req.user = u
    next()
  } catch (e) {
    res.status(500).json({ error: 'Server error' })
  }
}

// When someone signs up, turn any pending invites for their email into memberships.
async function claimInvites(email, userId) {
  const invites = await db.all('SELECT brand_id, role FROM invites WHERE email=?', [email])
  for (const i of invites) {
    await db.run('INSERT INTO brand_members (brand_id, user_id, role) VALUES (?,?,?) ON CONFLICT (brand_id, user_id) DO NOTHING', [i.brand_id, userId, i.role])
  }
  await db.run('DELETE FROM invites WHERE email=?', [email])
}

const router = Router()

router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {}
    const e = String(email || '').toLowerCase().trim()
    if (!e || !password || String(password).length < 6) return res.status(400).json({ error: 'Enter an email and a password of at least 6 characters.' })
    if (await db.get('SELECT 1 FROM users WHERE email=?', [e])) return res.status(400).json({ error: 'That email already has an account. Log in instead.' })
    const id = crypto.randomUUID()
    await db.run('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?,?,?,?,?)', [id, e, bcrypt.hashSync(String(password), 10), String(name || ''), nowISO()])
    await claimInvites(e, id)
    await setSession(res, id)
    res.json({ user: { id, email: e, name: name || '' } })
  } catch (err) {
    res.status(500).json({ error: 'Could not create the account.' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const e = String(req.body?.email || '').toLowerCase().trim()
    const u = await db.get('SELECT * FROM users WHERE email=?', [e])
    if (!u || !bcrypt.compareSync(String(req.body?.password || ''), u.password_hash)) return res.status(401).json({ error: 'Wrong email or password.' })
    await setSession(res, u.id)
    res.json({ user: { id: u.id, email: u.email, name: u.name } })
  } catch (err) {
    res.status(500).json({ error: 'Login failed.' })
  }
})

router.post('/logout', async (req, res) => {
  if (req.cookies?.sid) await db.run('DELETE FROM sessions WHERE token=?', [req.cookies.sid])
  res.clearCookie('sid')
  res.json({ ok: true })
})

router.get('/me', async (req, res) => {
  const u = await currentUser(req)
  if (!u) return res.status(401).json({ error: 'Not logged in' })
  res.json({ user: u })
})

export default router
