// Detailed activity is ephemeral and separate from the upstream admin presence feed.
export function trainerLiveRoutes({ gate, json, readBody, db, saveDb, isAdmin, now = Date.now }) {
  const activity = new Map();
  const student = (req, res) => {
    const user = gate(req, res); if (!user) return null;
    if (isAdmin(user)) { json(res, 403, { error: 'Solo alumnos.' }); return null; }
    return user;
  };
  const prefs = id => db.trainerLiveSharing?.[id] === true;
  const cleanText = value => typeof value === 'string' ? value.trim().slice(0, 160) : '';
  const count = value => Number.isInteger(value) && value >= 0 && value <= 10000;
  return {
    'GET /api/me/live-sharing': async (req, res) => {
      const user = student(req, res); if (!user) return;
      json(res, 200, { enabled: prefs(user.id) });
    },
    'POST /api/me/live-sharing': async (req, res) => {
      const user = student(req, res); if (!user) return;
      const body = await readBody(req);
      if (typeof body?.enabled !== 'boolean') return json(res, 400, { error: 'Indica si quieres compartir tu sesión.' });
      const before = db.trainerLiveSharing;
      db.trainerLiveSharing = { ...before, [user.id]: body.enabled };
      try { saveDb(); } catch (e) { db.trainerLiveSharing = before; throw e; }
      if (!body.enabled) activity.delete(user.id);
      json(res, 200, { enabled: body.enabled });
    },
    'POST /api/me/live-activity': async (req, res) => {
      const user = student(req, res); if (!user) return;
      const body = await readBody(req);
      if (typeof body?.sessionId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(body.sessionId) || !Number.isSafeInteger(body.sequence) || body.sequence < 1) return json(res, 400, { error: 'Sesión no válida.' });
      const previous = activity.get(user.id);
      if (previous && ((previous.sessionId === body.sessionId && body.sequence <= previous.sequence) || (previous.sessionId !== body.sessionId && body.sequence !== 1))) return json(res, 200, { ok: true });
      if (body.active === false) {
        if (!previous || previous.sessionId === body.sessionId) activity.set(user.id, { active: false, sessionId: body.sessionId, sequence: body.sequence, updatedAt: now() });
        return json(res, 200, { ok: true });
      }
      if (!prefs(user.id)) return json(res, 403, { error: 'Compartir sesión está desactivado.' });
      if (body?.active !== true || !['exercise', 'rest', 'rest-paused', 'rest-finished'].includes(body.phase) || !count(body.setsDone) || !count(body.setsTotal) || body.setsDone > body.setsTotal || !cleanText(body.workout))
        return json(res, 400, { error: 'Actividad no válida.' });
      const time = now();
      const restEndsAt = body.phase === 'rest' && count(body.restSeconds) && body.restSeconds > 0 && body.restSeconds <= 3600 ? time + body.restSeconds * 1000 : null;
      if (body.phase === 'rest' && restEndsAt === null) return json(res, 400, { error: 'Descanso no válido.' });
      if (body.phase === 'rest-paused' && (!count(body.restRemaining) || body.restRemaining > 3600)) return json(res, 400, { error: 'Descanso no válido.' });
      activity.set(user.id, { active: true, sessionId: body.sessionId, sequence: body.sequence, workout: cleanText(body.workout), exercise: cleanText(body.exercise), phase: body.phase, setsDone: body.setsDone, setsTotal: body.setsTotal, restEndsAt, restRemaining: body.phase === 'rest-paused' ? body.restRemaining : null, updatedAt: time });
      json(res, 200, { ok: true });
    },
    'GET /api/trainer/live': async (req, res) => {
      if (!gate(req, res, true)) return;
      const time = now();
      for (const [id, record] of activity) if (time - record.updatedAt > 300000 || !db.users.some(u => u.id === id && !u.disabled && !isAdmin(u)) || !prefs(id)) activity.delete(id);
      const pupils = db.users.filter(u => !u.disabled && !isAdmin(u)).map(user => {
        const stored = prefs(user.id) ? activity.get(user.id) : null;
        const record = stored?.active ? stored : null;
        // An elapsed timer is not evidence the pupil resumed a set.
        const phase = record?.phase === 'rest' && record.restEndsAt <= time ? 'rest-finished' : record?.phase;
        return { id: user.id, name: user.name, sharing: prefs(user.id), activity: record ? { workout: record.workout, exercise: record.exercise, setsDone: record.setsDone, setsTotal: record.setsTotal, restEndsAt: record.restEndsAt, restRemaining: record.restRemaining, updatedAt: record.updatedAt, phase, stale: time - record.updatedAt >= 35000 } : null };
      });
      json(res, 200, { pupils, serverTime: time });
    }
  };
}
