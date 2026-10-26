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
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ users: [{ id: owner, name: 'Entrenador', admin: true, owner: true }, { id: pupil, name: 'Alumno' }, { id: other, name: 'Otra alumna' }], creds: [], subs: [], invites: [] }));
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
