import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from './db.js'
import { requireAuth } from './auth.js'

const nowISO = () => new Date().toISOString()
const router = Router()
router.use(requireAuth)

function membership(brandId, userId) {
  return db.get('SELECT role FROM brand_members WHERE brand_id=? AND user_id=?', [brandId, userId])
}

router.get('/', async (req, res) => {
  const rows = await db.all(
    `SELECT b.id, b.name, b.updated_at AS "updatedAt", m.role,
       (SELECT name FROM users WHERE id=b.updated_by) AS "updatedByName",
       (SELECT email FROM users WHERE id=b.updated_by) AS "updatedByEmail"
     FROM brands b JOIN brand_members m ON m.brand_id=b.id
     WHERE m.user_id=? ORDER BY b.updated_at DESC`,
    [req.user.id],
  )
  res.json({ brands: rows })
})

router.post('/', async (req, res) => {
  const id = crypto.randomUUID()
  const name = String(req.body?.name || 'New brand').slice(0, 120)
  const content = typeof req.body?.content === 'string' ? req.body.content : JSON.stringify(req.body?.content || {})
  await db.run('INSERT INTO brands (id, name, owner_id, content, updated_at, updated_by) VALUES (?,?,?,?,?,?)', [id, name, req.user.id, content, nowISO(), req.user.id])
  await db.run('INSERT INTO brand_members (brand_id, user_id, role) VALUES (?,?,?)', [id, req.user.id, 'owner'])
  res.json({ id, name })
})

router.get('/:id', async (req, res) => {
  const m = await membership(req.params.id, req.user.id)
  if (!m) return res.status(403).json({ error: 'No access to this brand' })
  const b = await db.get('SELECT * FROM brands WHERE id=?', [req.params.id])
  if (!b) return res.status(404).json({ error: 'Brand not found' })
  const members = await db.all('SELECT u.email, u.name, m.role FROM brand_members m JOIN users u ON u.id=m.user_id WHERE m.brand_id=?', [req.params.id])
  res.json({ id: b.id, name: b.name, content: b.content, role: m.role, updatedAt: b.updated_at, members })
})

router.put('/:id', async (req, res) => {
  const m = await membership(req.params.id, req.user.id)
  if (!m) return res.status(403).json({ error: 'No access to this brand' })
  if (m.role === 'viewer') return res.status(403).json({ error: 'You have view-only access' })
  const content = typeof req.body?.content === 'string' ? req.body.content : JSON.stringify(req.body?.content || {})
  const name = req.body?.name != null ? String(req.body.name) : null
  await db.run('UPDATE brands SET content=?, name=COALESCE(?, name), updated_at=?, updated_by=? WHERE id=?', [content, name, nowISO(), req.user.id, req.params.id])
  await db.run('INSERT INTO edits (brand_id, user_id, at, summary) VALUES (?,?,?,?)', [req.params.id, req.user.id, nowISO(), String(req.body?.summary || 'edited')])
  res.json({ ok: true, updatedAt: nowISO(), updatedBy: req.user.name || req.user.email })
})

router.post('/:id/share', async (req, res) => {
  const m = await membership(req.params.id, req.user.id)
  if (!m || m.role !== 'owner') return res.status(403).json({ error: 'Only the owner can share this brand' })
  const email = String(req.body?.email || '').toLowerCase().trim()
  const role = req.body?.role === 'viewer' ? 'viewer' : 'editor'
  if (!email) return res.status(400).json({ error: 'Enter an email' })
  const u = await db.get('SELECT id FROM users WHERE email=?', [email])
  if (u) {
    await db.run('INSERT INTO brand_members (brand_id, user_id, role) VALUES (?,?,?) ON CONFLICT (brand_id, user_id) DO UPDATE SET role=excluded.role', [req.params.id, u.id, role])
    res.json({ status: 'added', email, role })
  } else {
    await db.run('INSERT INTO invites (email, brand_id, role, created_at) VALUES (?,?,?,?) ON CONFLICT (email, brand_id) DO UPDATE SET role=excluded.role', [email, req.params.id, role, nowISO()])
    res.json({ status: 'invited', email, role })
  }
})

router.delete('/:id', async (req, res) => {
  const m = await membership(req.params.id, req.user.id)
  if (!m || m.role !== 'owner') return res.status(403).json({ error: 'Only the owner can delete this brand' })
  await db.run('DELETE FROM brands WHERE id=?', [req.params.id])
  await db.run('DELETE FROM brand_members WHERE brand_id=?', [req.params.id])
  await db.run('DELETE FROM edits WHERE brand_id=?', [req.params.id])
  await db.run('DELETE FROM invites WHERE brand_id=?', [req.params.id])
  res.json({ ok: true })
})

router.get('/:id/activity', async (req, res) => {
  const m = await membership(req.params.id, req.user.id)
  if (!m) return res.status(403).json({ error: 'No access to this brand' })
  const rows = await db.all('SELECT e.at, e.summary, u.name, u.email FROM edits e JOIN users u ON u.id=e.user_id WHERE e.brand_id=? ORDER BY e.id DESC LIMIT 50', [req.params.id])
  res.json({ activity: rows })
})

export default router
