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
      '/openai-proxy': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/openai-proxy/, ''),
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
