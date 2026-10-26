import { useState } from 'react'
import { api } from '../lib/api.js'
import { useUI } from '../store/useUI.js'
import { dateLocale } from '../lib/i18n-core.js'
import { Section, Row, Button } from './ui.jsx'
const stamp = value => value ? new Date(value).toLocaleString(dateLocale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha'
export function AssignmentHistory({ data }) {
  const versions = [data.assignment, ...(data.history || [])].filter(Boolean)
  return <Section title="Rutinas y comentarios" footer="Se conservan hasta 50 versiones anteriores y 50 comentarios por versión.">
    {!versions.length ? <Row icon="clipboard" title="Sin rutinas asignadas" /> : versions.map((assignment, index) => <div className="trainer-session" key={assignment.id}>
      <div className="trainer-session-head"><span className="trainer-session-name">{assignment.bundle.name}</span><span className="tag">{index === 0 && data.assignment ? 'Actual' : 'Anterior'}</span></div>
      <p className="muted small">{stamp(assignment.created)} · {assignment.accepted ? 'Recibida' : 'Sin confirmar recepción'}</p>
      {(assignment.feedbackHistory || (assignment.feedback ? [{ text: assignment.feedback, at: assignment.feedbackAt }] : [])).slice().reverse().map((comment, i) => <div className="trainer-history-comment" key={i}><span className="muted small">{stamp(comment.at)}</span><p>{comment.text || 'Comentario borrado por el alumno'}</p></div>)}
    </div>)}
  </Section>
}
export function StudentAssignmentHistory() {
  const [busy, setBusy] = useState(false)
  const open = async () => {
    setBusy(true)
    try {
      const data = await api('/api/me/assignment-history')
      useUI.getState().openSheet(close => <><h3>Tu historial con el entrenador</h3><AssignmentHistory data={data} /><Button onClick={close}>Cerrar</Button></>)
    } catch { useUI.getState().toast('No se pudo consultar tu historial. Revisa tu conexión.') }
    finally { setBusy(false) }
  }
  return <Row icon="clock" iconTint="var(--indigo)" title="Historial de rutinas y comentarios" subtitle={busy ? 'Consultando…' : 'Revisa tus versiones anteriores'} onClick={busy ? undefined : open} accessory="chevron" />
}
