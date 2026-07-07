import { Router } from 'express'
import { db } from './db.js'
import { requireAuth } from './auth.js'

const router = Router()
router.use(requireAuth)

// Preview what an invite link is for.
router.get('/:token', async (req, res) => {
  const link = await db.get('SELECT il.brand_id, il.role, b.name FROM invite_links il JOIN brands b ON b.id=il.brand_id WHERE il.token=?', [req.params.token])
  if (!link) return res.status(404).json({ error: 'This invite link is not valid.' })
  res.json({ brandId: link.brand_id, brandName: link.name, role: link.role })
})

// Accept an invite link — adds the current user to the brand.
router.post('/:token/accept', async (req, res) => {
  const link = await db.get('SELECT brand_id, role FROM invite_links WHERE token=?', [req.params.token])
  if (!link) return res.status(404).json({ error: 'This invite link is not valid.' })
  const existing = await db.get('SELECT role FROM brand_members WHERE brand_id=? AND user_id=?', [link.brand_id, req.user.id])
  if (!existing) {
    await db.run('INSERT INTO brand_members (brand_id, user_id, role) VALUES (?,?,?)', [link.brand_id, req.user.id, link.role])
  }
  res.json({ brandId: link.brand_id })
})

export default router
