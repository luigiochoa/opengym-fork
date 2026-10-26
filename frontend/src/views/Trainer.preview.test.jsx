// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useUI } from '../store/useUI.js'
import Trainer from './Trainer.jsx'
import { api } from '../lib/api.js'
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('../components/TrainerLive.jsx', () => ({ TrainerLive: () => null }))
vi.mock('../components/Assistance.jsx', () => ({ TrainerAssistance: () => null }))
let host, root
const pupil = name => ({ id: name, name, weekly: {}, billing: { status: 'none' } })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = async () => { await act(async () => { await Promise.resolve() }) }
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; api.mockReset(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); useUI.setState({ sheets: [] }) })
afterEach(() => { act(() => root.unmount()); host.remove(); useUI.setState({ sheets: [] }) })
it('keeps the latest roster when an older response arrives after reconnection', async () => {
 const old = deferred(), recent = deferred(); api.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise)
 await act(async () => root.render(<Trainer />))
 act(() => window.dispatchEvent(new Event('online')))
 await act(async () => recent.resolve({ pupils: [pupil('Actual')] }))
 await act(async () => old.resolve({ pupils: [pupil('Anterior')] }))
 expect(host.textContent).toContain('Actual'); expect(host.textContent).not.toContain('Anterior')
})
it('does not replace a recovered roster with an old connection error', async () => {
 const old = deferred(), recent = deferred(); api.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise)
 await act(async () => root.render(<Trainer />))
 act(() => window.dispatchEvent(new Event('online')))
 await act(async () => recent.resolve({ pupils: [pupil('Recuperado')] }))
 await act(async () => old.reject(new Error('old network failure')))
 expect(host.textContent).toContain('Recuperado'); expect(host.querySelector('[role="alert"]')).toBeNull()
})
it('opens assignment on demand instead of rendering the form in the roster', async () => {
 api.mockResolvedValue({ pupils: [pupil('Ana')] }); await act(async () => root.render(<Trainer />)); await flush()
 expect(host.textContent).not.toContain('Seleccionar rutina')
 const assign = [...host.querySelectorAll('button')].find(b => b.textContent === 'Asignar rutina')
 act(() => assign.click()); expect(useUI.getState().sheets).toHaveLength(1)
})
it('opens assignment from a pupil with that pupil selected', async () => {
 const ana = { ...pupil('Ana'), weekly: { completedDays: 1, plannedDays: 0 } }
 api.mockImplementation(path => Promise.resolve(path === '/api/trainer/pupils' ? { pupils: [ana] } : path.startsWith('/api/admin/user') ? { workouts: [], unit: 'kg' } : { assignment: null, history: [] }))
 await act(async () => root.render(<Trainer />)); await flush()
 await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent.startsWith('Ana')).click())
 const detail = useUI.getState().sheets.at(-1)
 const detailHost = document.createElement('div'); document.body.appendChild(detailHost); const detailRoot = createRoot(detailHost)
 try {
  act(() => detailRoot.render(detail.render(() => {})))
  expect(detailHost.textContent).not.toContain('1/0')
  act(() => [...detailHost.querySelectorAll('button')].find(b => b.textContent === 'Asignar rutina').click())
  const assignment = useUI.getState().sheets.at(-1).render(() => {})
  expect(assignment.props.initialPupilId).toBe('Ana')
 } finally { act(() => detailRoot.unmount()); detailHost.remove() }
})
