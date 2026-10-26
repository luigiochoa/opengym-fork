import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainerLiveRoutes } from '../trainer-live.js';
function fixture() {
  let time = 1000000, failSave = false;
  const db = { users: [{ id: 'coach', admin: true }, { id: 'ana' }, { id: 'bea' }, { id: 'admin2', admin: true }] };
  const routes = trainerLiveRoutes({ db, isAdmin: u => !!u.admin, now: () => time, readBody: async req => req.body, saveDb() { if (failSave) throw new Error('disk'); }, json: (res, status, body) => Object.assign(res, { status, body }), gate(req, res, owner) { const user = db.users.find(u => u.id === req.user && !u.disabled); if (!user || (owner && user.id !== 'coach')) { Object.assign(res, { status: user ? 403 : 401 }); return null; } return user; } });
  return { db, tick: ms => { time += ms; }, fail: () => { failSave = true; }, async req(route, user, body) { const res = {}; await routes[route]({ user, body }, res); return res; } };
}
const snapshot = (extra = {}) => ({ active: true, sessionId: 'session-001', sequence: 1, workout: 'Piernas', exercise: 'Sentadilla', phase: 'exercise', setsDone: 1, setsTotal: 6, ...extra });
test('live sharing requires opt-in and isolates pupil and owner permissions', async () => {
  const h = fixture();
  assert.equal((await h.req('GET /api/me/live-sharing', 'ana')).body.enabled, false);
  assert.equal((await h.req('POST /api/me/live-activity', 'ana', snapshot())).status, 403);
  assert.equal((await h.req('GET /api/trainer/live', 'ana')).status, 403);
  assert.equal((await h.req('GET /api/trainer/live', 'admin2')).status, 403);
  assert.equal((await h.req('POST /api/me/live-sharing', 'coach', { enabled: true })).status, 403);
  await h.req('POST /api/me/live-sharing', 'ana', { enabled: true, userId: 'bea' });
  assert.equal((await h.req('GET /api/me/live-sharing', 'bea')).body.enabled, false);
  await h.req('POST /api/me/live-activity', 'ana', snapshot({ userId: 'bea', secret: 'never expose' }));
  const result = await h.req('GET /api/trainer/live', 'coach');
  assert.equal(result.body.pupils.find(p => p.id === 'ana').activity.exercise, 'Sentadilla');
  assert.equal(result.body.pupils.find(p => p.id === 'bea').activity, null);
  assert.ok(!JSON.stringify(result.body).includes('never expose'));
  assert.ok(!JSON.stringify(result.body).includes('session-001'));
  assert.equal(h.db.trainerActivity, undefined);
});
test('live rest uses server time, expires honestly and becomes stale without another signal', async () => {
  const h = fixture();
  await h.req('POST /api/me/live-sharing', 'ana', { enabled: true });
  await h.req('POST /api/me/live-activity', 'ana', snapshot({ phase: 'rest', restSeconds: 20, restEndsAt: 999999999999 }));
  const activity = async () => (await h.req('GET /api/trainer/live', 'coach')).body.pupils.find(p => p.id === 'ana').activity;
  assert.equal((await activity()).restEndsAt, 1020000);
  h.tick(21000);
  assert.equal((await activity()).phase, 'rest-finished');
  h.tick(14000);
  assert.equal((await activity()).stale, true);
  h.tick(300000);
  assert.equal(await activity(), null);
});
test('out of order updates cannot resurrect a closed session or replace a newer device', async () => {
  const h = fixture();
  await h.req('POST /api/me/live-sharing', 'ana', { enabled: true });
  await h.req('POST /api/me/live-activity', 'ana', snapshot());
  await h.req('POST /api/me/live-activity', 'ana', snapshot({ active: false, sequence: 3 }));
  await h.req('POST /api/me/live-activity', 'ana', snapshot({ sequence: 2 }));
  const activity = async () => (await h.req('GET /api/trainer/live', 'coach')).body.pupils.find(p => p.id === 'ana').activity;
  assert.equal(await activity(), null);
  await h.req('POST /api/me/live-activity', 'ana', snapshot({ sessionId: 'session-002', exercise: 'Remo' }));
  await h.req('POST /api/me/live-activity', 'ana', snapshot({ sequence: 4 }));
  assert.equal((await activity()).exercise, 'Remo');
});
test('disabling sharing erases activity and rejects further active updates', async () => {
  const h = fixture();
  await h.req('POST /api/me/live-sharing', 'ana', { enabled: true });
  await h.req('POST /api/me/live-activity', 'ana', snapshot());
  await h.req('POST /api/me/live-sharing', 'ana', { enabled: false });
  assert.equal((await h.req('POST /api/me/live-activity', 'ana', snapshot({ sequence: 2 }))).status, 403);
  assert.equal((await h.req('GET /api/trainer/live', 'coach')).body.pupils.find(p => p.id === 'ana').activity, null);
});
test('invalid inputs and failed preference saves do not enable sharing', async () => {
  const h = fixture();
  assert.equal((await h.req('POST /api/me/live-sharing', 'ana', { enabled: 'true' })).status, 400);
  h.fail();
  await assert.rejects(h.req('POST /api/me/live-sharing', 'ana', { enabled: true }), /disk/);
  assert.equal(h.db.trainerLiveSharing, undefined);
});
test('validates progress and rest payloads and excludes suspended pupils', async () => {
  const h = fixture();
  await h.req('POST /api/me/live-sharing', 'ana', { enabled: true });
  for (const extra of [{ setsDone: 7 }, { setsTotal: -1 }, { sequence: 0 }, { phase: 'unknown' }, { phase: 'rest', restSeconds: Infinity }, { phase: 'rest-paused', restRemaining: -1 }]) assert.equal((await h.req('POST /api/me/live-activity', 'ana', snapshot(extra))).status, 400);
  await h.req('POST /api/me/live-activity', 'ana', snapshot({ phase: 'rest-paused', restRemaining: 40 }));
  assert.equal((await h.req('GET /api/trainer/live', 'coach')).body.pupils[0].activity.phase, 'rest-paused');
  h.db.users.find(u => u.id === 'ana').disabled = true;
  assert.equal((await h.req('GET /api/trainer/live', 'coach')).body.pupils.some(p => p.id === 'ana'), false);
});
