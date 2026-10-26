import { useEffect } from 'react'
import { create } from 'zustand'
import { api } from '../lib/api.js'

const EMPTY = { enabled: null, loading: true, error: '', activityError: '' }
const consumers = new Map(), pending = new Map(), versions = new Map(), retries = new Map(), failures = new Map()
const cancelRetry = id => { clearTimeout(retries.get(id)); retries.delete(id) }
export const useLivePreferences = create(() => ({ entries: {} }))
const patch = (id, next) => useLivePreferences.setState(s => ({ entries: { ...s.entries, [id]: { ...EMPTY, ...s.entries[id], ...next } } }))
export function confirmLivePreference(id, enabled) {
  versions.set(id, (versions.get(id) || 0) + 1)
  pending.delete(id); cancelRetry(id); failures.delete(id)
  patch(id, { enabled: enabled === true, loading: false, error: '' })
}
export const reportLiveStatus = (id, activityError) => patch(id, { activityError })
export function refreshLivePreference(id) {
  if (!consumers.get(id) || pending.has(id)) return pending.get(id)
  cancelRetry(id)
  const version = versions.get(id) || 0
  patch(id, { loading: true })
  const promise = api('/api/me/live-sharing').then(data => {
    if (!consumers.get(id) || version !== (versions.get(id) || 0)) return
    failures.delete(id); patch(id, { enabled: data.enabled === true, loading: false, error: '' })
  }).catch(() => {
    if (!consumers.get(id) || version !== (versions.get(id) || 0)) return
    patch(id, { loading: false, error: 'No pudimos consultar esta preferencia. Se reintentará al recuperar conexión.' })
    const attempt = (failures.get(id) || 0) + 1; failures.set(id, attempt)
    retries.set(id, setTimeout(() => { retries.delete(id); refreshLivePreference(id) }, Math.min(30000, 2000 * 2 ** Math.min(attempt - 1, 4))))
  }).finally(() => { if (pending.get(id) === promise) pending.delete(id) })
  pending.set(id, promise)
  return promise
}
export function useSharingPreference(id) {
  const entry = useLivePreferences(s => id ? s.entries[id] || EMPTY : EMPTY)
  useEffect(() => {
    if (!id) return
    consumers.set(id, (consumers.get(id) || 0) + 1)
    const known = useLivePreferences.getState().entries[id]
    if (!known || known.enabled === null || known.error) refreshLivePreference(id)
    const online = () => refreshLivePreference(id)
    const visible = () => { if (document.visibilityState === 'visible') refreshLivePreference(id) }
    window.addEventListener('online', online); document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visible)
      const remaining = (consumers.get(id) || 1) - 1
      if (remaining) consumers.set(id, remaining)
      else {
        consumers.delete(id); pending.delete(id); cancelRetry(id); failures.delete(id)
        versions.set(id, (versions.get(id) || 0) + 1)
        useLivePreferences.setState(s => { const entries = { ...s.entries }; delete entries[id]; return { entries } })
      }
    }
  }, [id])
  return entry
}
