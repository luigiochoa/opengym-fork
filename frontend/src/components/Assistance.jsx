import '../trainer-pilot.css'
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { pushSupported, enablePush } from '../lib/push.js'
import { Section, Row, Button, SelectRow, TextArea } from './ui.jsx'

const labels = { pending: 'Solicitud enviada · Esperando al entrenador', attending: 'Tu entrenador ya vio tu solicitud y va a ayudarte', resolved: 'Tu entrenador marcó la solicitud como atendida' }
function useAssistance(owner) {
  const user = useStore(s => s.user)
  const enabled = useStore(s => s.config?.trainer_pilot)
  const allowed = !!(enabled && user?.id && (owner ? user.owner : !user.admin))
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!allowed) return
    let alive = true
    const load = () => {
      if (document.visibilityState === 'hidden') return
      api(owner ? '/api/trainer/assistance' : '/api/me/assistance').then(data => {
        if (alive) { setResult({ userId: user.id, data }); setError('') }
      }).catch(() => { if (alive) setError('No pudimos actualizar las solicitudes. Revisa tu conexión.') })
    }
    load(); const timer = setInterval(load, 10000)
    window.addEventListener('assistance-change', load)
    document.addEventListener('visibilitychange', load)
    return () => { alive = false; clearInterval(timer); window.removeEventListener('assistance-change', load); document.removeEventListener('visibilitychange', load) }
  }, [allowed, user?.id, owner])
  return { allowed, data: result?.userId === user?.id ? result?.data : null, error }
}
const changed = () => window.dispatchEvent(new Event('assistance-change'))
function RequestSheet({ close }) {
  const [kind, setKind] = useState('assistance')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    setBusy(true); setError('')
    try {
      await api('/api/me/assistance', { method: 'POST', body: JSON.stringify({ kind, note }) })
      changed(); close(); useUI.getState().toast('Solicitud enviada a tu entrenador')
    } catch (e) { setError(e.message || 'No se pudo enviar. Inténtalo nuevamente.') }
    finally { setBusy(false) }
  }
  return <><h3>Pedir ayuda</h3>
    <p className="muted small trainer-sheet-intro">Tu entrenador recibirá tu solicitud. Solo ustedes dos podrán verla.</p>
    <Section><SelectRow icon="bell" title="Necesito" sheetTitle="Motivo de la solicitud" value={kind} onChange={setKind} options={[{ value: 'assistance', label: 'Asistencia con un ejercicio' }, { value: 'question', label: 'Resolver una duda' }]} /></Section>
    <label className="trainer-field-label" htmlFor="assistance-note">Detalle opcional</label>
    <TextArea id="assistance-note" value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="Por ejemplo: ¿puedes revisar mi técnica en sentadilla?" />
    {error && <p role="alert" className="trainer-error">{error}</p>}
    <div className="trainer-form-action"><Button variant="primary" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Avisar a mi entrenador'}</Button></div>
  </>
}
export function StudentAssistance() {
  const { allowed, data, error } = useAssistance(false)
  if (!allowed) return null
  const pending = data?.request && data.request.status !== 'resolved'
  return <Section footer={error || undefined}><Row icon="bell" iconTint="var(--orange)" title={pending ? 'Ayuda solicitada' : 'Pedir ayuda a mi entrenador'} subtitle={data?.request ? labels[data.request.status] : 'Asistencia con un ejercicio o una duda'} accessory={pending ? undefined : 'chevron'} onClick={pending ? undefined : () => useUI.getState().openSheet(close => <RequestSheet close={close} />)} /></Section>
}
export function TrainerAssistance() {
  const { allowed, data, error } = useAssistance(true)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [pushMessage, setPushMessage] = useState('')
  if (!allowed) return null
  const update = async (id, status) => {
    setBusy(true); setActionError('')
    try { await api('/api/trainer/assistance/status', { method: 'POST', body: JSON.stringify({ id, status }) }); changed() }
    catch { setActionError('No se pudo actualizar la solicitud. Inténtalo de nuevo.') }
    finally { setBusy(false) }
  }
  const activate = async () => {
    setBusy(true)
    try { await enablePush(); setPushMessage('Notificaciones activadas en este dispositivo.') }
    catch { setPushMessage('No se pudieron activar. Revisa el permiso de notificaciones del navegador.') }
    finally { setBusy(false) }
  }
  return <Section title="Solicitudes de ayuda" footer={error || actionError || pushMessage || 'Se actualizan cada 10 segundos mientras esta pantalla está abierta.'}>
    {!data ? <Row icon="clock" title="Consultando solicitudes…" /> : !data.requests.length ? <Row icon="checkCircle" iconTint="var(--green)" title="Sin solicitudes pendientes" subtitle="Tus alumnos pueden pedir ayuda desde Inicio o durante su sesión." /> : data.requests.map(r => <div key={r.id}>
      <Row icon="bell" iconTint="var(--orange)" title={`${r.name} ${r.kind === 'question' ? 'tiene una duda' : 'necesita asistencia'}`} subtitle={`${new Date(r.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${r.status === 'attending' ? 'En atención' : 'Pendiente'}`} />
      {r.note && <p className="trainer-note">{r.note}</p>}
      <div className="trainer-form-action">{r.status === 'pending' && <Button size="sm" variant="tinted" disabled={busy} onClick={() => update(r.id, 'attending')}>Voy a ayudarte</Button>} <Button size="sm" variant="plain" disabled={busy} onClick={() => update(r.id, 'resolved')}>Marcar atendida</Button></div>
    </div>)}
    {pushSupported() ? <Row icon="bell" title="Recibir avisos en este dispositivo" subtitle="Activa las notificaciones para enterarte con la app cerrada." onClick={busy ? undefined : activate} accessory="chevron" /> : <Row icon="bell" title="Avisos dentro de la app" subtitle="Los push requieren la versión publicada con HTTPS y un dispositivo compatible." />}
  </Section>
}
