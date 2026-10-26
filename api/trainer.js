// Human-trainer pilot: owner-only assignment, distinct from the optional AI Coach.
// Assignments live in db.json, never overwrite a pupil's synced workout document.
import crypto from 'node:crypto';
import { summarizePupil } from './trainer-summary.js';
import { trainerLiveRoutes } from './trainer-live.js';
import { defaultPaymentReminders, validatePaymentReminders } from './trainer-payment-reminders.js';
import { paymentSummary, trainerToday, validateManualPayment, PaymentValidationError } from './trainer-payments.js';

export function trainerRoutes({ enabled, json, readBody, readSession, requireOwner, db, saveDb, readState, unreadable, isAdmin, audit, sendPush, ownerId, readPupilSummary }) {
  const routes = {};
  const gate = (req, res, owner = false) => {
    if (!enabled) { json(res, 404, { error: 'pilot disabled' }); return null; }
    if (owner) return requireOwner(req, res);
    const user = readSession(req);
    if (!user) json(res, 401, { error: 'not signed in' });
    return user;
  };
  const persist = patch => {
    const before = Object.fromEntries(Object.keys(patch).map(key => [key, db[key]]));
    Object.assign(db, patch);
    try { saveDb(); } catch (error) {
      for (const [key, value] of Object.entries(before)) { if (value === undefined) delete db[key]; else db[key] = value; }
      throw error;
    }
  };
  const payments = () => Array.isArray(db.trainerPayments) ? db.trainerPayments : [];
  const paymentsFor = userId => payments().filter(p => p.userId === userId);
  const savePayments = next => persist({ trainerPayments: next });
  const assignments = () => db.trainerAssignments || {};
  const saveAssignment = (userId, next, archive = false) => {
    const patch = { trainerAssignments: { ...assignments(), [userId]: next } };
    if (archive && assignments()[userId]) patch.trainerAssignmentHistory = { ...db.trainerAssignmentHistory, [userId]: [...(db.trainerAssignmentHistory?.[userId] || []), assignments()[userId]].slice(-50) };
    persist(patch);
  };
  const help = () => db.trainerAssistance || {};
  const openHelp = request => request && ['pending', 'attending'].includes(request.status);
  const RECEIPT_TTL = 7 * 86400000, RECEIPT_MAX = 256;
  const receipts = userId => (db.trainerAssistanceReceipts?.[userId] || []).filter(r => Date.now() - r.recordedAt < RECEIPT_TTL);
  const saveHelp = (userId, request, requestId = request.requestId) => {
    let history = receipts(userId).map(r => r.id === request.id ? { ...r, status: request.status, updated: request.updated } : r);
    const previous = help()[userId];
    if (previous?.requestId && previous.id !== request.id && !history.some(r => r.requestId === previous.requestId)) history.push({ id: previous.id, requestId: previous.requestId, kind: previous.kind, status: previous.status, created: previous.created, updated: previous.updated, recordedAt: Date.now() });
    if (requestId && !history.some(r => r.requestId === requestId)) history.push({ id: request.id, requestId, kind: request.kind, status: request.status, created: request.created, updated: request.updated, recordedAt: Date.now() });
    persist({ trainerAssistance: { ...help(), [userId]: request }, trainerAssistanceReceipts: { ...db.trainerAssistanceReceipts, [userId]: history.slice(-RECEIPT_MAX) } });
  };
  routes['GET /api/me/assistance'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    if (isAdmin(user)) return json(res, 403, { error: 'Solo alumnos.' });
    json(res, 200, { request: help()[user.id] || null });
  };
  routes['POST /api/me/assistance'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    if (isAdmin(user)) return json(res, 403, { error: 'Solo alumnos.' });
    const body = await readBody(req);
    if (!['assistance', 'question'].includes(body?.kind) || typeof body.note !== 'string' || body.note.length > 500)
      return json(res, 400, { error: 'Selecciona el motivo y usa hasta 500 caracteres.' });
    if (body.requestId !== undefined && (typeof body.requestId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(body.requestId)))
      return json(res, 400, { error: 'Identificador de solicitud inválido.' });
    const previous = help()[user.id];
    if (body.requestId && previous?.requestId === body.requestId) return json(res, 200, { request: previous });
    const receipt = body.requestId && receipts(user.id).find(r => r.requestId === body.requestId);
    if (receipt) return json(res, 200, { request: { ...receipt, userId: user.id, note: '' } });
    if (openHelp(previous)) {
      if (body.requestId && body.requestId !== previous.requestId) return json(res, 409, { error: 'Ya tienes una solicitud pendiente. Revisa su estado.', request: previous });
      return json(res, 200, { request: previous });
    }
    if (previous && Date.now() - previous.created < 60000) return json(res, 429, { error: 'Espera un minuto antes de enviar otra solicitud.' });
    const trainer = db.users.find(u => u.id === ownerId() && !u.disabled);
    if (!trainer) return json(res, 503, { error: 'Tu entrenador no está disponible.' });
    const request = { id: crypto.randomUUID(), userId: user.id, kind: body.kind, note: body.note.trim(), ...(body.requestId ? { requestId: body.requestId } : {}), created: Date.now(), status: 'pending' };
    saveHelp(user.id, request);
    // Persist first. Push delivery is best effort; the inbox remains the source of truth.
    void sendPush(trainer.id, { title: 'Solicitud de un alumno', body: `${user.name} ${request.kind === 'question' ? 'tiene una duda' : 'necesita asistencia'}.`, tag: 'trainer-assistance-' + user.id, url: '#/trainer' }).catch(e => console.error('assistance push:', e.message));
    json(res, 201, { request });
  };
  routes['GET /api/trainer/assistance'] = async (req, res) => {
    if (!gate(req, res, true)) return;
    const requests = Object.values(help()).filter(r => openHelp(r) && db.users.some(u => u.id === r.userId && !u.disabled && !isAdmin(u)))
      .sort((a, b) => a.created - b.created).map(r => ({ ...r, name: db.users.find(u => u.id === r.userId).name }));
    json(res, 200, { requests });
  };
  routes['POST /api/trainer/assistance/status'] = async (req, res) => {
    if (!gate(req, res, true)) return;
    const body = await readBody(req);
    const request = Object.values(help()).find(r => r.id === body?.id);
    if (!request) return json(res, 404, { error: 'Solicitud no encontrada.' });
    if (!['attending', 'resolved'].includes(body.status)) return json(res, 400, { error: 'Estado inválido.' });
    if (!openHelp(request) || (request.status === 'attending' && body.status === 'attending')) return json(res, 200, { request });
    const updated = { ...request, status: body.status, updated: Date.now() };
    saveHelp(request.userId, updated);
    json(res, 200, { request: updated });
  };
  routes['POST /api/me/assistance/cancel'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    if (isAdmin(user)) return json(res, 403, { error: 'Solo alumnos.' });
    const body = await readBody(req), request = help()[user.id];
    if (!request || request.id !== body?.id) return json(res, 404, { error: 'Solicitud no encontrada.' });
    if (request.status === 'attending') return json(res, 409, { error: 'Tu entrenador ya está atendiendo la solicitud.' });
    const updated = openHelp(request) ? { ...request, status: 'cancelled', updated: Date.now() } : request;
    if (updated !== request) saveHelp(user.id, updated);
    json(res, 200, { request: updated });
  };
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
    saveAssignment(pupil.id, assignment, true);
    audit(req, 'trainer.plan.assign', { user: trainer, target: pupil });
    json(res, 200, { assignment });
  };
  routes['GET /api/trainer/pupils'] = async (req, res) => {
    if (!gate(req, res, true)) return;
    const today = trainerToday(), groupedPayments = new Map();
    for (const payment of payments()) { if (!groupedPayments.has(payment.userId)) groupedPayments.set(payment.userId, []); groupedPayments.get(payment.userId).push(payment); }
    const pupils = db.users.filter(u => !isAdmin(u)).map(u => {
      const summary = readPupilSummary ? readPupilSummary(u.id, today) : summarizePupil(readState(u.id), unreadable, today);
      const assignment = assignments()[u.id];
      const plannedDays = assignment?.accepted ? Object.keys(assignment.bundle?.week || {}).length : null;
      return { id: u.id, name: u.name, disabled: !!u.disabled, unavailable: summary.unavailable, workouts: summary.workouts, lastWorkout: summary.lastWorkout,
        weekly: { completedDays: summary.completedDays, plannedDays },
        assignment: assignment ? { id: assignment.id, trainerName: assignment.trainerName, created: assignment.created, accepted: assignment.accepted, feedback: assignment.feedback, bundle: { name: assignment.bundle?.name || 'Rutina asignada' } } : null,
        billing: paymentSummary(groupedPayments.get(u.id) || [], today) };
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
    if (!assignment.accepted) saveAssignment(user.id, { ...assignment, accepted: Date.now() });
    json(res, 200, { ok: true });
  };
  routes['POST /api/trainer/feedback'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    const body = await readBody(req);
    const assignment = assignments()[user.id];
    if (!assignment || assignment.id !== body.id) return json(res, 409, { error: 'assignment changed; refresh' });
    if (typeof body.text !== 'string' || body.text.length > 1000) return json(res, 400, { error: 'feedback must be at most 1000 characters' });
    const text = body.text.trim(), at = Date.now();
    if (text !== assignment.feedback) {
      const previous = assignment.feedbackHistory || (assignment.feedback ? [{ text: assignment.feedback, at: assignment.feedbackAt || assignment.created }] : []);
      saveAssignment(user.id, { ...assignment, feedback: text, feedbackAt: at, feedbackHistory: [...previous, { text, at }].slice(-50) });
    }
    json(res, 200, { ok: true });
  };
  const assignmentHistory = userId => ({ assignment: assignments()[userId] || null, history: [...(db.trainerAssignmentHistory?.[userId] || [])].reverse() });
  routes['GET /api/trainer/assignment-history'] = async (req, res) => {
    if (!gate(req, res, true)) return;
    const id = new URL(req.url, 'http://x').searchParams.get('userId');
    if (!db.users.some(u => u.id === id && !isAdmin(u))) return json(res, 404, { error: 'Alumno no encontrado.' });
    json(res, 200, assignmentHistory(id));
  };
  routes['GET /api/me/assignment-history'] = async (req, res) => {
    const user = gate(req, res); if (!user) return;
    if (isAdmin(user)) return json(res, 403, { error: 'Solo alumnos.' });
    json(res, 200, assignmentHistory(user.id));
  };
  return { ...routes, ...trainerLiveRoutes({ gate, json, readBody, db, saveDb, isAdmin }) };
}
