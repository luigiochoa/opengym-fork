export const PAYMENT_LABELS = { none: 'Sin registro', current: 'Al día', upcoming: 'Por vencer', due: 'Vence hoy', overdue: 'Vencido', scheduled: 'Programado' }
export const needsRenewal = summary => ['overdue', 'due', 'upcoming'].includes(summary?.status)
export function parsePaymentAmount(text) {
  const value = String(text).trim()
  if (!value) return null
  if (!/^\d{1,8}([.,]\d{1,2})?$/.test(value)) throw new Error('Escribe un monto positivo con hasta dos decimales.')
  const [whole, decimals = ''] = value.replace(',', '.').split('.')
  const minor = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  if (minor <= 0 || minor > 9999999999) throw new Error('El monto debe ser mayor que cero.')
  return minor
}
export function suggestedDueDate(from, period) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return ''
  const date = new Date(from + 'T12:00:00Z')
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== from) return ''
  if (period === 'month') {
    const day = date.getUTCDate()
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + 1)
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
    date.setUTCDate(Math.min(day, last))
  } else if (period === 'week' || period === 'fortnight') date.setUTCDate(date.getUTCDate() + (period === 'week' ? 7 : 15))
  else return ''
  return date.toISOString().slice(0, 10)
}
export function paymentMoney(payment) {
  if (payment.amountMinor == null) return ''
  return new Intl.NumberFormat('es', { style: 'currency', currency: payment.currency }).format(payment.amountMinor / 100)
}
