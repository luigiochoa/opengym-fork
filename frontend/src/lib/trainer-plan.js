import { parsePlan, mergePlan } from './plan-share.js'

// Merge, never replace history or routines. Only the selected weekdays are reassigned.
// The marker is synced too, so a retry or another device cannot import the same plan twice.
export function applyTrainerPlan(s, assignment) {
  if (!assignment?.id || !assignment.bundle) throw new Error('Invalid assignment')
  if (s.trainerApplied?.includes(assignment.id)) return false
  const bundle = parsePlan(JSON.stringify(assignment.bundle), s.unit || 'kg')
  const start = s.routines.length
  mergePlan(s, bundle)
  const ids = new Map(bundle.routines.map((r, i) => {
    const id = `trainer-${assignment.id}-${i}`
    s.routines[start + i].id = id
    return [r.id, id]
  }))
  s.week ||= {}
  for (const [day, routines] of Object.entries(bundle.week || {})) {
    const values = [].concat(routines).map(id => ids.get(id)).filter(Boolean)
    if (values.length) s.week[day] = values
  }
  s.trainerApplied = [...(s.trainerApplied || []), assignment.id].slice(-100)
  return true
}
