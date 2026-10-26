import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { useUI } from '../store/useUI.js'
import { fmtDate, todayISO } from '../lib/format.js'
import { parsePaymentAmount, suggestedDueDate, paymentMoney } from '../lib/trainer-payments.js'
import { confirmSheet, menuSheet } from '../sheets.jsx'
import { Button, Section, Row, TextField, TextArea, SelectRow } from './ui.jsx'

const periods = [{ value: 'month', label: 'Un mes' }, { value: 'fortnight', label: '15 días' }, { value: 'week', label: '7 días' }, { value: 'custom', label: 'Personalizado' }]
const currencies = ['USD', 'VES', 'EUR', 'COP', 'MXN'].map(value => ({ value, label: value }))
const methods = [{ value: 'unspecified', label: 'Sin especificar' }, { value: 'transfer', label: 'Transferencia' }, { value: 'cash', label: 'Efectivo' }, { value: 'other', label: 'Otro' }]
export { default as PaymentBadge } from './PaymentBadge.jsx'
import PaymentBadge from './PaymentBadge.jsx'

function PaymentForm({ pupil, billing, saved, close }) {
  const today = billing.today || todayISO()
  const start = billing.summary?.nextDueOn > today ? billing.summary.nextDueOn : today
  const [paidOn, setPaidOn] = useState(today)
  const [validFrom, setValidFrom] = useState(start)
  const [period, setPeriod] = useState('month')
  const [nextDueOn, setNextDueOn] = useState(() => suggestedDueDate(start, 'month'))
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState(billing.payments[0]?.currency || 'USD')
  const [method, setMethod] = useState('unspecified')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [requestId] = useState(() => crypto.randomUUID())
  const changeFrom = date => { setValidFrom(date); if (period !== 'custom') setNextDueOn(suggestedDueDate(date, period)) }
  const changePeriod = value => { setPeriod(value); if (value !== 'custom') setNextDueOn(suggestedDueDate(validFrom, value)) }
  const save = async () => {
    if (busy) return
    setError('')
    let amountMinor
    try {
      amountMinor = parsePaymentAmount(amount)
      if (!paidOn || paidOn > today) throw new Error('Elige una fecha de pago válida que no esté en el futuro.')
      if (!validFrom || !nextDueOn || nextDueOn <= validFrom) throw new Error('La próxima renovación debe ser posterior al inicio del período.')
    } catch (e) { setError(e.message); return }
    setBusy(true)
    try {
      await api('/api/trainer/payments', { method: 'POST', body: JSON.stringify({ userId: pupil.id, requestId, paidOn, validFrom, nextDueOn, amountMinor, currency, method, note }) })
      saved(); close(); useUI.getState().toast(`Pago de ${pupil.name} registrado`)
    } catch (e) { setError(e.message || 'No se pudo guardar. Vuelve a intentarlo.'); setBusy(false) }
  }
  return <>
    <h3>Registrar pago</h3>
    <p className="muted small trainer-sheet-intro">Anota un pago que ya recibiste de {pupil.name}.</p>
    <Section title="Fechas y cobertura">
      <div className="trainer-payment-fields">
        <label className="measure-date"><span>Fecha de pago</span><TextField type="date" value={paidOn} max={today} onChange={e => setPaidOn(e.target.value)} /></label>
        <label className="measure-date"><span>Cubre desde</span><TextField type="date" value={validFrom} onChange={e => changeFrom(e.target.value)} /></label>
      </div>
      <SelectRow icon="clock" iconTint="var(--orange)" title="Período" value={period} options={periods} onChange={changePeriod} sheetTitle="Período cubierto" />
      <div className="trainer-payment-fields trainer-payment-single"><label className="measure-date"><span>Próxima renovación</span><TextField type="date" value={nextDueOn} min={validFrom || undefined} onChange={e => { setPeriod('custom'); setNextDueOn(e.target.value) }} /></label></div>
    </Section>
    <Section title="Detalle del pago" footer="El monto es opcional. Las fechas bastan para llevar el control.">
      <div className="trainer-payment-fields trainer-payment-single"><label className="measure-date"><span>Monto (opcional)</span><TextField inputMode="decimal" value={amount} placeholder="0,00" maxLength={12} onChange={e => setAmount(e.target.value)} /></label></div>
      <SelectRow icon="note" title="Moneda" value={currency} options={currencies} onChange={setCurrency} />
      <SelectRow icon="clipboard" title="Método" value={method} options={methods} onChange={setMethod} sheetTitle="Método de pago" />
    </Section>
    <label className="trainer-field-label" htmlFor="trainer-payment-note">Nota (opcional)</label>
    <TextArea id="trainer-payment-note" maxLength={500} value={note} placeholder="Referencia o detalle para tu control…" onChange={e => setNote(e.target.value)} />
    {error && <p role="alert" className="trainer-error trainer-payment-error">{error}</p>}
    <div className="trainer-payment-save"><Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Guardando…' : 'Guardar pago'}</Button></div>
  </>
}

export function TrainerPayments({ pupil, onChanged }) {
  const [billing, setBilling] = useState({ payments: [], summary: pupil.billing || { status: 'none' }, today: '' })
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const data = await api('/api/trainer/payments?userId=' + encodeURIComponent(pupil.id))
    setBilling(data); setReady(true); setError('')
  }, [pupil.id])
  useEffect(() => { load().catch(() => setError('No se pudieron consultar los pagos.')) }, [load])
  const refresh = () => {
    load().catch(() => setError('El cambio se guardó, pero no pudimos actualizar la vista. Vuelve a abrir la ficha.'))
    onChanged?.()
  }
  const register = () => useUI.getState().openSheet(close => <PaymentForm pupil={pupil} billing={billing} saved={refresh} close={close} />)
  const options = payment => {
    if (payment.voidedAt) return
    menuSheet({ title: 'Pago registrado', subtitle: `${fmtDate(payment.paidOn, true, true)}${paymentMoney(payment) ? ' · ' + paymentMoney(payment) : ''}`,
      items: [{ icon: 'xmark', label: 'Anular registro', danger: true, onClick: () => confirmSheet({ title: '¿Anular este registro?', message: 'Se recalculará la próxima renovación. El registro se conservará como anulado en el historial.', confirmText: 'Anular registro', danger: true, onConfirm: async () => {
        try { await api('/api/trainer/payments/void', { method: 'POST', body: JSON.stringify({ id: payment.id }) }); refresh(); useUI.getState().toast('Registro anulado') }
        catch { setError('No se pudo anular el registro. Vuelve a intentarlo.') }
      } }) }] })
  }
  const summary = billing.summary
  return <>
    <Section title="Control de pagos" footer="El alumno ve sus fechas e importes. Tus notas quedan privadas.">
      <Row icon="checkCircle" title="Estado"><PaymentBadge summary={summary} /></Row>
      <Row icon="calendar" iconTint="var(--indigo)" title="Último pago" value={summary.paidOn ? fmtDate(summary.paidOn, false, true) : 'Sin registro'} />
      <Row icon="clock" iconTint="var(--orange)" title="Próxima renovación" value={summary.nextDueOn ? fmtDate(summary.nextDueOn, false, true) : 'Por definir'} />
      {summary.status === 'scheduled' && <Row title="Cobertura desde" value={fmtDate(summary.validFrom, false, true)} />}
      {ready && <div className="trainer-form-action"><Button variant="tinted" icon="plus" onClick={register}>Registrar pago</Button></div>}
      {!ready && !error && <p className="trainer-note muted small" role="status">Consultando pagos…</p>}
      {error && <p role="alert" className="trainer-error trainer-payment-error">{error}</p>}
    </Section>
    {billing.payments.length > 0 && <Section title={`Historial de pagos · ${billing.payments.length}`} footer="Toca un registro para corregirlo mediante una anulación.">
      {billing.payments.map(payment => <div className="trainer-payment-entry" key={payment.id}>
        <Row icon={payment.voidedAt ? 'xmark' : 'checkCircle'} iconTint={payment.voidedAt ? 'var(--surface-3)' : 'var(--acc)'} title={`${paymentMoney(payment) || 'Pago registrado'} · ${fmtDate(payment.paidOn, false, true)}`}
          subtitle={`Del ${fmtDate(payment.validFrom)} al ${fmtDate(payment.nextDueOn)}`} accessory={payment.voidedAt ? 'none' : 'chevron'} onClick={payment.voidedAt ? undefined : () => options(payment)}>
          {payment.voidedAt && <span className="tag">Anulado</span>}
        </Row>
        {(payment.note || payment.method !== 'unspecified') && <p className="trainer-payment-note">{[methods.find(m => m.value === payment.method && m.value !== 'unspecified')?.label, payment.note].filter(Boolean).join(' · ')}</p>}
      </div>)}
    </Section>}
  </>
}
