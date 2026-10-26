// Compact cache: history documents are discarded after computing scalar summaries.
export function weekStart(today) {
  const date = new Date(today + 'T12:00:00Z'); const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - (day + 6) % 7)
  return date.toISOString().slice(0, 10)
}
export function summarizePupil(state, unreadable, today) {
  const unavailable = state === unreadable
  const workouts = !unavailable && Array.isArray(state?.workouts) ? state.workouts.filter(w => w && Array.isArray(w.entries)) : []
  const dates = workouts.map(w => w.d).filter(d => typeof d === 'string')
  const start = weekStart(today)
  return { unavailable, workouts: workouts.length, lastWorkout: dates.reduce((last, date) => !last || date > last ? date : last, null), completedDays: new Set(dates.filter(date => date >= start && date <= today)).size }
}
export function createPupilSummaryReader({ stat, readState, unreadable, max = 512 }) {
  const cache = new Map()
  const read = (id, today) => {
    let key
    try { const s = stat(id); key = `${s.mtimeMs}:${s.ctimeMs}:${s.ino}:${s.size}:${weekStart(today)}:${today}` }
    catch { cache.delete(id); return summarizePupil(readState(id), unreadable, today) }
    const hit = cache.get(id); cache.delete(id)
    if (hit?.key === key) { cache.set(id, hit); return hit.value }
    const value = summarizePupil(readState(id), unreadable, today)
    cache.set(id, { key, value }); while (cache.size > max) cache.delete(cache.keys().next().value)
    return value
  }
  read.invalidate = id => cache.delete(id)
  return read
}
