// White-label overrides (build-time). Defaults keep upstream openGym branding.
const ENV = import.meta.env || {}

// Set via Docker build args / pack/clients/<id>/branding — see pack/README.md.

export const APP_NAME = ENV.VITE_APP_NAME || 'openGym'
export const DEFAULT_ACCENT = ENV.VITE_DEFAULT_ACCENT || 'lime'
export const DEFAULT_LANG = ENV.VITE_DEFAULT_LANG || 'en'
export const SOURCE_URL = ENV.VITE_SOURCE_URL || 'https://github.com/luigiochoa/opengym-fork'
export const BRAND_TAGLINE = ENV.VITE_BRAND_TAGLINE || ''
/** Optional Instagram URL (build-time); shown on login when set. */
export const BRAND_INSTAGRAM = (ENV.VITE_BRAND_INSTAGRAM || '').trim()
/** When '1', Login shows the brand mark from apply-brand.sh. */
export const USE_BRAND_LOGO = ENV.VITE_BRAND_LOGO === '1'
/** Prefer SVG (transparent) when present; PNG remains for PWA icons. */
export const BRAND_LOGO_SRC = ENV.VITE_BRAND_LOGO_SRC || './brand-logo.png'
/** Exact brand accent hex (e.g. #67C00A). Used when DEFAULT_ACCENT is `brand`. */
export const BRAND_ACCENT = (ENV.VITE_BRAND_ACCENT || '').trim()

/** Darken a #RRGGBB for pressed/hover (--acc-2). */
export function accentPressed(hex, factor = 0.78) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#248a3d'
  const n = parseInt(m[1], 16)
  const r = Math.round(((n >> 16) & 255) * factor)
  const g = Math.round(((n >> 8) & 255) * factor)
  const b = Math.round((n & 255) * factor)
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

/** Black or white text on top of the accent. */
export function onAccent(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#000'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  // Perceived luminance
  return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? '#000' : '#fff'
}
