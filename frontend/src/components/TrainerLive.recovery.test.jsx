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
  vi.resetAllMocks(); beacon.mockReturnValue(true); enabled = false
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
it('an initial preference read failure recovers when connectivity returns', async () => {
  vi.useFakeTimers(); enabled = true
  api.mockRejectedValueOnce(new TypeError('offline at startup'))
  await show(<LiveActivityPublisher />)
  await act(async () => { window.dispatchEvent(new Event('online')); vi.advanceTimersByTime(60000) })
  const writes = api.mock.calls.filter(([url]) => url === '/api/me/live-activity')
  expect(writes.length).toBeGreaterThan(0)
})
it('a successful preference read on a route repairs the failed global publisher state', async () => {
  enabled = true
  api.mockRejectedValueOnce(new TypeError('offline at startup'))
  await show(<><LiveActivityPublisher /></>)
  await show(<><LiveActivityPublisher /><StudentLiveSharing /></>)
  expect(host.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
  const writes = api.mock.calls.filter(([url]) => url === '/api/me/live-activity')
  expect(writes.length).toBeGreaterThan(0)
})
