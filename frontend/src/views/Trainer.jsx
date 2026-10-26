import { AssignmentHistory } from '../components/AssignmentHistory.jsx'
import { TrainerLive } from '../components/TrainerLive.jsx'
import { TrainerAssistance } from '../components/Assistance.jsx'
import '../trainer-pilot.css'
import { TrainerPayments, PaymentBadge } from '../components/TrainerPayments.jsx'
import { needsRenewal } from '../lib/trainer-payments.js'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exOr } from '../lib/exercises.js'
import { exerciseNameFor } from '../lib/i18n-core.js'
import { fmtDate } from '../lib/format.js'
import { api } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import { Button, Section, Row, SelectRow, MultiSelectRow, Segmented } from '../components/ui.jsx'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const dayOptions = [1, 2, 3, 4, 5, 6, 0].map(value => ({ value, label: DAYS[value] }))
const lastSession = date => date ? `Última sesión · ${fmtDate(date)}` : 'Aún no ha registrado sesiones'

function PupilDetail({ detail, pupil, history, close, onChanged }) {
  const workouts = detail.workouts.filter(w => w && Array.isArray(w.entries))
  return <>
    <h3>{pupil.name}</h3>
    <Section>
      <Row icon="chart" iconTint="var(--indigo)" title="Sesiones registradas" value={String(workouts.length)} />
      <Row icon="calendar" iconTint="var(--orange)" title="Último entrenamiento" value={pupil.lastWorkout ? fmtDate(pupil.lastWorkout) : 'Sin sesiones'} />
      {pupil.assignment && <Row icon="clipboard" title={pupil.assignment.bundle.name} subtitle={pupil.assignment.accepted ? 'Rutina recibida' : 'Pendiente de incorporar'} />}
    </Section>
    <Section title="Esta semana" footer="Días con entrenamientos guardados frente a los días de la rutina asignada. Incluye las otras rutinas que registre el alumno.">
      <Row icon="calendar" title="Días entrenados" value={pupil.weekly?.plannedDays == null ? String(pupil.weekly?.completedDays || 0) : `${pupil.weekly.completedDays}/${pupil.weekly.plannedDays}`} />
    </Section>
    <TrainerPayments pupil={pupil} onChanged={onChanged} />
    <AssignmentHistory data={history} />
    <Section title="Historial de entrenamientos">
      {workouts.length ? workouts.slice(0, 20).map((w, i) => <div className="trainer-session" key={w.id || i}>
        <div className="trainer-session-head"><span className="trainer-session-name">{w.name || 'Entrenamiento'}</span><span className="small muted">{w.d ? fmtDate(w.d) : 'Sin fecha'}</span></div>
        {w.entries.filter(e => Array.isArray(e?.sets)).map((e, j) => <div className="trainer-lift" key={j}>
          <span>{e.name || e.n || exerciseNameFor(exOr(e.id))}</span>
          <span className="small muted">{e.sets.filter(s => s?.done).map(s => `${s.w ?? '–'} ${detail.unit} × ${s.r ?? '–'}`).join(' · ') || 'Sin series completadas'}</span>
        </div>)}
      </div>) : <Row icon="dumbbell" iconTint="var(--surface-3)" title="Todavía no hay entrenamientos" subtitle="Las sesiones aparecerán aquí cuando tu alumno las guarde." />}
    </Section>
    <Button onClick={close}>Cerrar</Button>
  </>
}

export default function Trainer() {
  const nav = useNavigate()
  const routines = useStore(s => s.S.routines)
  const [helpCount, setHelpCount] = useState(null)
  const [pupils, setPupils] = useState([])
  const [pupilFilter, setPupilFilter] = useState('all')
  const [routineId, setRoutineId] = useState('')
  const [pupilId, setPupilId] = useState('')
  const [days, setDays] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const toast = message => useUI.getState().toast(message)
  const load = () => api('/api/trainer/pupils').then(r => { setPupils(r.pupils); setError('') })
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') load().catch(() => setError('No se pudieron actualizar los alumnos.')) }
    load().catch(() => setError('No se pudieron cargar los alumnos.')).finally(() => setLoading(false))
    const timer = setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const assign = async () => {
    const pupil = pupils.find(p => p.id === pupilId)
    if (!pupil) return
    setBusy(true); setError('')
    try {
      await useStore.getState().pushState()
      await api('/api/trainer/assign', { method: 'POST', body: JSON.stringify({ userId: pupil.id, routineId, days }) })
      await load(); toast(`Rutina enviada a ${pupil.name}`)
    } catch { setError('No se pudo enviar. Comprueba tu conexión y vuelve a intentarlo.') }
    finally { setBusy(false) }
  }
  const inspect = async pupil => {
    try {
      const [detail, history] = await Promise.all([api('/api/admin/user?id=' + encodeURIComponent(pupil.id)), api('/api/trainer/assignment-history?userId=' + encodeURIComponent(pupil.id))])
      useUI.getState().openSheet(close => <PupilDetail detail={detail} pupil={{ ...pupil, assignment: history.assignment }} history={history} close={close} onChanged={() => load().catch(() => setError('No se pudo actualizar la lista.'))} />)
    } catch { toast('No se pudo cargar el historial. Vuelve a intentarlo.') }
  }
  const showFilter = filter => { setPupilFilter(filter); document.getElementById('trainer-pupils')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const renewalCount = pupils.filter(p => needsRenewal(p.billing)).length
  const overdueCount = pupils.filter(p => p.billing?.status === 'overdue').length
  const pendingPlans = pupils.filter(p => !p.disabled && p.assignment && !p.assignment.accepted).length
  const visiblePupils = pupilFilter === 'renewals' ? pupils.filter(p => needsRenewal(p.billing)) : pupilFilter === 'plans' ? pupils.filter(p => !p.disabled && p.assignment && !p.assignment.accepted) : pupils
  const available = pupils.filter(p => !p.disabled && !p.unavailable)
  const routineOptions = [{ value: '', label: 'Seleccionar rutina' }, ...routines.filter(r => r.ex?.length).map(r => ({ value: r.id, label: r.name }))]
  const pupilOptions = [{ value: '', label: 'Seleccionar alumno' }, ...available.map(p => ({ value: p.id, label: p.name }))]
  return <div className="narrow trainer-pilot">
    <div className="hdr">
      <div><h1>Mis alumnos</h1><div className="sub">Rutinas y seguimiento</div></div>
      <button className="iconbtn" data-back="/home" aria-label="Volver a Inicio" onClick={() => nav('/home')}><Icon name="chevronLeft" /></button>
    </div>
    <Section>
      <Row icon="personCircle" iconTint="var(--indigo)" title="Invitaciones y accesos" subtitle="Añade alumnos a tu equipo" accessory="chevron" onClick={() => nav('/admin')} />
    </Section>
    <Section title="Pendientes de tu equipo">
      <Row icon="bell" iconTint="var(--orange)" title="Ayudas por atender" value={helpCount === null ? 'Consultando…' : String(helpCount)} onClick={() => document.getElementById('trainer-help')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} accessory="chevron" />
      <Row icon="clipboard" iconTint="var(--indigo)" title="Rutinas por recibir" value={String(pendingPlans)} onClick={() => showFilter('plans')} accessory="chevron" />
      <Row icon="clock" iconTint="var(--orange)" title="Control de pagos" subtitle={renewalCount ? `${overdueCount} ${overdueCount === 1 ? 'vencido' : 'vencidos'} · ${renewalCount - overdueCount} por renovar en 7 días` : 'Sin renovaciones pendientes en los próximos 7 días'} accessory="chevron" onClick={() => showFilter(renewalCount ? 'renewals' : 'all')} />
    </Section>
    <TrainerLive />
    <div id="trainer-help"><TrainerAssistance onCount={setHelpCount} /></div>
    <Section title="Asignar una rutina" footer={routineOptions.length > 1 ? 'El alumno la recibirá en Inicio. Su historial y las demás rutinas se conservan.' : 'Crea una rutina con ejercicios en Plan para poder enviarla.'}>
      <SelectRow icon="dumbbell" title="Rutina" value={routineId} options={routineOptions} onChange={setRoutineId} sheetTitle="Seleccionar rutina" />
      <SelectRow icon="person" iconTint="var(--indigo)" title="Alumno" value={pupilId} options={pupilOptions} onChange={setPupilId} sheetTitle="Seleccionar alumno" />
      <MultiSelectRow icon="calendar" iconTint="var(--orange)" title="Días" values={days} options={dayOptions} onToggle={d => setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])} sheetTitle="Días de entrenamiento" noneLabel="Sin horario fijo" doneLabel="Listo" />
      <div className="trainer-form-action"><Button variant="tinted" icon="checkCircle" disabled={busy || !routineId || !pupilId} onClick={assign}>{busy ? 'Enviando…' : 'Enviar rutina'}</Button></div>
    </Section>
    {error && <p className="trainer-error" role="alert">{error}</p>}
    <div id="trainer-pupils"><Section title={loading ? 'Alumnos' : `Alumnos · ${pupils.length}`} footer={pupils.length ? 'Toca un alumno para ver sus pagos, sesiones y comentarios.' : null}>
      {!loading && pupils.length > 0 && <div className="trainer-pupil-filters"><Segmented value={pupilFilter} onChange={setPupilFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'renewals', label: `Por renovar · ${renewalCount}` }, { value: 'plans', label: `Por recibir · ${pendingPlans}` }]} /></div>}
      {loading ? <Row title="Cargando alumnos…" /> : pupilFilter !== 'all' && !visiblePupils.length ? <Row icon="checkCircle" title="Todo al día" subtitle={pupilFilter === 'plans' ? 'Todas las rutinas asignadas han sido recibidas.' : 'No hay vencimientos próximos entre los pagos registrados.'} /> : pupils.length ? visiblePupils.map(p => <Row key={p.id} icon="person" iconTint={p.disabled ? 'var(--surface-3)' : 'var(--indigo)'} title={p.name}
        subtitle={p.unavailable ? 'Datos no disponibles' : p.disabled ? 'Acceso suspendido' : `${p.weekly?.completedDays || 0} ${(p.weekly?.completedDays || 0) === 1 ? 'día' : 'días'} esta semana · ${lastSession(p.lastWorkout)}`}
        accessory={p.unavailable ? 'none' : 'chevron'} onClick={p.unavailable ? undefined : () => inspect(p)}>
        {p.billing?.status && p.billing.status !== 'none' ? <PaymentBadge summary={p.billing} /> : p.assignment && <span className={'tag' + (p.assignment.accepted ? ' acc' : '')}>{p.assignment.accepted ? 'Recibida' : 'Pendiente'}</span>}
      </Row>) : <Row icon="personCircle" iconTint="var(--surface-3)" title="Tu primer alumno" subtitle="Crea una invitación para empezar a acompañar su entrenamiento." accessory="chevron" onClick={() => nav('/admin')} />}
    </Section></div>
  </div>
}
