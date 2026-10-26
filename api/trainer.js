// Human-trainer pilot: owner-only assignment, distinct from the optional AI Coach.
// Assignments live in db.json, never overwrite a pupil's synced workout document.
import crypto from 'node:crypto';
import { defaultPaymentReminders, validatePaymentReminders } from './trainer-payment-reminders.js';
import { paymentSummary, trainerToday, validateManualPayment, PaymentValidationError } from './trainer-payments.js';

export function trainerRoutes({ enabled, json, readBody, readSession, requireOwner, db, saveDb, readState, unreadable, isAdmin, audit }) {
  const routes = {};
  const gate = (req, res, owner = false) => {
    if (!enabled) { json(res, 404, { error: 'pilot disabled' }); return null; }
    if (owner) return requireOwner(req, res);
    const user = readSession(req);
    if (!user) json(res, 401, { error: 'not signed in' });
    return user;
  };
  const payments = () => Array.isArray(db.trainerPayments) ? db.trainerPayments : [];
  const paymentsFor = userId => payments().filter(p => p.userId === userId);
  const savePayments = next => {
    const before = db.trainerPayments; db.trainerPayments = next;
    try { saveDb(); } catch (e) { db.trainerPayments = before; throw e; }
  };
  const assignments = () => db.trainerAssignments || (db.trainerAssignments = {});
  routes['GET /api/me/payments'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    if (isAdmin(user)) return json(res, 403, { error: 'Esta vista es para alumnos.' });
    const requested = new URL(req.url, 'http://x').searchParams.get('userId');
    if (requested && requested !== user.id) return json(res, 403, { error: 'Solo puedes consultar tus pagos.' });
    const today = trainerToday();
    const history = [...paymentsFor(user.id)].sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.created - a.created);
    const publicPayments = history.map(({ id, paidOn, validFrom, nextDueOn, amountMinor, currency, method, voidedAt }) => ({ id, paidOn, validFrom, nextDueOn, amountMinor, currency, method, voided: !!voidedAt }));
    json(res, 200, { payments: publicPayments, summary: paymentSummary(history, today), today,
      reminders: db.trainerPaymentReminders?.[user.id] || defaultPaymentReminders(),
      hasPushSubscription: db.subs.some(s => s.userId === user.id) });
  };
  routes['POST /api/me/payment-reminders'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    if (isAdmin(user)) return json(res, 403, { error: 'Esta vista es para alumnos.' });
    const body = await readBody(req);
    let prefs;
    try { prefs = validatePaymentReminders(body); }
    catch (e) { if (e instanceof PaymentValidationError) return json(res, 400, { error: e.message }); throw e; }
    const before = db.trainerPaymentReminders;
    db.trainerPaymentReminders = { ...(before || {}), [user.id]: prefs };
    try { saveDb(); } catch (e) { db.trainerPaymentReminders = before; throw e; }
    json(res, 200, { reminders: prefs });
  };
  routes['POST /api/trainer/assign'] = async (req, res) => {
    const trainer = gate(req, res, true); if (!trainer) return;
    const body = await readBody(req);
    const pupil = db.users.find(u => u.id === body.userId && !u.disabled && !isAdmin(u));
    if (!pupil) return json(res, 404, { error: 'active pupil not found' });
    if (!Array.isArray(body.days) || body.days.length > 7 || body.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
      return json(res, 400, { error: 'invalid weekdays' });
    }
    const source = readState(trainer.id);
    if (source === unreadable) return json(res, 503, { error: 'trainer data unavailable' });
    const routine = Array.isArray(source?.routines) ? source.routines.find(r => r && r.id === body.routineId) : null;
    if (!routine || !Array.isArray(routine.ex) || !routine.ex.length) return json(res, 400, { error: 'sync a non-empty routine first' });
    const used = new Set(routine.ex.map(e => e?.id));
    // Uploaded media belongs to its author. Sharing metadata does not grant access to uploads.
    const customEx = (Array.isArray(source.customEx) ? source.customEx : []).filter(c => c && used.has(c.id)).map(c => {
      const { id, n, bp, tg, eq, sm, desc, primaries, secondaries } = c;
      return { id, n, bp, tg, eq, sm, desc, primaries, secondaries, custom: true };
    });
    const days = [...new Set(body.days)];
    const assignment = {
      id: crypto.randomUUID(), trainerId: trainer.id, trainerName: trainer.name,
      created: Date.now(), accepted: null, feedback: '',
      bundle: { opengym_plan: 1, name: routine.name, unit: source.unit || 'kg',
        routines: [{ id: routine.id, name: routine.name, emoji: routine.emoji, ex: routine.ex, ...(routine.prog ? { prog: routine.prog } : {}) }],
        customEx, week: Object.fromEntries(days.map(d => [d, [routine.id]])) }
    };
    assignments()[pupil.id] = assignment;
    saveDb();
    audit(req, 'trainer.plan.assign', { user: trainer, target: pupil });
    json(res, 200, { assignment });
  };
  routes['GET /api/trainer/pupils'] = async (req, res) => {
    if (!gate(req, res, true)) return;
    const today = trainerToday();
    const pupils = db.users.filter(u => !isAdmin(u)).map(u => {
      const s = readState(u.id);
      const unavailable = s === unreadable;
      const workouts = !unavailable && Array.isArray(s?.workouts) ? s.workouts.filter(w => w && Array.isArray(w.entries)) : [];
      return { id: u.id, name: u.name, disabled: !!u.disabled, unavailable,
        workouts: workouts.length, lastWorkout: workouts.map(w => w.d).filter(d => typeof d === 'string').sort().at(-1) || null,
        assignment: assignments()[u.id] || null, billing: paymentSummary(paymentsFor(u.id), today) };
    });
    json(res, 200, { pupils, today });
  };
  routes['GET /api/trainer/payments'] = async (req, res) => {
    if (!gate(req, res, true)) return;
    const userId = new URL(req.url, 'http://x').searchParams.get('userId');
    const pupil = db.users.find(u => u.id === userId && !isAdmin(u));
    if (!pupil) return json(res, 404, { error: 'Alumno no encontrado.' });
    const today = trainerToday();
    const history = [...paymentsFor(userId)].sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.created - a.created);
    json(res, 200, { payments: history, summary: paymentSummary(history, today), today });
  };
  routes['POST /api/trainer/payments'] = async (req, res) => {
    const trainer = gate(req, res, true); if (!trainer) return;
    const body = await readBody(req);
    const pupil = db.users.find(u => u.id === body?.userId && !isAdmin(u));
    if (!pupil) return json(res, 404, { error: 'Alumno no encontrado.' });
    let clean;
    try { clean = validateManualPayment(body, trainerToday()); }
    catch (e) { if (e instanceof PaymentValidationError) return json(res, 400, { error: e.message }); throw e; }
    const existing = payments().find(p => p.requestId === body.requestId && p.recordedBy === trainer.id);
    if (existing) {
      const same = Object.entries(clean).every(([key, value]) => existing[key] === value);
      if (!same) return json(res, 409, { error: 'Este envío ya fue registrado. Cierra el formulario y revisa el historial antes de crear otro.' });
      return json(res, 200, { payment: existing, summary: paymentSummary(paymentsFor(pupil.id)) });
    }
    const payment = { ...clean, id: crypto.randomUUID(), requestId: body.requestId, recordedBy: trainer.id, created: Date.now(), voidedAt: null };
    savePayments([...payments(), payment]);
    audit(req, 'trainer.payment.record', { user: trainer, target: pupil });
    json(res, 201, { payment, summary: paymentSummary(paymentsFor(pupil.id)) });
  };
  routes['POST /api/trainer/payments/void'] = async (req, res) => {
    const trainer = gate(req, res, true); if (!trainer) return;
    const body = await readBody(req);
    const payment = payments().find(p => p.id === body?.id);
    if (!payment) return json(res, 404, { error: 'Registro no encontrado.' });
    if (!payment.voidedAt) {
      const updated = { ...payment, voidedAt: Date.now(), voidedBy: trainer.id };
      savePayments(payments().map(p => p.id === payment.id ? updated : p));
      audit(req, 'trainer.payment.void', { user: trainer, target: db.users.find(u => u.id === payment.userId) });
    }
    json(res, 200, { ok: true, summary: paymentSummary(paymentsFor(payment.userId)) });
  };
  routes['GET /api/trainer/assignment'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    json(res, 200, { assignment: assignments()[user.id] || null });
  };
  routes['POST /api/trainer/assignment/accept'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    const body = await readBody(req);
    const assignment = assignments()[user.id];
    if (!assignment || assignment.id !== body.id) return json(res, 409, { error: 'assignment changed; refresh' });
    // Acceptance is recorded only once the pupil's synced document contains the import marker.
    const s = readState(user.id);
    if (s === unreadable) return json(res, 503, { error: 'pupil data unavailable' });
    if (!s?.trainerApplied?.includes(assignment.id)) return json(res, 409, { error: 'sync the imported plan first' });
    assignment.accepted ||= Date.now();
    saveDb();
    json(res, 200, { ok: true });
  };
  routes['POST /api/trainer/feedback'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    const body = await readBody(req);
    const assignment = assignments()[user.id];
    if (!assignment || assignment.id !== body.id) return json(res, 409, { error: 'assignment changed; refresh' });
    if (typeof body.text !== 'string' || body.text.length > 1000) return json(res, 400, { error: 'feedback must be at most 1000 characters' });
    assignment.feedback = body.text.trim();
    assignment.feedbackAt = Date.now();
    saveDb();
    json(res, 200, { ok: true });
  };
  return routes;
}
