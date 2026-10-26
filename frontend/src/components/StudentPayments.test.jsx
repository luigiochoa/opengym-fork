// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { useStore, DEF } from '../store/useStore.js'
import StudentPayments, { StudentPaymentCard } from './StudentPayments.jsx'
import { api } from '../lib/api.js'
import { enablePush } from '../lib/push.js'
const mocks = vi.hoisted(() => ({ supported: false }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn() }))
vi.mock('../lib/push.js', () => ({ pushSupported: () => mocks.supported, enablePush: vi.fn(async () => {}), syncPushSubscription: vi.fn(async () => false) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
let root, host, data
beforeEach(() => {
  mocks.supported = false
  vi.clearAllMocks()
  useStore.setState({ S: structuredClone(DEF), user: { id: 'pupil', name: 'Ana' }, config: { trainer_pilot: true } })
  data = { payments: [{ id: 'p1', paidOn: '2026-10-26', validFrom: '2026-10-26', nextDueOn: '2026-11-26', amountMinor: 3050, currency: 'USD', note: 'PRIVATE-TRAINER-NOTE' }], summary: { status: 'current', paidOn: '2026-10-26', nextDueOn: '2026-11-26' }, reminders: { enabled: false, time: '09:00', timeZone: 'America/Caracas' }, today: '2026-10-26' }
  api.mockImplementation(async (path, opts) => {
    if (path === '/api/me/payment-reminders') { data = { ...data, reminders: JSON.parse(opts.body) }; return { reminders: data.reminders } }
    return data
  })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
const show = async el => act(async () => { root.render(<MemoryRouter>{el}</MemoryRouter>); await Promise.resolve(); await Promise.resolve() })
it('shows the pupil dates and read-only history, never trainer notes or editing actions', async () => {
  await show(<StudentPayments />)
  expect(host.textContent).toContain('Mis pagos')
  expect(host.textContent.toLowerCase()).toContain('26 nov 2026')
  expect(host.textContent).not.toContain('PRIVATE-TRAINER-NOTE')
  expect(host.textContent).not.toContain('Registrar pago')
  expect(host.textContent).not.toContain('Anular registro')
  expect(api).toHaveBeenCalledWith('/api/me/payments')
})
it('saves an explicit opt-in locally without pretending a push permission was granted', async () => {
  await show(<StudentPayments />)
  await act(async () => host.querySelector('[role="switch"]').click())
  expect(enablePush).not.toHaveBeenCalled()
  expect(host.textContent).toContain('Los push no están disponibles')
  const write = api.mock.calls.find(([path]) => path === '/api/me/payment-reminders')
  expect(JSON.parse(write[1].body).enabled).toBe(true)
})
it('does not enable reminders when the browser refuses notification permission', async () => {
  mocks.supported = true; enablePush.mockRejectedValueOnce(new Error('Permission denied'))
  await show(<StudentPayments />)
  await act(async () => host.querySelector('[role="switch"]').click())
  expect(host.textContent).toContain('Permission denied')
  expect(api.mock.calls.some(([path]) => path === '/api/me/payment-reminders')).toBe(false)
  expect(host.querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('false')
})
it('does not request a pupil payment card for an admin', async () => {
  useStore.setState({ user: { id: 'owner', admin: true, owner: true } })
  await show(<StudentPaymentCard />)
  expect(host.textContent).toBe('')
  expect(api).not.toHaveBeenCalled()
})

it('keeps the guest Home usable without requesting any private payments', async () => {
  useStore.setState({ user: null })
  await show(<StudentPaymentCard />)
  expect(host.textContent).toBe('')
  expect(api).not.toHaveBeenCalled()
})
