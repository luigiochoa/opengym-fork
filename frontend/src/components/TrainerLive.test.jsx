// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore, DEF } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api, beacon } from '../lib/api.js'
import { StudentLiveSharing, TrainerLive, LiveActivityPublisher } from './TrainerLive.jsx'
vi.mock('../lib/api.js', () => ({ api: vi.fn(), beacon: vi.fn(), setRemoteAuth: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host, enabled
beforeEach(() => {
  vi.clearAllMocks(); beacon.mockReturnValue(true); enabled = false
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
  await show(<><LiveActivityPublisher /><StudentLiveSharing /></>)
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
  await show(<><LiveActivityPublisher /><StudentLiveSharing /></>)
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
  useStore.setState({ user: null }); await show(<><LiveActivityPublisher /><StudentLiveSharing /></>)
  expect(host.textContent).toBe('')
  useStore.setState({ user: { id: 'coach', admin: true, owner: true } }); await show(<><LiveActivityPublisher /><StudentLiveSharing /></>)
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


it('leaves a last active signal on page hide and resumes publishing when the page returns', async () => {
  vi.useFakeTimers(); enabled = true
  await show(<><LiveActivityPublisher /><StudentLiveSharing /></>)
  const calls = () => api.mock.calls.filter(([url]) => url === '/api/me/live-activity')
  const initial = calls().length
  await act(async () => { window.dispatchEvent(new Event('pagehide')); vi.advanceTimersByTime(20000) })
  expect(beacon).toHaveBeenCalledWith('/api/me/live-activity', expect.objectContaining({ active: true, sequence: 2 }))
  expect(calls()).toHaveLength(initial)
  await act(async () => window.dispatchEvent(new Event('pageshow')))
  expect(calls().length).toBeGreaterThan(initial)
})


it('continues after the route privacy control unmounts and stops when the session ends', async () => {
  enabled = true
  await show(<><LiveActivityPublisher /><StudentLiveSharing /></>)
  const payloads = () => api.mock.calls.filter(([url]) => url === '/api/me/live-activity').map(([, init]) => JSON.parse(init.body))
  await show(<><LiveActivityPublisher /></>)
  expect(payloads().at(-1).active).toBe(true)
  await act(async () => useStore.setState({ S: { ...useStore.getState().S, active: null } }))
  expect(payloads().at(-1).active).toBe(false)
})
it('does not publish historical edits or backfilled sessions from the global publisher', async () => {
  enabled = true
  for (const flags of [{ backfill: true }, { editingWorkoutId: 'past-session' }]) {
    useStore.setState({ S: { ...useStore.getState().S, active: { name: 'Histórico', ...flags } } })
    await show(<LiveActivityPublisher />)
  }
  expect(api.mock.calls.some(([url]) => url === '/api/me/live-activity')).toBe(false)
})
it('attempts an active final observation when the screen becomes hidden, not a stop', async () => {
  enabled = true
  await show(<LiveActivityPublisher />)
  const prior = document.visibilityState
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  try {
    await act(async () => document.dispatchEvent(new Event('visibilitychange')))
    expect(beacon).toHaveBeenCalledWith('/api/me/live-activity', expect.objectContaining({ active: true }))
  } finally { Object.defineProperty(document, 'visibilityState', { configurable: true, value: prior }) }
})


it('falls back to the API for the last active observation if beacon is unavailable', async () => {
  enabled = true; beacon.mockReturnValue(false)
  await show(<LiveActivityPublisher />)
  await act(async () => window.dispatchEvent(new Event('pagehide')))
  const payloads = api.mock.calls.filter(([url]) => url === '/api/me/live-activity').map(([, init]) => JSON.parse(init.body))
  expect(payloads.at(-1)).toMatchObject({ active: true, sequence: 3 })
})
