// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'
import { api } from '../lib/api.js'
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../lib/api.js', async original => ({ ...await original(), api: vi.fn() }))
vi.mock('../components/Assistance.jsx', () => ({ StudentAssistance: () => null }))
vi.mock('../components/TrainerLive.jsx', () => ({ StudentLiveSharing: () => null }))
vi.mock('../components/StudentPayments.jsx', () => ({ StudentPaymentCard: () => null }))
let host, root
const assignment = accepted => ({ id: 'assignment-1', trainerName: 'Humberto', bundle: { name: 'Rutina piloto' }, accepted })
beforeEach(() => {
 globalThis.IS_REACT_ACT_ENVIRONMENT = true
 api.mockReset();host = document.createElement('div');document.body.appendChild(host);root = createRoot(host)
 useStore.setState(s => ({ user: { id: 'pupil', name: 'Luigi' }, config: { trainer_pilot: true }, S: { ...s.S, routines: [], workouts: [], bodyweight: [], week: {}, dayPlan: {}, active: null } }))
})
afterEach(() => { act(() => root.unmount());host.remove();useStore.setState({ user: null, config: {} }) })
it('keeps today first and automatically reveals a newly assigned routine', async () => {
 api.mockResolvedValue({ assignment: assignment(null) })
 await act(async () => root.render(<Home />))
 const hub=host.querySelector('.student-coach-hub');expect(hub.open).toBe(true);expect(hub.textContent).toContain('Rutina nueva');expect(hub.textContent).toContain('Humberto')
 expect(host.querySelector('.home-today-card').compareDocumentPosition(hub) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})
it('keeps an accepted routine collapsed until the pupil opens it', async () => {
 api.mockResolvedValue({ assignment: assignment(123) })
 await act(async () => root.render(<Home />))
 expect(host.querySelector('.student-coach-hub').open).toBe(false)
})
it('allows the pupil to collapse a new routine without accepting or discarding it', async () => {
 api.mockResolvedValue({ assignment: assignment(null) })
 await act(async () => root.render(<Home />))
 const hub=host.querySelector('.student-coach-hub');expect(hub.open).toBe(true)
 await act(async () => { hub.open=false;hub.dispatchEvent(new Event('toggle')) })
 expect(hub.open).toBe(false)
 expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
})
