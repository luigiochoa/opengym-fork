// A loopback-only, disposable pilot with synthetic accounts. Never uses production data or .env.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../api/password.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const local = path.join(root, 'work/local-pilot');
const data = path.join(local, 'data');
const access = path.join(local, 'access.json');
const port = Number(process.env.PILOT_WEB_PORT || 5174);
const apiPort = Number(process.env.PILOT_API_PORT || 4318);
if (![port, apiPort].every(p => Number.isInteger(p) && p > 1024 && p < 65536) || port === apiPort) throw new Error('Use two different local ports between 1025 and 65535');
const vite = path.join(root, 'frontend/node_modules/vite/bin/vite.js');
if (!fs.existsSync(vite)) throw new Error('Instala dependencias: npm ci --ignore-scripts --prefix frontend');
fs.mkdirSync(data, { recursive: true, mode: 0o700 });
if (fs.existsSync(path.join(data, 'db.json')) && !fs.existsSync(access)) throw new Error('Hay datos sin marca de piloto. No se modificarán. Usa otra copia del proyecto.');
if (!fs.existsSync(path.join(data, 'db.json'))) {
  const password = crypto.randomBytes(12).toString('base64url');
  const pw = { h: await hashPassword(password), set: new Date().toISOString() };
  const users = [{ id: 'pilot-owner', name: 'Entrenador', admin: true, owner: true, pw }, { id: 'pilot-ana', name: 'Ana', pw }, { id: 'pilot-bea', name: 'Bea', pw }];
  fs.writeFileSync(path.join(data, 'secret'), crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  fs.writeFileSync(path.join(data, 'db.json'), JSON.stringify({ users, creds: [], subs: [], invites: [] }), { mode: 0o600 });
  for (const user of users) {
    const routines = user.admin ? [{ id: 'pilot-legs', name: 'Piernas · Piloto', emoji: 'legs', ex: [{ id: '0598', sets: 3, reps: 10, weight: 60 }, { id: 'ts-hip-thrust', sets: 3, reps: 12, weight: 27.5 }] }] : [];
    fs.writeFileSync(path.join(data, `state-${user.id}.json`), JSON.stringify({ unit: 'kg', lang: 'es', theme: 'dark', accent: 'custom', accentCustom: '#67C00A', routines, week: {}, workouts: [], bodyweight: [], customEx: [], weighIn: false }), { mode: 0o600 });
  }
  fs.writeFileSync(access, JSON.stringify({ synthetic: true, users: users.map(u => u.name), password }, null, 2), { mode: 0o600 });
}
const credentials = JSON.parse(fs.readFileSync(access, 'utf8'));
if (credentials.synthetic !== true) throw new Error('La carpeta no pertenece al piloto de prueba');
const origin = `http://localhost:${port}`;
// Deliberately start from a small environment rather than inherit production switches.
const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: 'development',
  TRAINER_PILOT: '1', PASSWORD_LOGIN: '1', INVITE_ONLY: '1', ALLOW_GUEST: '0', FIRST_USER_ADMIN: '0', DEFAULT_LANG: 'es',
  INVITE_PREFIX: 'FORTA', RP_ID: 'localhost', RP_NAME: 'Fortachones Gym', ORIGIN: origin, DATA_DIR: data,
  LISTEN_HOST: '127.0.0.1', ADMIN_UIDS: 'pilot-owner', AUDIT_LOG: '1', AUDIT_IP: 'off' };
const api = spawn(process.execPath, ['server.js'], { cwd: path.join(root, 'api'), env: { ...env, PORT: String(apiPort) }, stdio: 'inherit' });
const web = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: path.join(root, 'frontend'), stdio: 'inherit', env: { ...env,
    API_TARGET: `http://127.0.0.1:${apiPort}`, API_ORIGIN: origin,
    VITE_APP_NAME: 'Fortachones Gym', VITE_DEFAULT_LANG: 'es', VITE_DEFAULT_ACCENT: 'brand', VITE_BRAND_ACCENT: '#67C00A',
    VITE_BRAND_LOGO: '1', VITE_BRAND_LOGO_SRC: './brand-logo.svg', VITE_BRAND_TAGLINE: 'Conoce tu mejor versión' }
});
console.log(`\nPILOTO LOCAL — datos ficticios\n${origin}\nUsuarios: ${credentials.users.join(', ')}\nContraseña de prueba: ${credentials.password}\nUsa «Iniciar sesión con contraseña». Ctrl+C detiene ambos servicios.\n`);
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true; api.kill('SIGTERM'); web.kill('SIGTERM'); process.exitCode = code;
}
for (const child of [api, web]) {
  child.on('error', err => { console.error(err.message); stop(1); });
  child.on('exit', code => { if (!stopping) stop(code || 0); });
}
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
