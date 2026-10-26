// Quote CSV cells and neutralize spreadsheet formula prefixes, including leading whitespace.
const cell = value => {
  let text = value == null ? '' : String(value)
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}
export function paymentsCsv(payments) {
  const rows = [['ID', 'Fecha de pago', 'Cubre desde', 'Próxima renovación', 'Importe', 'Moneda', 'Método', 'Estado', 'Nota privada']]
  for (const p of payments) rows.push([p.id, p.paidOn, p.validFrom, p.nextDueOn, p.amountMinor == null ? '' : (p.amountMinor / 100).toFixed(2), p.currency, p.method, p.voidedAt ? 'Anulado' : 'Registrado', p.note])
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
export function downloadPaymentsCsv(payments, userId) {
  const url = URL.createObjectURL(new Blob([paymentsCsv(payments)], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `pagos-${String(userId).replace(/[^a-zA-Z0-9_-]/g, '')}.csv`
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
