import { paymentSummary, PaymentValidationError } from './trainer-payments.js';
export function defaultPaymentReminders() {
  return { enabled: false, time: '09:00', timeZone: process.env.TRAINER_TIMEZONE || 'America/Caracas' };
}
export function validatePaymentReminders(body) {
  if (!body || typeof body.enabled !== 'boolean' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time || '')) throw new PaymentValidationError('Selecciona una hora válida para los recordatorios.');
  if (typeof body.timeZone !== 'string' || body.timeZone.length > 80) throw new PaymentValidationError('Selecciona una zona horaria válida.');
  try { new Intl.DateTimeFormat('en', { timeZone: body.timeZone }).format(); }
  catch { throw new PaymentValidationError('Selecciona una zona horaria válida.'); }
  return { enabled: body.enabled, time: body.time, timeZone: body.timeZone };
}
export function paymentReminderClock(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = type => parts.find(p => p.type === type).value;
  return { today: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
export function paymentReminderDue(payments, prefs, now) {
  if (!prefs?.enabled) return null;
  const clock = paymentReminderClock(now, prefs.timeZone);
  const [hour, minute] = prefs.time.split(':').map(Number);
  const late = clock.minutes - (hour * 60 + minute);
  if (late < 0 || late > 180) return null; // catch up after a short outage, never through the night
  const summary = paymentSummary(payments, clock.today);
  const days = summary.daysUntilDue;
  const phase = days === 0 ? 'due' : days > 0 && days <= 3 ? 'before' : null;
  if (!phase || summary.status === 'scheduled') return null;
  return { key: `${summary.nextDueOn}:${phase}`, phase, nextDueOn: summary.nextDueOn };
}

// One process per pilot instance. Durable success/attempt records survive restarts, failed
// deliveries retry at most every fifteen minutes, and an overlapping tick cannot duplicate a send.
export function createPaymentReminderRunner({ db, saveDb, sendPush, enabled, isAdmin }) {
  let running = false;
  return async function run(now = new Date()) {
    if (!enabled || running) return;
    running = true;
    try {
      for (const user of db.users) {
        if (user.disabled || isAdmin(user) || !db.subs.some(s => s.userId === user.id)) continue;
        const prefs = db.trainerPaymentReminders?.[user.id];
        let due;
        try { due = paymentReminderDue((db.trainerPayments || []).filter(p => p.userId === user.id), prefs, now); }
        catch { continue; } // malformed legacy preferences must not stop everyone else's reminders
        if (!due) continue;
        const logs = db.trainerPaymentNotices?.[user.id] || {};
        const previous = logs[due.key];
        const stamp = now.getTime();
        if (previous?.sentAt || (previous?.lastAttempt && stamp - previous.lastAttempt < 15 * 60000)) continue;
        const attempt = { lastAttempt: stamp, sentAt: null };
        db.trainerPaymentNotices ||= {};
        db.trainerPaymentNotices[user.id] = Object.fromEntries(Object.entries({ ...logs, [due.key]: attempt }).sort((a, b) => b[1].lastAttempt - a[1].lastAttempt).slice(0, 32));
        try { saveDb(); }
        catch (e) { db.trainerPaymentNotices[user.id] = logs; console.error('payment reminder: could not save attempt', e.message); continue; }
        // No amounts, payment history or private trainer notes on a lock screen.
        let result;
        try { result = await sendPush(user.id, { title: due.phase === 'due' ? 'Tu renovación es hoy' : 'Tu renovación se acerca', body: 'Abre la app para revisar tu próxima fecha.', tag: 'payment-renewal', url: '#/payments' }); }
        catch (e) { console.error('payment reminder: send failed', e.message); continue; }
        if (result?.sent > 0) {
          attempt.sentAt = stamp;
          try { saveDb(); } catch (e) { console.error('payment reminder: could not save delivery', e.message); }
        }
      }
    } finally { running = false; }
  };
}
