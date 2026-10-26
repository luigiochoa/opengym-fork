import '../trainer-pilot.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { api } from '../lib/api.js'
import { fmtDate } from '../lib/format.js'
import { paymentMoney } from '../lib/trainer-payments.js'
import { pushSupported, enablePush, syncPushSubscription } from '../lib/push.js'
import { Section, Row, Switch, SelectRow, Button } from './ui.jsx'
import Icon from './Icon.jsx'
import PaymentBadge from './PaymentBadge.jsx'

function useMyPayments() {
  const user = useStore(s => s.user)
  const enabled = useStore(s => s.config?.trainer_pilot)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const canRead = !!(user?.id && !user.admin && enabled)
  const load = useCallback(async () => {
    if (!canRead) return
    const sequence = ++generation.current
    const data = await api('/api/me/payments')
    if (sequence === generation.current) { setResult({ userId: user.id, data }); setError('') }
    return data
  }, [canRead, user?.id])
  useEffect(() => {
    if (!canRead) return
    let gone = false
    const refresh = () => { if (!gone && document.visibilityState === 'visible') load().catch(() => { if (!gone) setError('No pudimos consultar tus pagos. Vuelve a intentarlo cuando tengas conexión.') }) }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    const timer = setInterval(refresh, 60000)
    return () => { gone = true; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [load, canRead])
  return { data: result && result.userId === user?.id ? result.data : null, error, load, canRead }
}

export function StudentPaymentCard({ onSummary }) {
  const nav = useNavigate()
  const { data, canRead } = useMyPayments()
  useEffect(() => { if (data) onSummary?.(data.summary) }, [data, onSummary])
  if (!canRead) return null
  const sub = !data ? 'Pagos y próximas renovaciones' : data.summary.nextDueOn ? `Próxima renovación · ${fmtDate(data.summary.nextDueOn)}` : 'Tus pagos y recordatorios'
  return <Section className="trainer-assignment"><Row icon="calendar" iconTint="var(--indigo)" title="Mis pagos" subtitle={sub} accessory="chevron" onClick={() => nav('/payments')}>
    {data && data.summary.status !== 'none' && <PaymentBadge summary={data.summary} />}
  </Row></Section>
}

function RenewalReminders({ data, reload }) {
  const [prefs, setPrefs] = useState(data.reminders)
  const [busy, setBusy] = useState(false)
  const [deviceOn, setDeviceOn] = useState(false)
  const [error, setError] = useState('')
  const supported = typeof window !== 'undefined' && pushSupported()
  useEffect(() => { setPrefs(data.reminders) }, [data.reminders])
  useEffect(() => {
    let gone = false
    if (supported) syncPushSubscription().then(on => { if (!gone) setDeviceOn(on) }).catch(() => {})
    return () => { gone = true }
  }, [supported])
  const save = async (next, activate = false) => {
    if (busy) return
    setBusy(true); setError('')
    try {
      let readyHere = deviceOn
      if (activate && supported && !deviceOn) { await enablePush(); setDeviceOn(true); readyHere = true }
      const response = await api('/api/me/payment-reminders', { method: 'POST', body: JSON.stringify(next) })
      setPrefs(response.reminders)
      reload().catch(() => {})
      useUI.getState().toast(next.enabled ? readyHere ? 'Recordatorios de renovación activados' : 'Preferencia guardada' : 'Recordatorios de renovación desactivados')
    } catch (e) { setError(e.message || 'No se pudo guardar la preferencia. Revisa el permiso de notificaciones e inténtalo de nuevo.') }
    finally { setBusy(false) }
  }
  const activateDevice = async () => {
    setBusy(true); setError('')
    try { await enablePush(); setDeviceOn(true); useUI.getState().toast('Notificaciones activadas en este dispositivo') }
    catch { setError('No se pudo activar este dispositivo. Revisa el permiso de notificaciones del navegador.') }
    finally { setBusy(false) }
  }
  const times = ['08:00', '09:00', '12:00', '18:00', '20:00'].map(value => ({ value, label: value }))
  if (!times.some(t => t.value === prefs.time)) times.push({ value: prefs.time, label: prefs.time })
  return <Section title="Recordatorios" footer={`Un aviso durante los tres días previos y otro el día de la renovación. Hora de ${prefs.timeZone}.`}>
    <Row icon="bell" iconTint="var(--orange)" title="Avisos de renovación" subtitle="Tú eliges si quieres recibirlos">
      <Switch checked={prefs.enabled} disabled={busy} onChange={enabled => save({ ...prefs, enabled }, enabled)} aria-label="Avisos de renovación" />
    </Row>
    {prefs.enabled && <SelectRow icon="clock" iconTint="var(--orange)" title="Hora del aviso" value={prefs.time} options={times} onChange={time => save({ ...prefs, time })} />}
    {!supported && <p className="trainer-note muted small" role="status">Los push no están disponibles en este entorno. Puedes guardar la preferencia y activar los avisos desde la versión publicada, en un dispositivo compatible.</p>}
    {supported && prefs.enabled && !deviceOn && <div className="trainer-form-action"><Button variant="tinted" disabled={busy} onClick={activateDevice}>Activar en este dispositivo</Button></div>}
    {supported && prefs.enabled && deviceOn && <Row icon="checkCircle" iconTint="var(--green)" title="Este dispositivo puede recibir avisos" />}
    {error && <p role="alert" className="trainer-error trainer-payment-error">{error}</p>}
  </Section>
}

export default function StudentPayments() {
  const nav = useNavigate()
  const { data, error, load } = useMyPayments()
  return <div className="narrow trainer-pilot">
    <div className="hdr"><div><h1>Mis pagos</h1><div className="sub">Tu registro con el entrenador</div></div><button className="iconbtn" data-back="/home" aria-label="Volver a Inicio" onClick={() => nav('/home')}><Icon name="chevronLeft" /></button></div>
    {error && <Section><p role="alert" className="trainer-note">{error}</p><div className="trainer-form-action"><Button variant="tinted" onClick={() => load().catch(() => {})}>Volver a intentar</Button></div></Section>}
    {!data && !error && <Section><Row title="Consultando tus pagos…" /></Section>}
    {data && <>
      <Section title="Tu próxima renovación" footer={data.summary.status === 'none' ? 'Tu entrenador todavía no ha registrado pagos. Puedes consultarle la fecha de tu próxima renovación.' : 'Este registro lo actualiza tu entrenador cuando recibe tu pago.'}>
        <Row icon="checkCircle" title="Estado"><PaymentBadge summary={data.summary} /></Row>
        <Row icon="calendar" iconTint="var(--indigo)" title="Último pago" value={data.summary.paidOn ? fmtDate(data.summary.paidOn, false, true) : 'Sin registro'} />
        <Row icon="clock" iconTint="var(--orange)" title="Próxima renovación" value={data.summary.nextDueOn ? fmtDate(data.summary.nextDueOn, false, true) : 'Por definir'} />
        {data.summary.status === 'scheduled' && <Row title="Cobertura desde" value={fmtDate(data.summary.validFrom, false, true)} />}
      </Section>
      <RenewalReminders data={data} reload={load} />
      <Section title="Historial de tus pagos">
        {data.payments.length ? data.payments.map(p => <Row key={p.id} icon={p.voided ? 'xmark' : 'checkCircle'} iconTint={p.voided ? 'var(--surface-3)' : 'var(--green)'} title={`${paymentMoney(p) || 'Pago registrado'} · ${fmtDate(p.paidOn, false, true)}`} subtitle={`Del ${fmtDate(p.validFrom)} al ${fmtDate(p.nextDueOn)}`}>
          {p.voided && <span className="tag">Anulado</span>}
        </Row>) : <Row icon="note" iconTint="var(--surface-3)" title="Aún no hay pagos registrados" subtitle="Aquí aparecerán los pagos que anote tu entrenador." />}
      </Section>
    </>}
  </div>
}
