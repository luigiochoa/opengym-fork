// Manual bookkeeping only. No charge, processor, access restriction or balance is created.
export class PaymentValidationError extends Error {}
const invalid = message => { throw new PaymentValidationError(message); };
export function validPaymentDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function trainerToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: process.env.TRAINER_TIMEZONE || 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validateManualPayment(body, today) {
  if (!body || typeof body !== 'object') invalid('Revisa los datos del pago.');
  if (typeof body.requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.requestId)) invalid('Vuelve a abrir el formulario para registrar el pago.');
  if (!validPaymentDate(body.paidOn)) invalid('Indica una fecha de pago válida.');
  if (body.paidOn > today) invalid('La fecha del pago no puede estar en el futuro.');
  if (!validPaymentDate(body.validFrom)) invalid('Indica desde qué fecha cubre el pago.');
  if (!validPaymentDate(body.nextDueOn) || body.nextDueOn <= body.validFrom) invalid('La próxima renovación debe ser posterior al inicio del período.');
  const amountMinor = body.amountMinor == null ? null : body.amountMinor;
  if (amountMinor !== null && (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || amountMinor > 9999999999)) invalid('El monto debe ser positivo y tener hasta dos decimales.');
  if (typeof body.currency !== 'string' || !/^[A-Z]{3}$/.test(body.currency)) invalid('Selecciona una moneda válida.');
  const method = body.method || 'unspecified';
  if (!['unspecified', 'cash', 'transfer', 'other'].includes(method)) invalid('Selecciona un método de pago válido.');
  const note = body.note ?? '';
  if (typeof note !== 'string' || note.length > 500) invalid('La nota puede tener hasta 500 caracteres.');
  return { userId: body.userId, paidOn: body.paidOn, validFrom: body.validFrom, nextDueOn: body.nextDueOn, amountMinor, currency: body.currency, method, note: note.trim() };
}
export function paymentSummary(payments, today = trainerToday()) {
  const active = payments.filter(p => !p.voidedAt);
  if (!active.length) return { status: 'none', paidOn: null, nextDueOn: null, validFrom: null, daysUntilDue: null };
  // Merge adjacent/overlapping paid coverage. Paying next month in advance must extend the
  // renewal, while a future payment after a gap must not hide an expired period today.
  const intervals = [];
  for (const p of [...active].sort((a, b) => a.validFrom.localeCompare(b.validFrom))) {
    const last = intervals.at(-1);
    if (last && p.validFrom <= last.end) { if (p.nextDueOn > last.end) last.end = p.nextDueOn; }
    else intervals.push({ start: p.validFrom, end: p.nextDueOn });
  }
  const current = intervals.find(p => p.start <= today && p.end >= today);
  const previous = intervals.filter(p => p.end < today).at(-1);
  const coverage = current || previous || intervals[0];
  const days = Math.round((Date.parse(coverage.end + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000);
  const status = coverage.start > today ? 'scheduled' : days < 0 ? 'overdue' : days === 0 ? 'due' : days <= 7 ? 'upcoming' : 'current';
  const latest = [...active].sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.created - a.created)[0];
  return { status, paidOn: latest.paidOn, nextDueOn: coverage.end, validFrom: coverage.start, daysUntilDue: days };
}
