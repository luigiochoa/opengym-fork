import { it, expect } from 'vitest'
import { liveSnapshot, liveDescription } from './trainer-live.js'
const active = { name: 'Piernas', cur: 1, entries: [{ name: 'Sentadilla', sets: [{ done: true }, { done: false }] }, { name: 'Prensa', sets: [{ done: false }] }] }
it('reports the selected exercise and only the recorded progress', () => {
  const snapshot = liveSnapshot(active, null, 1000)
  expect(snapshot.exercise).toBe('Prensa')
  expect(snapshot.setsDone).toBe(1)
  expect(snapshot.setsTotal).toBe(3)
  expect(snapshot.phase).toBe('exercise')
})
it('does not publish absent sessions or historical edits', () => {
  expect(liveSnapshot(null, null)).toEqual({ active: false })
  expect(liveSnapshot({ ...active, backfill: true }, null)).toEqual({ active: false })
  expect(liveSnapshot({ ...active, editingWorkoutId: 'saved-workout' }, null)).toEqual({ active: false })
})
it('distinguishes a running rest, a paused rest, and a completed rest', () => {
  expect(liveSnapshot(active, { endsAt: 5000, left: 4 }, 1000).phase).toBe('rest')
  expect(liveSnapshot(active, { endsAt: 500, left: 4, paused: true }, 1000)).toMatchObject({ phase: 'rest-paused', restRemaining: 4, restEndsAt: null })
  expect(liveSnapshot(active, { endsAt: 500, ready: true }, 1000).phase).toBe('rest-finished')
  expect(liveSnapshot(active, { endsAt: 5000, kind: 'switch' }, 1000).phase).toBe('exercise')
})
it('never implies a pupil resumed a set when the timer expires', () => {
  expect(liveDescription({ phase: 'rest', restEndsAt: 5000, updatedAt: 1000 }, 6000)).toContain('Esperando actualización')
})
it('shows stale data even if a cached running timer still has time left', () => {
  expect(liveDescription({ phase: 'rest', restEndsAt: 100000, updatedAt: 1000 }, 36000)).toBe('Sin señal reciente')
})
it('shows a countdown from the server deadline without requiring another poll', () => {
  const activity = { phase: 'rest', restEndsAt: 60000, updatedAt: 1000 }
  expect(liveDescription(activity, 1000)).toContain('59 s restantes')
  expect(liveDescription(activity, 2000)).toContain('58 s restantes')
})


it('counts each recorded side the same way as the workout progress', () => {
  const snapshot = liveSnapshot({ name: 'Unilateral', cur: 0, entries: [{ name: 'Remo', sets: [{ sides: { L: { done: true }, R: { done: false } } }] }] }, null)
  expect(snapshot.setsDone).toBe(1)
  expect(snapshot.setsTotal).toBe(2)
})
