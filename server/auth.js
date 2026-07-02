import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import db from './db.js'

const nowISO = () => new Date().toISOString()

function setSession(res, userId) {
  const token = crypto.randomUUID()
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)').run(token, userId, nowISO())
  res.cookie('sid', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  })
}

export function currentUser(req) {
  const token = req.cookies?.sid
  if (!token) return null
  const s = db.prepare('SELECT user_id FROM sessions WHERE token=?').get(token)
  if (!s) return null
  return db.prepare('SELECT id, email, name FROM users WHERE id=?').get(s.user_id) || null
}

export function requireAuth(req, res, next) {
  const u = currentUser(req)
  if (!u) return res.status(401).json({ error: 'Not logged in' })
  req.user = u
  next()
}

// When someone signs up, turn any pending invites for their email into memberships.
function claimInvites(email, userId) {
  const invites = db.prepare('SELECT brand_id, role FROM invites WHERE email=?').all(email)
  for (const i of invites) {
    db.prepare('INSERT OR IGNORE INTO brand_members (brand_id, user_id, role) VALUES (?,?,?)').run(i.brand_id, userId, i.role)
  }
  db.prepare('DELETE FROM invites WHERE email=?').run(email)
}

const router = Router()

router.post('/signup', (req, res) => {
  const { email, password, name } = req.body || {}
  const e = String(email || '').toLowerCase().trim()
  if (!e || !password || String(password).length < 6) return res.status(400).json({ error: 'Enter an email and a password of at least 6 characters.' })
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(e)) return res.status(400).json({ error: 'That email already has an account. Log in instead.' })
  const id = crypto.randomUUID()
  db.prepare('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?,?,?,?,?)').run(id, e, bcrypt.hashSync(String(password), 10), String(name || ''), nowISO())
  claimInvites(e, id)
  setSession(res, id)
  res.json({ user: { id, email: e, name: name || '' } })
})

router.post('/login', (req, res) => {
  const e = String(req.body?.email || '').toLowerCase().trim()
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(e)
  if (!u || !bcrypt.compareSync(String(req.body?.password || ''), u.password_hash)) return res.status(401).json({ error: 'Wrong email or password.' })
  setSession(res, u.id)
  res.json({ user: { id: u.id, email: u.email, name: u.name } })
})

router.post('/logout', (req, res) => {
  if (req.cookies?.sid) db.prepare('DELETE FROM sessions WHERE token=?').run(req.cookies.sid)
  res.clearCookie('sid')
  res.json({ ok: true })
})

router.get('/me', (req, res) => {
  const u = currentUser(req)
  if (!u) return res.status(401).json({ error: 'Not logged in' })
  res.json({ user: u })
})

export default router
