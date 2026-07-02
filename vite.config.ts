import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    // Route OpenAI calls through the dev server so the browser talks same-origin
    // (no CORS). The API key is forwarded from the browser via the Authorization
    // header and never stored server-side.
    proxy: {
      // App API runs on the Node server (npm start) during local dev.
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
      '/openai-proxy': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/openai-proxy/, ''),
        // Move the OpenAI key from X-Api-Key into Authorization so it never collides
        // with the site's Basic Auth login header.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            const key = proxyReq.getHeader('x-api-key')
            if (key) {
              proxyReq.setHeader('authorization', `Bearer ${key}`)
              proxyReq.removeHeader('x-api-key')
            }
          })
        },
      },
      // Meta Graph API (Facebook publishing). Same-origin proxy avoids CORS.
      '/meta-proxy': {
        target: 'https://graph.facebook.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/meta-proxy/, ''),
      },
    },
  },
})
