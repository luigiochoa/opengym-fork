import { AssignmentHistory } from '../components/AssignmentHistory.jsx'
import { TrainerLive } from '../components/TrainerLive.jsx'
import { TrainerAssistance } from '../components/Assistance.jsx'
import '../trainer-pilot.css'
import { TrainerPayments, PaymentBadge } from '../components/TrainerPayments.jsx'
import { needsRenewal } from '../lib/trainer-payments.js'
import { useCallback, useEffect, useRef, useState } from 'react'
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

function PupilDetail({ detail, pupil: initialPupil, history: initialHistory, close, onChanged, onAssign }) {
  const [pupil, setPupil] = useState(initialPupil)
  const [history, setHistory] = useState(initialHistory)
  const refresh = async () => { const fresh = await onChanged(); const next = fresh?.find(p => p.id === pupil.id); if (next) setPupil(next) }
  const workouts = detail.workouts.filter(w => w && Array.isArray(w.entries))
  return <>
    <h3>{pupil.name}</h3>
    <Section>
      <Row icon="chart" iconTint="var(--indigo)" title="Sesiones registradas" value={String(workouts.length)} />
      <Row icon="calendar" iconTint="var(--orange)" title="Último entrenamiento" value={pupil.lastWorkout ? fmtDate(pupil.lastWorkout) : 'Sin sesiones'} />
      {pupil.assignment && <Row icon="clipboard" title={pupil.assignment.bundle.name} subtitle={pupil.assignment.accepted ? 'Rutina recibida' : 'Pendiente de incorporar'} />}
    </Section>
    <Section title="Esta semana" footer="Días con entrenamientos guardados frente a los días de la rutina asignada. Incluye las otras rutinas que registre el alumno.">
      <Row icon="calendar" title="Días entrenados" value={!(pupil.weekly?.plannedDays > 0) ? String(pupil.weekly?.completedDays || 0) : `${pupil.weekly.completedDays}/${pupil.weekly.plannedDays}`} />
    </Section>
    <div className="trainer-detail-actions"><Button variant="tinted" icon="clipboard" disabled={pupil.disabled} onClick={() => onAssign(pupil, async () => {
      await refresh()
      try { const next = await api('/api/trainer/assignment-history?userId=' + encodeURIComponent(pupil.id)); setHistory(next); setPupil(p => ({ ...p, assignment: next.assignment })) }
      catch { useUI.getState().toast('La rutina se envió. Vuelve a abrir la ficha para actualizar su historial.') }
    })}>Asignar rutina</Button></div>
    <TrainerPayments pupil={pupil} onChanged={refresh} />
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

function AssignmentSheet({ pupils, initialPupilId = '', saved, close }) {
  const routines = useStore(s => s.S.routines)
  const [routineId, setRoutineId] = useState('')
  const [pupilId, setPupilId] = useState(initialPupilId)
  const [days, setDays] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const available = pupils.filter(p => !p.disabled && !p.unavailable)
  const routineOptions = [{ value: '', label: 'Seleccionar rutina' }, ...routines.filter(r => r.ex?.length).map(r => ({ value: r.id, label: r.name }))]
  const pupilOptions = [{ value: '', label: 'Seleccionar alumno' }, ...available.map(p => ({ value: p.id, label: p.name }))]
  const assign = async () => {
    const pupil = available.find(p => p.id === pupilId)
    if (!pupil || !routineId || busy) return
    setBusy(true); setError('')
    try {
      await useStore.getState().pushState()
      await api('/api/trainer/assign', { method: 'POST', body: JSON.stringify({ userId: pupil.id, routineId, days }) })
      close(); saved(); useUI.getState().toast(`Rutina enviada a ${pupil.name}`)
    } catch { setError('No se pudo enviar. Tu selección se conserva; revisa la conexión y vuelve a intentar.') }
    finally { setBusy(false) }
  }
  return <><h3>Asignar una rutina</h3>
    <p className="muted small trainer-sheet-intro">Elige qué entrenará tu alumno y los días que le corresponden.</p>
    <Section footer={routineOptions.length > 1 ? 'El alumno la recibirá en Inicio. Su historial y las demás rutinas se conservan.' : 'Crea una rutina con ejercicios en Plan para poder enviarla.'}>
      <SelectRow icon="person" iconTint="var(--indigo)" title="Alumno" value={pupilId} options={pupilOptions} onChange={setPupilId} sheetTitle="Seleccionar alumno" />
      <SelectRow icon="dumbbell" title="Rutina" value={routineId} options={routineOptions} onChange={setRoutineId} sheetTitle="Seleccionar rutina" />
      <MultiSelectRow icon="calendar" iconTint="var(--orange)" title="Días" values={days} options={dayOptions} onToggle={d => setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d])} sheetTitle="Días de entrenamiento" noneLabel="Sin horario fijo" doneLabel="Listo" />
    </Section>
    {error && <p className="trainer-error" role="alert">{error}</p>}
    <Button variant="primary" disabled={busy || !routineId || !pupilId} onClick={assign}>{busy ? 'Enviando…' : 'Enviar rutina'}</Button>
  </>
}

export default function Trainer() {
  const nav = useNavigate()
  const [helpCount, setHelpCount] = useState(null)
  const [pupils, setPupils] = useState([])
  const [pupilFilter, setPupilFilter] = useState('all')
  const [showActivity, setShowActivity] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(null)
  const request = useRef(0)
  const mounted = useRef(false)
  const inspectRequest = useRef(0)
  const toast = message => useUI.getState().toast(message)
  const load = useCallback(async () => {
    const current = ++request.current
    const result = await api('/api/trainer/pupils').catch(error => { if (mounted.current && current === request.current) throw error; return null })
    if (!result || !mounted.current || current !== request.current) return null
    setPupils(result.pupils); setError('')
    return result.pupils
  }, [])
  useEffect(() => {
    mounted.current = true
    const refresh = () => { if (document.visibilityState === 'visible') load().catch(() => { if (mounted.current) setError('No se pudieron actualizar los alumnos. La lista puede estar desactualizada.') }) }
    load().catch(() => { if (mounted.current) setError('No se pudieron cargar los alumnos.') }).finally(() => { if (mounted.current) setLoading(false) })
    const timer = setInterval(refresh, 60000)
    document.addEventListener('visibilitychange', refresh); window.addEventListener('online', refresh)
    return () => { mounted.current = false; request.current++; inspectRequest.current++; clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('online', refresh) }
  }, [load])
  const refresh = () => load().catch(() => { setError('No se pudo actualizar la lista.'); return null })
  const assignTo = (pupil, afterAssigned) => useUI.getState().openSheet(close => <AssignmentSheet pupils={pupils} initialPupilId={pupil?.id} close={close} saved={afterAssigned || refresh} />)
  const inspect = async pupil => {
    const current = ++inspectRequest.current
    setOpening(pupil.id)
    try {
      const [detail, history] = await Promise.all([api('/api/admin/user?id=' + encodeURIComponent(pupil.id)), api('/api/trainer/assignment-history?userId=' + encodeURIComponent(pupil.id))])
      if (!mounted.current || current !== inspectRequest.current) return
      useUI.getState().openSheet(close => <PupilDetail detail={detail} pupil={{ ...pupil, assignment: history.assignment }} history={history} close={close} onChanged={refresh} onAssign={assignTo} />)
    } catch { if (mounted.current && current === inspectRequest.current) toast('No se pudo cargar la ficha. Vuelve a intentarlo.') }
    finally { if (mounted.current && current === inspectRequest.current) setOpening(null) }
  }
  const renewalCount = pupils.filter(p => !p.disabled && needsRenewal(p.billing)).length
  const pendingPlans = pupils.filter(p => !p.disabled && p.assignment && !p.assignment.accepted).length
  const visiblePupils = pupilFilter === 'renewals' ? pupils.filter(p => !p.disabled && needsRenewal(p.billing)) : pupilFilter === 'plans' ? pupils.filter(p => !p.disabled && p.assignment && !p.assignment.accepted) : pupils
  return <div className="narrow trainer-pilot trainer-team">
    <div className="hdr">
      <div><h1>Mi equipo</h1><div className="sub">{loading ? 'Cargando alumnos…' : `${pupils.filter(p => !p.disabled).length} alumnos · Rutinas y seguimiento`}</div></div>
      <button className="iconbtn" data-back="/home" aria-label="Volver a Inicio" onClick={() => nav('/home')}><Icon name="chevronLeft" /></button>
    </div>
    <div className="trainer-toolbar"><Button variant="tinted" icon="clipboard" onClick={() => assignTo()}>Asignar rutina</Button><Button icon="personCircle" onClick={() => nav('/admin')}>Accesos</Button></div>
    <div className="trainer-overview" aria-label="Pendientes del equipo">
      <button className={'trainer-metric' + (helpCount ? ' urgent' : '')} onClick={() => { setShowActivity(true); document.getElementById('trainer-help')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><Icon name="bell" /><strong>{helpCount === null ? '–' : helpCount}</strong><span>Ayudas</span></button>
      <button className={'trainer-metric' + (pupilFilter === 'plans' ? ' selected' : '')} aria-pressed={pupilFilter === 'plans'} onClick={() => setPupilFilter(pupilFilter === 'plans' ? 'all' : 'plans')}><Icon name="clipboard" /><strong>{loading ? '–' : pendingPlans}</strong><span>Por recibir</span></button>
      <button className={'trainer-metric' + (pupilFilter === 'renewals' ? ' selected' : '')} aria-pressed={pupilFilter === 'renewals'} onClick={() => setPupilFilter(pupilFilter === 'renewals' ? 'all' : 'renewals')}><Icon name="calendar" /><strong>{loading ? '–' : renewalCount}</strong><span>Por renovar</span></button>
    </div>
    {error && <div className="trainer-retry" role="alert"><p>{error}</p><Button size="sm" onClick={refresh}>Reintentar</Button></div>}
    <div id="trainer-help"><TrainerAssistance onCount={setHelpCount} hideEmpty={!showActivity} /></div>
    <TrainerLive hideEmpty={!showActivity} />
    <div id="trainer-pupils"><Section title="Tus alumnos" footer="Abre una ficha para asignar rutinas, registrar pagos o revisar su progreso.">
      {!loading && pupils.length > 0 && <div className="trainer-pupil-filters"><Segmented value={pupilFilter} onChange={setPupilFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'renewals', label: 'Por renovar' }, { value: 'plans', label: 'Por recibir' }]} /></div>}
      {loading ? <Row title="Cargando alumnos…" /> : pupilFilter !== 'all' && !visiblePupils.length ? <Row icon="checkCircle" title="Todo al día" subtitle={pupilFilter === 'plans' ? 'Todas las rutinas asignadas han sido recibidas.' : 'Sin vencimientos próximos entre los pagos registrados.'} /> : pupils.length ? visiblePupils.map(p => <Row key={p.id} icon="person" iconTint={p.disabled ? 'var(--surface-3)' : 'var(--indigo)'} title={p.name}
        subtitle={opening === p.id ? 'Abriendo ficha…' : p.unavailable ? 'Datos no disponibles' : p.disabled ? 'Acceso suspendido' : `${p.weekly?.completedDays || 0} ${(p.weekly?.completedDays || 0) === 1 ? 'día' : 'días'} esta semana · ${lastSession(p.lastWorkout)}`}
        accessory={p.unavailable ? 'none' : 'chevron'} onClick={p.unavailable ? undefined : () => inspect(p)}>
        <div className="trainer-pupil-tags">{p.assignment && !p.assignment.accepted && <span className="tag">Rutina nueva</span>}{p.billing?.status && p.billing.status !== 'none' && <PaymentBadge summary={p.billing} />}</div>
      </Row>) : <Row icon="personCircle" iconTint="var(--surface-3)" title="Tu primer alumno" subtitle="Crea una invitación para empezar a acompañar su entrenamiento." accessory="chevron" onClick={() => nav('/admin')} />}
    </Section></div>
    <Button size="sm" icon="bell" onClick={() => setShowActivity(v => !v)} aria-expanded={showActivity}>{showActivity ? 'Ocultar secciones sin actividad' : 'Ver sesiones, ayudas y avisos'}</Button>
  </div>
}
