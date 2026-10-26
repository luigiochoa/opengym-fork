import { describe, it, expect } from 'vitest'
import { applyTrainerPlan } from './trainer-plan.js'
import { EXIDX, registerCustom, allExercises, imgSrc, gifSrc } from './exercises.js'

const assignment = { id: 'assignment-1', bundle: { opengym_plan: 1, unit: 'kg', name: 'Piernas', routines: [{ id: 'r1', name: 'Piernas', ex: [{ id: '0598', sets: 3, reps: 10, weight: 60 }] }], week: { 1: ['r1'] }, customEx: [] } }
function state() { return { unit: 'kg', routines: [{ id: 'old', name: 'Existing', ex: [] }], week: { 1: ['old'], 2: ['old'] }, workouts: [{ id: 'history' }], bodyweight: [{ d: '2026-10-26', w: 80 }], customEx: [] } }
describe('human trainer plan', () => {
  it('keeps history, existing routines and unselected days; retries do not duplicate', () => {
    const s = state()
    expect(applyTrainerPlan(s, assignment)).toBe(true)
    expect(s.routines).toHaveLength(2)
    expect(s.week[1]).toEqual([s.routines[1].id])
    expect(s.week[2]).toEqual(['old'])
    expect(s.workouts).toEqual([{ id: 'history' }])
    expect(s.bodyweight).toHaveLength(1)
    expect(applyTrainerPlan(s, assignment)).toBe(false)
    expect(s.routines).toHaveLength(2)
  })
  it('converts the trainer load to the pupil unit', () => {
    const s = state(); s.unit = 'lb'
    applyTrainerPlan(s, assignment)
    expect(s.routines[1].ex[0].weight).toBeGreaterThan(130)
    expect(s.routines[1].ex[0].weight).toBeLessThan(133)
  })
  it('keeps the client hip thrust and local media after a server register', () => {
    registerCustom([])
    expect(EXIDX['ts-hip-thrust'].n).toBe('Hip thrust')
    expect(imgSrc(EXIDX['ts-hip-thrust'])).toBe('img/ts-hip-thrust.gif')
    expect(gifSrc(EXIDX['ts-hip-thrust'])).toBe('gif/ts-hip-thrust.gif')
    expect(allExercises({ customEx: [{ ...EXIDX['ts-hip-thrust'] }] }).filter(e => e.id === 'ts-hip-thrust')).toHaveLength(1)
  })
})
