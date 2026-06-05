// Production server: serves the built app and proxies the OpenAI + Meta calls,
// mirroring the Vite dev-server proxy so AI captions and Facebook publishing
// keep working once this is deployed off localhost.
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import crypto from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Load a local, gitignored .env if present (Node 20.12+). On a host like Render,
// these come from the dashboard environment instead.
try {
  process.loadEnvFile()
} catch {
  // no .env file — that's fine
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8080

// ---- Password gate (HTTP Basic Auth) ----
// Set APP_PASSWORD (and optionally APP_USER) in your host's environment to require
// a login before anything is served, including the proxy endpoints. If APP_PASSWORD
// is unset, the site is open (handy for local runs).
const APP_USER = process.env.APP_USER || 'valmer'
const APP_PASSWORD = process.env.APP_PASSWORD || ''

function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

if (APP_PASSWORD) {
  app.use((req, res, next) => {
    const [scheme, encoded] = (req.headers.authorization || '').split(' ')
    if (scheme === 'Basic' && encoded) {
      const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':')
      if (safeEqual(user, APP_USER) && safeEqual(pass, APP_PASSWORD)) return next()
    }
    res.set('WWW-Authenticate', 'Basic realm="Valmer Content Storyboard", charset="UTF-8"')
    return res.status(401).send('Authentication required.')
  })
  console.log('Password gate is ON.')
} else {
  console.warn('No APP_PASSWORD set — the site is OPEN. Set APP_PASSWORD to require a login.')
}

// Note: register proxies BEFORE any body parser so POST bodies stream through intact.
app.use(
  '/openai-proxy',
  createProxyMiddleware({
    target: 'https://api.openai.com',
    changeOrigin: true,
    pathRewrite: { '^/openai-proxy': '' },
  }),
)

app.use(
  '/meta-proxy',
  createProxyMiddleware({
    target: 'https://graph.facebook.com',
    changeOrigin: true,
    pathRewrite: { '^/meta-proxy': '' },
  }),
)

const dist = path.join(__dirname, 'dist')
app.use(express.static(dist))
// SPA fallback (the app uses hash routing, but this keeps the root + any path working).
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))

app.listen(PORT, () => {
  console.log(`Valmer Content Storyboard running on port ${PORT}`)
})
