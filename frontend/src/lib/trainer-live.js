import { doneUnits, setUnits } from './history.js'
import { exOr } from './exercises.js'
import { exerciseNameFor } from './i18n-core.js'

// This reports the selected exercise and recorded sets, never inferred physical movement.
export function liveSnapshot(active, timer, now = Date.now()) {
  if (!active || active.backfill || active.editingWorkoutId) return { active: false }
  const entries = Array.isArray(active.entries) ? active.entries : []
  const entry = entries[active.cur] || entries[0]
  const sets = entries.flatMap(e => Array.isArray(e.sets) ? e.sets.filter(Boolean) : [])
  const resting = timer && timer.kind !== 'switch' && !timer.ready && (timer.paused ? timer.left > 0 : timer.endsAt > now)
  return { active: true, workout: active.name || 'Entrenamiento', exercise: entry ? (entry.name || entry.n || exerciseNameFor(exOr(entry.id))) : '',
    setsDone: sets.reduce((total, set) => total + doneUnits(set), 0), setsTotal: sets.reduce((total, set) => total + setUnits(set), 0),
    phase: resting ? (timer.paused ? 'rest-paused' : 'rest') : timer?.ready && timer.kind !== 'switch' ? 'rest-finished' : 'exercise',
    restEndsAt: resting && !timer.paused ? timer.endsAt : null,
    restRemaining: resting && timer.paused ? Math.ceil(timer.left) : null }
}
export function liveDescription(activity, now = Date.now()) {
  if (!activity || activity.stale || now - activity.updatedAt >= 35000) return 'Sin señal reciente'
  if (activity.phase === 'rest-paused') return 'Descanso pausado'
  if (activity.phase === 'rest-finished' || (activity.phase === 'rest' && activity.restEndsAt <= now)) return 'Descanso terminado · Esperando actualización'
  if (activity.phase === 'rest') return `Descansando · ${Math.max(0, Math.ceil((activity.restEndsAt - now) / 1000))} s restantes`
  return 'Sesión abierta'
}
