import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentSummary, validPaymentDate, validateManualPayment, trainerToday } from '../trainer-payments.js';
const entry = (validFrom, nextDueOn, extra = {}) => ({ validFrom, nextDueOn, paidOn: '2026-10-01', created: 1, voidedAt: null, ...extra });

test('payment dates refuse rollover and accept leap days', () => {
  assert.equal(validPaymentDate('2026-02-30'), false);
  assert.equal(validPaymentDate('2026-02-29'), false);
  assert.equal(validPaymentDate('2028-02-29'), true);
  assert.equal(validPaymentDate('26/10/2026'), false);
});
test('renewal status uses calendar days, including the due day and seven-day window', () => {
  const p = [entry('2026-10-01', '2026-11-01')];
  assert.equal(paymentSummary([], '2026-10-26').status, 'none');
  assert.equal(paymentSummary(p, '2026-10-20').status, 'current');
  assert.equal(paymentSummary(p, '2026-10-25').status, 'upcoming');
  assert.equal(paymentSummary(p, '2026-11-01').status, 'due');
  assert.equal(paymentSummary(p, '2026-11-02').status, 'overdue');
  assert.equal(paymentSummary(p, '2026-11-02').daysUntilDue, -1);
});
test('advance payment extends adjacent coverage, but cannot hide a current gap', () => {
  const current = entry('2026-10-01', '2026-11-01');
  assert.equal(paymentSummary([current, entry('2026-11-01', '2026-12-01')], '2026-10-26').nextDueOn, '2026-12-01');
  assert.equal(paymentSummary([entry('2026-09-01', '2026-10-01'), entry('2026-11-01', '2026-12-01')], '2026-10-26').status, 'overdue');
  assert.equal(paymentSummary([entry('2026-11-01', '2026-12-01')], '2026-10-26').status, 'scheduled');
});
test('voided records remain in history but do not count as paid coverage', () => {
  const p = [entry('2026-10-01', '2026-11-01'), entry('2026-11-01', '2026-12-01', { voidedAt: 123 })];
  assert.equal(paymentSummary(p, '2026-10-26').nextDueOn, '2026-11-01');
  assert.equal(paymentSummary([p[1]], '2026-10-26').status, 'none');
  assert.equal(p.length, 2);
});
test('Caracas payment day does not advance at UTC midnight', () => {
  const previous = process.env.TRAINER_TIMEZONE;
  process.env.TRAINER_TIMEZONE = 'America/Caracas';
  try { assert.equal(trainerToday(new Date('2026-10-27T02:00:00Z')), '2026-10-26'); }
  finally { if (previous === undefined) delete process.env.TRAINER_TIMEZONE; else process.env.TRAINER_TIMEZONE = previous; }
});
test('manual entry validates amount precision, coverage and actual paid date', () => {
  const good = { requestId: '11111111-1111-4111-8111-111111111111', userId: 'pupil', paidOn: '2026-10-26', validFrom: '2026-11-01', nextDueOn: '2026-12-01', amountMinor: 3050, currency: 'USD' };
  assert.equal(validateManualPayment(good, '2026-10-26').amountMinor, 3050);
  assert.equal(validateManualPayment({ ...good, amountMinor: null }, '2026-10-26').amountMinor, null);
  assert.throws(() => validateManualPayment({ ...good, amountMinor: 10.5 }, '2026-10-26'));
  assert.throws(() => validateManualPayment({ ...good, amountMinor: -1 }, '2026-10-26'));
  assert.throws(() => validateManualPayment({ ...good, paidOn: '2026-10-27' }, '2026-10-26'));
  assert.throws(() => validateManualPayment({ ...good, nextDueOn: good.validFrom }, '2026-10-26'));
});
