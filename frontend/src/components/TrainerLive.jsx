import '../trainer-pilot.css'
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api, beacon } from '../lib/api.js'
import { liveSnapshot, liveDescription } from '../lib/trainer-live.js'
import { dateLocale } from '../lib/i18n-core.js'
import { useSharingPreference, confirmLivePreference, reportLiveStatus } from '../store/useLivePreferences.js'
import { Section, Row, Switch } from './ui.jsx'

// The publisher is mounted once in App; route pages only render the privacy control.
export function LiveActivityPublisher() { return <SharingController publisher /> }
export function StudentLiveSharing() { return <SharingController /> }
function SharingController({ publisher = false }) {
  const user = useStore(s => s.user)
  const pilot = useStore(s => s.config?.trainer_pilot)
  const allowed = !!(pilot && user?.id && !user.admin)
  const session = useStore(s => { const active = s.S.active; return active && !active.backfill && !active.editingWorkoutId ? active.start || 'active' : null })
  const prefs = useSharingPreference(allowed ? user.id : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const enabled = prefs.enabled === true
  useEffect(() => {
    if (!allowed || !enabled || !publisher || session === null) return
    const userId = user.id, sessionId = crypto.randomUUID()
    let sequence = 0, stopped = false, suspended = false, sending = false, pending = null, debounce, last = ''
    const drain = async () => {
      if (sending || !pending || useStore.getState().user?.id !== userId) return
      const snapshot = pending.active ? liveSnapshot(useStore.getState().S.active, useUI.getState().timer) : pending; pending = null; sending = true
      try {
        await api('/api/me/live-activity', { method: 'POST', body: JSON.stringify({ ...snapshot, restSeconds: snapshot.phase === 'rest' ? Math.max(1, Math.ceil((snapshot.restEndsAt - Date.now()) / 1000)) : null, sessionId, sequence: ++sequence }) })
        if (!stopped) reportLiveStatus(userId, '')
      } catch (e) {
        if (!stopped) {
          reportLiveStatus(userId, 'No se pudo actualizar tu actividad. Se reintentará con conexión.')
          if (e.status === 403) { confirmLivePreference(userId, false); pending = null }
        }
      } finally { sending = false; if (pending) void drain() }
    }
    const send = snapshot => { pending = snapshot; void drain() }
    const ping = (force = false) => {
      if (stopped || suspended) return
      const snapshot = liveSnapshot(useStore.getState().S.active, useUI.getState().timer)
      const key = JSON.stringify(snapshot)
      if (force || key !== last) { last = key; send(snapshot) }
    }
    const schedule = () => { clearTimeout(debounce); debounce = setTimeout(() => ping(), 250) }
    const visible = () => { if (document.visibilityState === 'visible') { suspended = false; ping(true) } }
    const lastSignal = () => {
      if (stopped || useStore.getState().user?.id !== userId) return
      const snapshot = liveSnapshot(useStore.getState().S.active, useUI.getState().timer)
      const sent = beacon('/api/me/live-activity', { ...snapshot, restSeconds: snapshot.phase === 'rest' ? Math.max(1, Math.ceil((snapshot.restEndsAt - Date.now()) / 1000)) : null, sessionId, sequence: ++sequence })
      if (!sent && !suspended) ping(true)
    }
    const visibility = () => { if (document.visibilityState === 'hidden') lastSignal(); else visible() }
    // A hidden/closed page is not evidence the workout ended. Leave a final observation;
    // its server timestamp becomes stale if the OS suspends us. Only ending the session stops it.
    const leave = () => { pending = null; lastSignal(); suspended = true }
    const offStore = useStore.subscribe(schedule), offTimer = useUI.subscribe(schedule)
    ping(true)
    const timer = setInterval(() => ping(true), 10000)
    window.addEventListener('online', visible); window.addEventListener('pagehide', leave); window.addEventListener('pageshow', visible); document.addEventListener('visibilitychange', visibility)
    return () => {
      stopped = true; clearInterval(timer); clearTimeout(debounce); offStore(); offTimer()
      window.removeEventListener('online', visible); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', visible); document.removeEventListener('visibilitychange', visibility)
      send({ active: false })
    }
  }, [allowed, enabled, publisher, session, user?.id])
  if (!allowed || publisher) return null
  const toggle = async () => {
    const id = user.id
    setBusy(true); setError('')
    try {
      const data = await api('/api/me/live-sharing', { method: 'POST', body: JSON.stringify({ enabled: !enabled }) })
      if (useStore.getState().user?.id !== id) return
      confirmLivePreference(id, data.enabled)
    } catch { setError('No se pudo guardar. Revisa tu conexión y vuelve a intentar.') }
    finally { setBusy(false) }
  }
  return <Section footer={error || prefs.error || prefs.activityError || (enabled ? 'Solo tu entrenador ve el ejercicio seleccionado, las series y el descanso mientras tu sesión siga activa, incluso al cambiar de pantalla. Al terminar o descartar dejas de compartir. Si el teléfono suspende la app, se mostrará la última señal.' : 'Comparte tu actividad con tu entrenador para que pueda acompañarte durante la sesión.')}>
    <Row icon="personCircle" iconTint="var(--indigo)" title="Compartir sesión con mi entrenador" subtitle={prefs.enabled === null ? 'Consultando preferencia…' : enabled ? session === null ? 'Activado · Se compartirá al iniciar' : 'Compartiendo sesión activa' : 'Desactivado'}><Switch aria-label="Compartir sesión con mi entrenador" checked={enabled} disabled={busy || prefs.enabled === null} onChange={toggle} /></Row>
  </Section>
}

export function TrainerLive({ hideEmpty = false }) {
  const user = useStore(s => s.user)
  const pilot = useStore(s => s.config?.trainer_pilot)
  const allowed = !!(pilot && user?.owner)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(Date.now())
  useEffect(() => {
    if (!allowed) return
    let alive = true, sequence = 0, applied = 0
    const load = async () => {
      if (document.visibilityState === 'hidden') return
      const current = ++sequence
      try {
        const data = await api('/api/trainer/live')
        if (alive && current > applied) { applied = current; setResult({ id: user.id, ...data, receivedAt: Date.now() }); setError('') }
      } catch { if (alive && current > applied) { applied = current; setError('No se pudo actualizar. La actividad mostrada puede estar desactualizada.') } }
    }
    load(); const poll = setInterval(load, 5000), tick = setInterval(() => setClock(Date.now()), 1000)
    window.addEventListener('online', load); document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(poll); clearInterval(tick); window.removeEventListener('online', load); document.removeEventListener('visibilitychange', load) }
  }, [allowed, user?.id])
  if (!allowed) return null
  const data = result?.id === user.id ? result : null
  const now = data ? data.serverTime + Math.max(0, clock - data.receivedAt) : clock
  const pupils = data?.pupils.filter(p => p.activity) || []
  if (hideEmpty && !error && (!data || !pupils.length)) return null
  return <Section title="Sesiones compartidas" footer={error || 'Actividad aproximada según lo registrado en la app. Se actualiza cada 5 segundos.'}>
    {!data ? <Row icon="clock" title="Consultando sesiones…" /> : !pupils.length ? <Row icon="dumbbell" title="Sin sesiones compartidas ahora" subtitle="Cada alumno elige si quiere compartir su actividad durante el entrenamiento." /> : pupils.map(p => {
      const a = p.activity, stale = a.stale || now - a.updatedAt >= 35000
      return <div key={p.id} className="trainer-live-entry">
        <Row icon={a.phase.startsWith('rest') ? 'clock' : 'dumbbell'} iconTint={stale ? 'var(--surface-3)' : 'var(--green)'} title={p.name} subtitle={liveDescription(a, now)}><span className={'tag trainer-live-badge' + (stale ? ' stale' : '')}>{stale ? 'Sin señal' : 'Sesión abierta'}</span></Row>
        <p className="trainer-note">{a.workout}{'\n'}{a.exercise ? `Ejercicio seleccionado: ${a.exercise}` : 'Sin ejercicio seleccionado'}{'\n'}{a.setsDone}/{a.setsTotal} series registradas · Última señal {new Date(a.updatedAt).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
      </div>
    })}
  </Section>
}
