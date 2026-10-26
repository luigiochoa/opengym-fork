// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { StudentAssistance, TrainerAssistance } from './Assistance.jsx'
import { api } from '../lib/api.js'
vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host
beforeEach(() => {
  vi.clearAllMocks()
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
