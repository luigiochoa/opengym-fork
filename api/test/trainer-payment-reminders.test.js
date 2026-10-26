import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentReminderRunner, paymentReminderDue, validatePaymentReminders } from '../trainer-payment-reminders.js';
const uid = 'pupil';
const prefs = { enabled: true, time: '09:00', timeZone: 'America/Caracas' };
const payment = { userId: uid, paidOn: '2026-10-01', validFrom: '2026-10-01', nextDueOn: '2026-10-29', created: 1 };
const morning = day => new Date(`2026-10-${day}T13:00:00Z`);
const fixture = () => ({ users: [{ id: uid }], subs: [{ userId: uid }], trainerPayments: [{ ...payment }], trainerPaymentReminders: { [uid]: { ...prefs } } });

test('renewal reminders are opt-in and run in a bounded local-time window', () => {
  assert.equal(paymentReminderDue([payment], { ...prefs, enabled: false }, morning(26)), null);
  assert.equal(paymentReminderDue([payment], prefs, new Date('2026-10-26T04:00:00Z')), null);
  assert.equal(paymentReminderDue([payment], prefs, new Date('2026-10-26T17:00:00Z')), null);
  assert.equal(paymentReminderDue([payment], prefs, morning(26)).phase, 'before');
  assert.equal(paymentReminderDue([payment], prefs, morning(29)).phase, 'due');
  assert.equal(paymentReminderDue([payment], prefs, morning(30)), null);
  assert.equal(paymentReminderDue([{ ...payment, voidedAt: 2 }], prefs, morning(26)), null);
  assert.equal(paymentReminderDue([], prefs, morning(26)), null);
});
test('only one advance and one due-day notice, retained across runner restarts; payload contains no financial details', async () => {
  const db = fixture(); const sent = []; let saves = 0;
  const dependencies = { db, saveDb: () => { saves++; }, enabled: true, isAdmin: u => !!u.admin, sendPush: async (id, payload) => { sent.push({ id, payload }); return { sent: 1 }; } };
  const run = createPaymentReminderRunner(dependencies);
  await run(morning(26)); await run(morning(27));
  await createPaymentReminderRunner(dependencies)(morning(28));
  assert.equal(sent.length, 1);
  await run(morning(29)); await run(morning(29));
  assert.equal(sent.length, 2); assert.ok(saves >= 4);
  assert.equal(sent[0].id, uid); assert.equal(sent[0].payload.url, '#/payments');
  assert.equal(JSON.stringify(sent).includes('USD'), false);
  assert.equal(JSON.stringify(sent).includes('amount'), false);
  assert.equal(JSON.stringify(sent).includes('note'), false);
});
test('failed sends retry with backoff, and overlapping ticks cannot send twice', async () => {
  const db = fixture(); let calls = 0;
  const run = createPaymentReminderRunner({ db, saveDb() {}, enabled: true, isAdmin: () => false, sendPush: async () => ({ sent: ++calls > 1 ? 1 : 0 }) });
  await run(morning(26)); await run(new Date('2026-10-26T13:01:00Z'));
  assert.equal(calls, 1);
  await run(new Date('2026-10-26T13:16:00Z')); assert.equal(calls, 2);
  await run(new Date('2026-10-26T13:32:00Z')); assert.equal(calls, 2);
  const second = fixture(); let release; let parallelCalls = 0;
  const locked = createPaymentReminderRunner({ db: second, saveDb() {}, enabled: true, isAdmin: () => false, sendPush: () => { parallelCalls++; return new Promise(resolve => { release = resolve; }); } });
  const first = locked(morning(26)); await locked(morning(26));
  assert.equal(parallelCalls, 1); release({ sent: 1 }); await first;
});
test('disabled users, users without subscription and admins receive no renewal sends', async () => {
  for (const transform of [db => { db.users[0].disabled = true; }, db => { db.subs = []; }, db => { db.users[0].admin = true; }, db => { db.trainerPaymentReminders[uid].enabled = false; }]) {
    const db = fixture(); transform(db); let calls = 0;
    await createPaymentReminderRunner({ db, saveDb() {}, enabled: true, isAdmin: u => !!u.admin, sendPush: async () => { calls++; return { sent: 1 }; } })(morning(26));
    assert.equal(calls, 0);
  }
});
test('renewal changes cancel the old scheduled notice, and invalid preferences are refused', async () => {
  const db = fixture(); let calls = 0;
  db.trainerPayments.push({ ...payment, validFrom: '2026-10-29', nextDueOn: '2026-11-29' });
  await createPaymentReminderRunner({ db, saveDb() {}, enabled: true, isAdmin: () => false, sendPush: async () => { calls++; return { sent: 1 }; } })(morning(26));
  assert.equal(calls, 0);
  assert.throws(() => validatePaymentReminders({ ...prefs, time: '25:10' }));
  assert.throws(() => validatePaymentReminders({ ...prefs, timeZone: 'No/SuchZone' }));
  assert.throws(() => validatePaymentReminders({ ...prefs, enabled: 'true' }));
  assert.deepEqual(validatePaymentReminders(prefs), prefs);
});
