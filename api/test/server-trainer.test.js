import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const owner = '11111111-1111-4111-8111-111111111111';
const pupil = '22222222-2222-4222-8222-222222222222';
const secondAdmin = '44444444-4444-4444-8444-444444444444';
const other = '33333333-3333-4333-8333-333333333333';
const secret = crypto.randomBytes(32).toString('hex');
function cookie(uid) {
  const data = `${uid}:${Date.now() + 600000}:0`;
  return `gymsid=${data}.${crypto.createHmac('sha256', secret).update(data).digest('base64url')}`;
}
async function start(t, enabled = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-trainer-'));
  fs.mkdirSync(path.join(dir, 'users'));
  fs.writeFileSync(path.join(dir, 'secret'), secret);
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ users: [{ id: owner, name: 'Entrenador', admin: true, owner: true }, { id: pupil, name: 'Alumno' }, { id: other, name: 'Otra alumna' }, { id: secondAdmin, name: 'Otro administrador', admin: true }], creds: [], subs: [], invites: [] }));
  const trainerState = { unit: 'kg', routines: [{ id: 'routine-1', name: 'Piernas', ex: [{ id: '0598', sets: 3, reps: 10, weight: 60 }] }], workouts: [] };
  fs.writeFileSync(path.join(dir, 'state-' + owner + '.json'), JSON.stringify(trainerState));
  let log = '';
  const child = spawn(process.execPath, ['server.js'], { cwd: API, env: { ...process.env, PORT: '0', DATA_DIR: dir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost', TRAINER_PILOT: enabled ? '1' : '', ADMIN_UIDS: '', AUDIT_LOG: '1', INVITE_PREFIX: 'FORTA' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', b => { log += b; }); child.stderr.on('data', b => { log += b; });
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${await boundPort(child, () => log)}`;
  return { dir, async req(method, route, uid, body) {
    const res = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin', ...(uid ? { Cookie: cookie(uid) } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  } };
}

test('human trainer: assigns, pupil syncs, acknowledges and sends feedback; other pupils remain isolated', async t => {
  const h = await start(t);
  assert.equal((await h.req('GET', '/api/config')).body.trainer_pilot, true);
  assert.equal((await h.req('GET', '/api/trainer/pupils')).status, 401);
  assert.equal((await h.req('GET', '/api/trainer/pupils', pupil)).status, 403);
  assert.equal((await h.req('POST', '/api/trainer/assign', pupil, { userId: other, routineId: 'routine-1', days: [1] })).status, 403);
  assert.equal((await h.req('POST', '/api/trainer/assign', owner, { userId: pupil, routineId: 'missing', days: [1] })).status, 400);
  assert.equal((await h.req('POST', '/api/trainer/assign', owner, { userId: pupil, routineId: 'routine-1', days: [9] })).status, 400);
  const sent = await h.req('POST', '/api/trainer/assign', owner, { userId: pupil, routineId: 'routine-1', days: [1, 3] });
  assert.equal(sent.status, 200);
  const id = sent.body.assignment.id;
  assert.equal((await h.req('GET', '/api/trainer/assignment', pupil)).body.assignment.id, id);
  assert.equal((await h.req('GET', '/api/trainer/assignment', other)).body.assignment, null);
  assert.equal((await h.req('POST', '/api/trainer/assignment/accept', other, { id })).status, 409);
  assert.equal((await h.req('POST', '/api/trainer/assignment/accept', pupil, { id })).status, 409);
  const state = { routines: [{ id: 'imported', name: 'Piernas', ex: [{ id: '0598', sets: 3, reps: 10, weight: 60 }] }], week: { 1: ['imported'] }, workouts: [{ id: 'w1', d: '2026-10-26', entries: [{ id: '0598', sets: [{ w: 60, r: 10, done: true }] }] }], trainerApplied: [id] };
  assert.equal((await h.req('PUT', '/api/data', pupil, { state })).status, 200);
  assert.equal((await h.req('POST', '/api/trainer/assignment/accept', pupil, { id })).status, 200);
  assert.equal((await h.req('POST', '/api/trainer/assignment/accept', pupil, { id })).status, 200);
  assert.equal((await h.req('POST', '/api/trainer/feedback', other, { id, text: 'wrong' })).status, 409);
  assert.equal((await h.req('POST', '/api/trainer/feedback', pupil, { id, text: 'Buen entrenamiento' })).status, 200);
  const overview = await h.req('GET', '/api/trainer/pupils', owner);
  const row = overview.body.pupils.find(p => p.id === pupil);
  assert.equal(row.workouts, 1); assert.ok(row.assignment.accepted); assert.equal(row.assignment.feedback, 'Buen entrenamiento');
  assert.equal((await h.req('GET', '/api/admin/user?id=' + pupil, other)).status, 403);
  const read = await h.req('GET', '/api/admin/user?id=' + pupil, owner);
  assert.equal(read.body.workouts[0].entries[0].sets[0].w, 60);
  assert.equal((await h.req('GET', '/api/data', other)).body.state?.trainerApplied, undefined);
  const invite = await h.req('POST', '/api/admin/invites/new', owner, { note: 'piloto' });
  assert.equal(invite.status, 200); assert.match(invite.body.invite.code, /^FORTA-001-/);
});

test('trainer endpoints remain disabled unless explicitly enabled', async t => {
  const h = await start(t, false);
  assert.equal((await h.req('GET', '/api/trainer/pupils', owner)).status, 404);
  assert.equal((await h.req('GET', '/api/config')).body.trainer_pilot, undefined);
});


test('manual payments: owner-only, validated, retry-safe, private and reversible through voiding', async t => {
  const h = await start(t);
  const body = { requestId: crypto.randomUUID(), userId: pupil, paidOn: '2000-01-01', validFrom: '2000-01-01', nextDueOn: '2099-01-01', amountMinor: 3050, currency: 'USD', method: 'cash', note: 'Prueba privada' };
  const url = '/api/trainer/payments?userId=' + pupil;
  assert.equal((await h.req('GET', url)).status, 401);
  for (const uid of [pupil, other, secondAdmin]) {
    assert.equal((await h.req('GET', url, uid)).status, 403);
    assert.equal((await h.req('POST', '/api/trainer/payments', uid, body)).status, 403);
    assert.equal((await h.req('POST', '/api/trainer/payments/void', uid, { id: 'any' })).status, 403);
  }
  const untouched = await h.req('GET', url, owner);
  assert.equal(untouched.body.summary.status, 'none');
  assert.equal(untouched.body.payments.length, 0);
  const response = await h.req('POST', '/api/trainer/payments', owner, body);
  assert.equal(response.status, 201);
  const id = response.body.payment.id;
  assert.equal(response.body.summary.status, 'current');
  assert.equal((await h.req('POST', '/api/trainer/payments', owner, body)).status, 200);
  assert.equal((await h.req('POST', '/api/trainer/payments', owner, { ...body, amountMinor: 3100 })).status, 409);
  const history = await h.req('GET', url, owner);
  assert.equal(history.body.payments.length, 1);
  assert.equal(history.body.payments[0].amountMinor, 3050);
  const overview = await h.req('GET', '/api/trainer/pupils', owner);
  assert.equal(overview.body.pupils.find(p => p.id === pupil).billing.nextDueOn, '2099-01-01');
  assert.equal(overview.body.pupils.find(p => p.id === other).billing.status, 'none');
  const ownData = await h.req('GET', '/api/data', pupil);
  assert.equal(JSON.stringify(ownData.body).includes('Prueba privada'), false);
  for (const patch of [{ paidOn: '2026-02-30' }, { paidOn: '2099-01-01' }, { nextDueOn: body.validFrom }, { amountMinor: -20 }, { amountMinor: 1.5 }, { currency: 'usd' }, { note: 'x'.repeat(501) }]) {
    assert.equal((await h.req('POST', '/api/trainer/payments', owner, { ...body, requestId: crypto.randomUUID(), ...patch })).status, 400);
  }
  assert.equal((await h.req('POST', '/api/trainer/payments', owner, { ...body, requestId: crypto.randomUUID(), userId: owner })).status, 404);
  const duplicate = { ...body, requestId: crypto.randomUUID(), userId: other, amountMinor: null };
  const parallel = await Promise.all([h.req('POST', '/api/trainer/payments', owner, duplicate), h.req('POST', '/api/trainer/payments', owner, duplicate)]);
  assert.deepEqual(parallel.map(r => r.status).sort(), [200, 201]);
  assert.equal((await h.req('GET', '/api/trainer/payments?userId=' + other, owner)).body.payments.length, 1);
  assert.equal((await h.req('POST', '/api/trainer/payments/void', owner, { id })).status, 200);
  assert.equal((await h.req('POST', '/api/trainer/payments/void', owner, { id })).status, 200);
  const after = await h.req('GET', url, owner);
  assert.equal(after.body.summary.status, 'none');
  assert.equal(after.body.payments.length, 1);
  assert.ok(after.body.payments[0].voidedAt);
  const persisted = JSON.parse(fs.readFileSync(path.join(h.dir, 'db.json'), 'utf8'));
  assert.equal(persisted.trainerPayments.length, 2);
  assert.ok(persisted.trainerPayments.find(p => p.id === id).voidedAt);
  assert.equal((await h.req('POST', '/api/admin/user/delete', owner, { id: pupil })).status, 200);
  const removed = JSON.parse(fs.readFileSync(path.join(h.dir, 'db.json'), 'utf8'));
  assert.equal(removed.trainerPayments.some(p => p.userId === pupil), false);
});

test('pupils can read only their own payment projection and manage only their own reminder opt-in', async t => {
  const h = await start(t);
  const body = { requestId: crypto.randomUUID(), userId: pupil, paidOn: '2000-01-01', validFrom: '2000-01-01', nextDueOn: '2099-01-01', amountMinor: 3050, currency: 'USD', note: 'Nota interna: no compartir' };
  assert.equal((await h.req('POST', '/api/trainer/payments', owner, body)).status, 201);
  assert.equal((await h.req('GET', '/api/me/payments')).status, 401);
  const read = await h.req('GET', '/api/me/payments', pupil);
  assert.equal(read.status, 200); assert.equal(read.body.payments[0].amountMinor, 3050);
  assert.equal(read.body.summary.nextDueOn, '2099-01-01');
  assert.equal(read.body.reminders.enabled, false);
  for (const field of ['note', 'requestId', 'recordedBy', 'userId', 'voidedBy']) assert.equal(field in read.body.payments[0], false);
  assert.equal(JSON.stringify(read.body).includes('Nota interna'), false);
  assert.equal((await h.req('GET', '/api/me/payments?userId=' + pupil, other)).status, 403);
  assert.equal((await h.req('GET', '/api/me/payments', other)).body.payments.length, 0);
  assert.equal((await h.req('POST', '/api/trainer/payments', pupil, body)).status, 403);
  assert.equal((await h.req('POST', '/api/trainer/payments/void', pupil, { id: read.body.payments[0].id })).status, 403);
  const prefs = { enabled: true, time: '09:00', timeZone: 'America/Caracas', userId: other };
  assert.equal((await h.req('POST', '/api/me/payment-reminders', pupil, prefs)).status, 200);
  assert.equal((await h.req('GET', '/api/me/payments', pupil)).body.reminders.enabled, true);
  assert.equal((await h.req('GET', '/api/me/payments', other)).body.reminders.enabled, false);
  assert.equal((await h.req('POST', '/api/me/payment-reminders', pupil, { ...prefs, timeZone: 'Bad/Zone' })).status, 400);
  assert.equal((await h.req('POST', '/api/me/payment-reminders', owner, prefs)).status, 403);
  assert.equal((await h.req('POST', '/api/me/payment-reminders', pupil, { ...prefs, enabled: false })).status, 200);
  assert.equal((await h.req('GET', '/api/me/payments', pupil)).body.reminders.enabled, false);
  assert.equal((await h.req('POST', '/api/admin/user/delete', owner, { id: pupil })).status, 200);
  const persisted = JSON.parse(fs.readFileSync(path.join(h.dir, 'db.json'), 'utf8'));
  assert.equal(persisted.trainerPaymentReminders[pupil], undefined);
});
