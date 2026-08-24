// White-label overrides (build-time). Defaults keep upstream openGym branding.
// Set via Docker build args / pack/clients/<id>/branding — see pack/README.md.

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'openGym'
export const DEFAULT_ACCENT = import.meta.env.VITE_DEFAULT_ACCENT || 'lime'
export const SOURCE_URL = import.meta.env.VITE_SOURCE_URL || 'https://gitlab.com/DuarteSantos8/opengym'
export const BRAND_TAGLINE = import.meta.env.VITE_BRAND_TAGLINE || ''
/** When '1', Login/Home prefer /brand-logo.png (copied by pack/scripts/apply-brand.sh). */
export const USE_BRAND_LOGO = import.meta.env.VITE_BRAND_LOGO === '1'
