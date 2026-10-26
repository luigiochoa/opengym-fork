// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { StudentAssistance, TrainerAssistance } from './Assistance.jsx'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
beforeEach(() => {
  vi.clearAllMocks()
  useUI.setState({ sheets: [] })
  useStore.setState({ user: { id: 'ana', name: 'Ana' }, config: { trainer_pilot: true } })
  api.mockResolvedValue({ request: null })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const show = async el => act(async () => { root.render(el); await Promise.resolve(); await Promise.resolve() })
it('restricts requesting assistance to signed-in pupils', async () => {
  await show(<StudentAssistance />)
  expect(host.textContent).toContain('Pedir ayuda a mi entrenador')
  api.mockClear()
  await act(async () => useStore.setState({ user: { id: 'owner', admin: true, owner: true } }))
  expect(host.textContent).toBe('')
  expect(api).not.toHaveBeenCalled()
  await act(async () => useStore.setState({ user: null }))
  expect(host.textContent).toBe('')
})
it('prevents duplicate pending requests and displays the trainer acknowledgement', async () => {
  api.mockResolvedValue({ request: { status: 'pending' } })
  await show(<StudentAssistance />)
  expect(host.textContent).toContain('Esperando al entrenador')
  expect(host.querySelector('button')).toBeNull()
  api.mockResolvedValue({ request: { status: 'attending' } })
  await act(async () => window.dispatchEvent(new Event('assistance-change')))
  expect(host.textContent).toContain('ya vio tu solicitud')
})
it('lets the owner acknowledge a request and explains local push availability', async () => {
  useStore.setState({ user: { id: 'owner', admin: true, owner: true } })
  api.mockResolvedValue({ requests: [{ id: 'help1', userId: 'ana', name: 'Ana', kind: 'question', status: 'pending', created: Date.now(), note: 'Revisa mi técnica' }] })
  await show(<TrainerAssistance />)
  expect(host.textContent).toContain('Ana tiene una duda')
  expect(host.textContent).toContain('Revisa mi técnica')
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Voy a ayudarte').click())
  expect(api).toHaveBeenCalledWith('/api/trainer/assistance/status', { method: 'POST', body: JSON.stringify({ id: 'help1', status: 'attending' }) })
  expect(host.textContent).toContain('HTTPS')
})

it('ignores a slow older poll after a newer result arrives', async () => {
  let finishOld
  api.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
  await show(<StudentAssistance />)
  api.mockResolvedValue({ request: { status: 'attending' } })
  await act(async () => window.dispatchEvent(new Event('assistance-change')))
  expect(host.textContent).toContain('ya vio tu solicitud')
  await act(async () => finishOld({ request: { status: 'pending' } }))
  expect(host.textContent).toContain('ya vio tu solicitud')
  expect(host.textContent).not.toContain('Esperando al entrenador')
})
it('refreshes on reconnection and recovers from a failed read', async () => {
  api.mockRejectedValueOnce(new Error('offline'))
  await show(<StudentAssistance />)
  expect(host.textContent).toContain('Revisa tu conexión')
  api.mockResolvedValue({ request: { status: 'resolved' } })
  await act(async () => window.dispatchEvent(new Event('online')))
  expect(host.textContent).toContain('marcó la solicitud como atendida')
  expect(host.textContent).not.toContain('Revisa tu conexión')
})
it('applies a successful send immediately without letting an older poll restore an empty inbox', async () => {
  let finishOld
  api.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
  await show(<StudentAssistance />)
  await act(async () => window.dispatchEvent(new CustomEvent('assistance-change', { detail: { userId: 'ana', request: { status: 'pending' } } })))
  expect(host.textContent).toContain('Esperando al entrenador')
  await act(async () => finishOld({ request: null }))
  expect(host.textContent).toContain('Esperando al entrenador')
})
it('does not expose the previous pupil request when the account changes', async () => {
  api.mockResolvedValueOnce({ request: { status: 'attending' } })
  await show(<StudentAssistance />)
  expect(host.textContent).toContain('ya vio tu solicitud')
  api.mockImplementationOnce(() => new Promise(() => {}))
  await act(async () => useStore.setState({ user: { id: 'bea' } }))
  expect(host.textContent).not.toContain('ya vio tu solicitud')
})


it('keeps one retry identity after a failed send, with a clear Spanish error', async () => {
  await show(<StudentAssistance />)
  await act(async () => host.querySelector('button').click())
  const sheet = useUI.getState().sheets.at(-1)
  const close = vi.fn()
  await show(sheet.render(close))
  api.mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const send = () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Avisar a mi entrenador')
  await act(async () => send().click())
  expect(host.textContent).toContain('Tu mensaje sigue aquí')
  expect(host.textContent).not.toContain('Failed to fetch')
  expect(close).not.toHaveBeenCalled()
  api.mockResolvedValueOnce({ request: { status: 'pending' } })
  await act(async () => send().click())
  const writes = api.mock.calls.filter(([url, init]) => url === '/api/me/assistance' && init?.method === 'POST').map(([, init]) => JSON.parse(init.body))
  expect(writes).toHaveLength(2)
  expect(writes[0].requestId).toBeTruthy()
  expect(writes[1].requestId).toBe(writes[0].requestId)
  expect(close).toHaveBeenCalledOnce()
})
it('does not send an open request form under a different account', async () => {
  await show(<StudentAssistance />)
  await act(async () => host.querySelector('button').click())
  const sheet = useUI.getState().sheets.at(-1)
  await show(sheet.render(vi.fn()))
  await act(async () => useStore.setState({ user: { id: 'bea' } }))
  api.mockClear()
  await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Avisar a mi entrenador').click())
  expect(api).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Tu sesión cambió')
})


it('still displays a slow response when the next scheduled poll is already in flight', async () => {
  vi.useFakeTimers()
  try {
    let finishFirst
    api.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve }))
    api.mockImplementationOnce(() => new Promise(() => {}))
    await show(<StudentAssistance />)
    await act(async () => vi.advanceTimersByTime(10000))
    await act(async () => finishFirst({ request: { status: 'pending' } }))
    expect(host.textContent).toContain('Esperando al entrenador')
  } finally { vi.useRealTimers() }
})
