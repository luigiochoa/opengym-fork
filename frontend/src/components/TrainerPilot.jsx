import { StudentAssignmentHistory } from './AssignmentHistory.jsx'
import '../trainer-pilot.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { applyTrainerPlan } from '../lib/trainer-plan.js'
import { Button, Section, Row, TextArea } from './ui.jsx'

function FeedbackSheet({ assignment, saved, close }) {
  const [text, setText] = useState(assignment.feedback || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async () => {
    setBusy(true); setError('')
    try {
      await api('/api/trainer/feedback', { method: 'POST', body: JSON.stringify({ id: assignment.id, text }) })
      saved(text); close(); useUI.getState().toast('Comentario enviado al entrenador')
    } catch { setError('No se pudo enviar. Tu comentario sigue aquí para que lo intentes de nuevo.') }
    finally { setBusy(false) }
  }
  return <>
    <h3>Comentario para tu entrenador</h3>
    <p className="muted small trainer-sheet-intro">Cuéntale a {assignment.trainerName} cómo te fue o qué necesitas ajustar.</p>
    <label className="trainer-field-label" htmlFor="trainer-feedback">Tu comentario</label>
    <TextArea id="trainer-feedback" value={text} maxLength={1000} placeholder="Cómo te sentiste, dudas o ajustes…" onChange={e => setText(e.target.value)} />
    <p className="sect-f trainer-character-count">{text.length}/1000</p>
    {error && <p role="alert" className="trainer-error">{error}</p>}
    <Button variant="primary" disabled={busy} onClick={send}>{busy ? 'Enviando…' : 'Enviar comentario'}</Button>
  </>
}

export function TrainerHome({ onAssignmentStatus }) {
  const user = useStore(s => s.user)
  const enabled = useStore(s => s.config?.trainer_pilot)
  const state = useStore(s => s.S)
  const nav = useNavigate()
  const [assignment, setAssignment] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!enabled || !user || user.admin) return
    let active = true, sequence = 0, applied = 0
    const load = () => { const current = ++sequence; return api('/api/trainer/assignment').then(r => {
      if (active && current > applied) { applied = current; setAssignment(r.assignment); setError('') }
    }).catch(() => { if (active && current > applied) { applied = current; setError('No se pudo consultar tu rutina. Revisa tu conexión.') } }) }
    load()
    const refresh = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', refresh); window.addEventListener('online', refresh)
    const timer = setInterval(refresh, 30000)
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh) }
  }, [enabled, user?.id])
  useEffect(() => { onAssignmentStatus?.({ id: assignment?.id, pending: !!assignment && !assignment.accepted, trainerName: assignment?.trainerName }) }, [onAssignmentStatus, assignment?.id, assignment?.accepted, assignment?.trainerName])
  if (!enabled || !user) return null
  if (user.owner) return <Section><Row icon="personCircle" iconTint="var(--indigo)" title="Mi equipo" subtitle="Alumnos, rutinas y seguimiento" accessory="chevron" onClick={() => nav('/trainer')} /></Section>
  if (user.admin) return null
  if (!assignment) return <Section><Row icon="clipboard" title="Tu próxima rutina" subtitle={error || 'Cuando tu entrenador te asigne una rutina, podrás recibirla aquí.'} /></Section>
  const imported = state.trainerApplied?.includes(assignment.id)
  const accept = async () => {
    setBusy(true); setError('')
    try {
      const store = useStore.getState()
      await store.pullState()
      if (!useStore.getState().S.trainerApplied?.includes(assignment.id)) store.update(s => applyTrainerPlan(s, assignment))
      await useStore.getState().pushState()
      await api('/api/trainer/assignment/accept', { method: 'POST', body: JSON.stringify({ id: assignment.id }) })
      setAssignment(a => ({ ...a, accepted: Date.now() }))
      useUI.getState().toast('Plan incorporado. Lo encontrarás en Plan.')
    } catch { setError('No se pudo confirmar. El plan se conserva en este dispositivo; vuelve a intentar cuando tengas conexión.') }
    finally { setBusy(false) }
  }
  const feedback = () => useUI.getState().openSheet(close => <FeedbackSheet assignment={assignment} saved={text => setAssignment(a => ({ ...a, feedback: text }))} close={close} />)
  return <Section title="Tu entrenador" className="trainer-assignment" footer={!assignment.accepted ? 'Se actualizarán los días indicados. Tu historial y las demás rutinas se conservan.' : null}>
    <Row icon="clipboard" title={assignment.bundle.name} subtitle={`De ${assignment.trainerName}`}>
      <span className={'tag' + (assignment.accepted ? ' acc' : '')}>{assignment.accepted ? 'Recibida' : 'Nueva'}</span>
    </Row>
    {!assignment.accepted ? <div className="trainer-form-action"><Button variant="tinted" disabled={busy} onClick={accept}>{busy ? 'Guardando…' : imported ? 'Confirmar sincronización' : 'Incorporar rutina'}</Button></div> :
      <Row icon="note" iconTint="var(--orange)" title={assignment.feedback ? 'Tu comentario' : 'Comentar al entrenador'} subtitle={assignment.feedback || 'Cuéntale cómo va tu entrenamiento'} accessory="chevron" onClick={feedback} />}
    <StudentAssignmentHistory />
    {error && <p role="alert" className="trainer-error">{error}</p>}
  </Section>
}
