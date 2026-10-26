// Human-trainer pilot: owner-only assignment, distinct from the optional AI Coach.
// Assignments live in db.json, never overwrite a pupil's synced workout document.
import crypto from 'node:crypto';

export function trainerRoutes({ enabled, json, readBody, readSession, requireOwner, db, saveDb, readState, unreadable, isAdmin, audit }) {
  const routes = {};
  const gate = (req, res, owner = false) => {
    if (!enabled) { json(res, 404, { error: 'pilot disabled' }); return null; }
    if (owner) return requireOwner(req, res);
    const user = readSession(req);
    if (!user) json(res, 401, { error: 'not signed in' });
    return user;
  };
  const assignments = () => db.trainerAssignments || (db.trainerAssignments = {});
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
    const pupils = db.users.filter(u => !isAdmin(u)).map(u => {
      const s = readState(u.id);
      const unavailable = s === unreadable;
      const workouts = !unavailable && Array.isArray(s?.workouts) ? s.workouts.filter(w => w && Array.isArray(w.entries)) : [];
      return { id: u.id, name: u.name, disabled: !!u.disabled, unavailable,
        workouts: workouts.length, lastWorkout: workouts.map(w => w.d).filter(d => typeof d === 'string').sort().at(-1) || null,
        assignment: assignments()[u.id] || null };
    });
    json(res, 200, { pupils });
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
