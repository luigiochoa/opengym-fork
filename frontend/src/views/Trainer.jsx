import '../trainer-pilot.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { exOr } from '../lib/exercises.js'
import { api } from '../lib/api.js'
import { Button } from '../components/ui.jsx'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export default function Trainer() {
  const nav = useNavigate()
  const routines = useStore(s => s.S.routines)
  const [pupils, setPupils] = useState([])
  const [routineId, setRoutineId] = useState('')
  const [days, setDays] = useState([])
  const [detail, setDetail] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const load = () => api('/api/trainer/pupils').then(r => setPupils(r.pupils))
  useEffect(() => { load().catch(() => setMessage('No se pudieron cargar los alumnos.')) }, [])
  const assign = async pupil => {
    setBusy(true); setMessage('')
    try {
      await useStore.getState().pushState()
      await api('/api/trainer/assign', { method: 'POST', body: JSON.stringify({ userId: pupil.id, routineId, days }) })
      await load(); setMessage(`Rutina enviada a ${pupil.name}. La verá al abrir Inicio.`)
    } catch { setMessage('No se pudo enviar. Comprueba la conexión y que la rutina esté sincronizada.') }
    finally { setBusy(false) }
  }
  const inspect = async pupil => {
    try { setDetail(await api('/api/admin/user?id=' + encodeURIComponent(pupil.id))); setMessage('') }
    catch { setMessage('No se pudo cargar el historial.') }
  }
  return <main className="narrow trainer-pilot">
    <div className="hdr"><div><h1>Mis alumnos</h1></div><Button size="sm" onClick={() => nav('/home')}>Volver</Button></div>
    <p>Invita a tus alumnos, envía una rutina y revisa sus sesiones.</p>
    <Button variant="tinted" onClick={() => nav('/admin')}>Invitaciones y accesos</Button>
    <section className="card pilot-card" style={{ padding: 16, margin: '16px 0' }}>
      <h2 className="pilot-title" style={{ fontSize: 20 }}>Rutina para enviar</h2>
      <label htmlFor="trainer-routine">Elige una de tus rutinas</label>
      <select className="input" id="trainer-routine" value={routineId} onChange={e => setRoutineId(e.target.value)} style={{ display: 'block', width: '100%', margin: '8px 0' }}>
        <option value="">Seleccionar rutina</option>
        {routines.filter(r => r.ex?.length).map(r => <option value={r.id} key={r.id}>{r.name}</option>)}
      </select>
      <fieldset style={{ border: 0, padding: 0 }}><legend>Días de entrenamiento (opcional)</legend>
        {[1, 2, 3, 4, 5, 6, 0].map(d => <label key={d} style={{ display: 'inline-flex', gap: 4, padding: 6 }}><input type="checkbox" checked={days.includes(d)} onChange={() => setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])} />{DAYS[d]}</label>)}
      </fieldset>
      {!routines.some(r => r.ex?.length) && <p>Crea primero una rutina en Plan.</p>}
    </section>
    {message && <p role="status">{message}</p>}
    {!pupils.length && <p>No hay alumnos todavía. Crea una invitación para comenzar.</p>}
    {pupils.map(p => <section className="card pilot-card" key={p.id} style={{ padding: 16, marginBottom: 12 }}>
      <h2 className="pilot-title" style={{ fontSize: 20 }}>{p.name}{p.disabled ? ' · Suspendido' : ''}</h2>
      <p>{p.workouts} sesiones · Última: {p.lastWorkout || 'Sin entrenamientos'}</p>
      {p.unavailable && <p role="alert">Los datos de este alumno no se pueden leer. Revisa el respaldo antes de continuar.</p>}
      {p.assignment && <p>{p.assignment.bundle.name} · {p.assignment.accepted ? 'Recibida' : 'Pendiente de incorporar'}</p>}
      {p.assignment?.feedback && <blockquote>{p.assignment.feedback}</blockquote>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button size="sm" variant="tinted" disabled={busy || !routineId || p.disabled || p.unavailable} onClick={() => assign(p)}>Enviar rutina</Button>
        <Button size="sm" disabled={busy || p.unavailable} onClick={() => inspect(p)}>Ver historial</Button>
      </div>
    </section>)}
    {detail && <section className="card pilot-card" style={{ padding: 16, marginBottom: 20 }}>
      <h2>Historial de {detail.user.name}</h2><Button onClick={() => setDetail(null)}>Cerrar historial</Button>
      {detail.workouts.length ? detail.workouts.slice(0, 20).map((w, i) => <div key={w.id || i} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
        <strong>{w.d} · {w.name || 'Entrenamiento'}</strong>
        {(w.entries || []).filter(e => Array.isArray(e?.sets)).map((e, j) => <p className="small" key={j}>{e.name || e.n || exOr(e.id).n}: {e.sets.filter(s => s?.done).map(s => `${s.w ?? '–'} ${detail.unit} × ${s.r ?? '–'}`).join(' · ')}</p>)}
      </div>) : <p>Sin sesiones registradas.</p>}
    </section>}
  </main>
}
