import '../trainer-pilot.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { api } from '../lib/api.js'
import { applyTrainerPlan } from '../lib/trainer-plan.js'
import { Button } from './ui.jsx'

export function TrainerHome() {
  const user = useStore(s => s.user)
  const enabled = useStore(s => s.config?.trainer_pilot)
  const state = useStore(s => s.S)
  const nav = useNavigate()
  const [assignment, setAssignment] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!enabled || !user || user.admin) return
    let active = true
    const load = () => api('/api/trainer/assignment').then(r => {
      if (active) { setAssignment(r.assignment); setFeedback(r.assignment?.feedback || '') }
    }).catch(() => { if (active) setMessage('No se pudo consultar el plan. Revisa tu conexión.') })
    load()
    const refresh = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', refresh)
    return () => { active = false; document.removeEventListener('visibilitychange', refresh) }
  }, [enabled, user?.id])
  if (!enabled || !user) return null
  if (user.owner) return <div className="card pilot-card" style={{ padding: 16, marginBottom: 16 }}><Button variant="tinted" onClick={() => nav('/trainer')}>Mis alumnos</Button></div>
  if (user.admin || !assignment) return message ? <p role="status">{message}</p> : null
  const imported = state.trainerApplied?.includes(assignment.id)
  const accept = async () => {
    setBusy(true); setMessage('')
    try {
      const store = useStore.getState()
      await store.pullState()
      if (!useStore.getState().S.trainerApplied?.includes(assignment.id)) store.update(s => applyTrainerPlan(s, assignment))
      await useStore.getState().pushState()
      await api('/api/trainer/assignment/accept', { method: 'POST', body: JSON.stringify({ id: assignment.id }) })
      setAssignment(a => ({ ...a, accepted: Date.now() }))
      setMessage('Plan incorporado. Lo encontrarás en Plan.')
    } catch { setMessage('No se pudo confirmar. Conservamos el plan en este dispositivo; vuelve a intentar cuando tengas conexión.') }
    finally { setBusy(false) }
  }
  const sendFeedback = async () => {
    setBusy(true)
    try { await api('/api/trainer/feedback', { method: 'POST', body: JSON.stringify({ id: assignment.id, text: feedback }) }); setMessage('Comentario enviado al entrenador.') }
    catch { setMessage('No se pudo enviar el comentario. Vuelve a intentarlo.') }
    finally { setBusy(false) }
  }
  return <section className="card pilot-card" style={{ padding: 16, marginBottom: 16 }} aria-label="Plan del entrenador">
    <h2 style={{ fontSize: 20 }}>Tu entrenador: {assignment.trainerName}</h2>
    <p>{assignment.bundle.name}</p>
    {!assignment.accepted && <><p className="muted">Añade esta rutina a tu plan. Los días indicados se actualizarán; tu historial y las demás rutinas se conservan.</p><Button variant="primary" disabled={busy} onClick={accept}>{busy ? 'Guardando…' : imported ? 'Confirmar sincronización' : 'Incorporar rutina'}</Button></>}
    {assignment.accepted && <>
      <p className="muted">Plan recibido. Registra tus sesiones para que tu entrenador pueda revisarlas.</p>
      <label htmlFor="trainer-feedback">Comentario para tu entrenador</label>
      <textarea className="input" id="trainer-feedback" value={feedback} maxLength={1000} onChange={e => setFeedback(e.target.value)} style={{ width: '100%', minHeight: 70, margin: '8px 0' }} />
      <Button disabled={busy} onClick={sendFeedback}>Enviar comentario</Button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>
}
