import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'
const appName = process.env.VITE_APP_NAME || 'openGym'
const appDesc = process.env.VITE_APP_DESCRIPTION || 'Personal gym & body weight tracker'
const appLang = process.env.VITE_DEFAULT_LANG || 'en'

// Optional web analytics (Umami). Injected only when BOTH vars are set at build time,
// so a plain `npm run build` — and every self-hosted install — stays telemetry-free.
// Set for the public instance: VITE_UMAMI_SRC=https://stats.example/script.js VITE_UMAMI_ID=<uuid>
const umamiSrc = process.env.VITE_UMAMI_SRC
const umamiId = process.env.VITE_UMAMI_ID

const umami = {
  name: 'opengym-umami',
  transformIndexHtml() {
    if (!umamiSrc || !umamiId) return
    return [{
      tag: 'script',
      attrs: { defer: true, src: umamiSrc, 'data-website-id': umamiId },
      injectTo: 'head'
    }]
  }
}

/** Inject white-label name into <title> / apple-mobile-web-app-title at build time. */
const brandHtml = {
  name: 'opengym-brand',
  transformIndexHtml(html) {
    return html
      .replace(/lang="en"/, `lang="${appLang}"`)
      .replace(/<title>[^<]*<\/title>/, `<title>${appName}</title>`)
      .replace(/content="openGym"/g, `content="${appName}"`)
      .replace(/content="Personal gym & body weight tracker"/, `content="${appDesc}"`)
  }
}

export default defineConfig({
  plugins: [react(), umami, brandHtml],
  base: './',
  server: {
    proxy: {
      '/api': { target: backend, changeOrigin: true },
      '/img': { target: media, changeOrigin: true },
      '/gif': { target: media, changeOrigin: true }
    }
  },
  build: { chunkSizeWarningLimit: 1500 }
})
