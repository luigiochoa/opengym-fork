// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api, beacon } from '../lib/api.js'
import { StudentLiveSharing, TrainerLive } from './TrainerLive.jsx'
vi.mock('../lib/api.js', () => ({ api: vi.fn(), beacon: vi.fn(), setRemoteAuth: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host, enabled
beforeEach(() => {
  vi.clearAllMocks(); enabled = false
  useStore.setState({ S: { ...structuredClone(DEF), active: { name: 'Piernas', cur: 0, entries: [{ name: 'Sentadilla', sets: [{ done: false }] }] } }, user: { id: 'ana' }, config: { trainer_pilot: true } })
  useUI.setState({ timer: null })
  api.mockImplementation(async (url, init) => {
    if (url === '/api/me/live-sharing' && init?.method === 'POST') enabled = JSON.parse(init.body).enabled
    if (url === '/api/me/live-sharing') return { enabled }
    return { ok: true }
  })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers() })
const show = async el => act(async () => { root.render(el); await Promise.resolve(); await Promise.resolve() })
it('does not publish until pupil explicitly opts in, and sends stop on unmount', async () => {
  await show(<StudentLiveSharing inSession />)
  expect(host.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('false')
  expect(api.mock.calls.some(([url]) => url === '/api/me/live-activity')).toBe(false)
  await act(async () => host.querySelector('[role="switch"]').click())
  const payloads = () => api.mock.calls.filter(([url]) => url === '/api/me/live-activity').map(([, init]) => JSON.parse(init.body))
  expect(payloads()[0]).toMatchObject({ active: true, exercise: 'Sentadilla', phase: 'exercise', sequence: 1 })
  await act(async () => root.render(null))
  expect(payloads().at(-1).active).toBe(false)
  expect(payloads().at(-1).sequence).toBeGreaterThan(1)
})
it('publishes exercise changes and rest transitions without sending every timer tick', async () => {
  vi.useFakeTimers(); enabled = true
  await show(<StudentLiveSharing inSession />)
  await act(async () => {
    useUI.setState({ timer: { endsAt: Date.now() + 90000, left: 90 } })
    vi.advanceTimersByTime(300)
  })
  const payloads = () => api.mock.calls.filter(([url]) => url === '/api/me/live-activity').map(([, init]) => JSON.parse(init.body))
  expect(payloads().at(-1).phase).toBe('rest')
  const before = payloads().length
  await act(async () => { useUI.setState({ timer: { ...useUI.getState().timer, left: 89 } }); vi.advanceTimersByTime(300) })
  expect(payloads()).toHaveLength(before)
  await act(async () => { useUI.setState({ timer: { ...useUI.getState().timer, paused: true } }); vi.advanceTimersByTime(300) })
  expect(payloads().at(-1)).toMatchObject({ phase: 'rest-paused', restRemaining: 89 })
})
it('hides sharing controls from guests and administrators', async () => {
  useStore.setState({ user: null }); await show(<StudentLiveSharing inSession />)
  expect(host.textContent).toBe('')
  useStore.setState({ user: { id: 'coach', admin: true, owner: true } }); await show(<StudentLiveSharing inSession />)
  expect(host.textContent).toBe('')
  expect(api).not.toHaveBeenCalled()
})
it('shows stale status after loss of signal even when no subsequent poll succeeds', async () => {
  vi.useFakeTimers(); useStore.setState({ user: { id: 'coach', admin: true, owner: true } })
  const now = Date.now()
  api.mockResolvedValueOnce({ serverTime: now, pupils: [{ id: 'ana', name: 'Ana', activity: { workout: 'Piernas', exercise: 'Sentadilla', phase: 'rest', restEndsAt: now + 90000, setsDone: 1, setsTotal: 3, updatedAt: now, stale: false } }] }).mockRejectedValue(new Error('offline'))
  await show(<TrainerLive />)
  expect(host.textContent).toContain('Descansando')
  await act(async () => { vi.advanceTimersByTime(36000); await Promise.resolve() })
  expect(host.textContent).toContain('Sin señal reciente')
})


it('stops on page close and only resumes publishing when the page returns', async () => {
  vi.useFakeTimers(); enabled = true
  await show(<StudentLiveSharing inSession />)
  const calls = () => api.mock.calls.filter(([url]) => url === '/api/me/live-activity')
  const initial = calls().length
  await act(async () => { window.dispatchEvent(new Event('pagehide')); vi.advanceTimersByTime(20000) })
  expect(beacon).toHaveBeenCalledWith('/api/me/live-activity', expect.objectContaining({ active: false, sequence: 2 }))
  expect(calls()).toHaveLength(initial)
  await act(async () => window.dispatchEvent(new Event('pageshow')))
  expect(calls().length).toBeGreaterThan(initial)
})
