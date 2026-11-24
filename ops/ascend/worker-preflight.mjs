#!/usr/bin/env node
// Read-only Megaton deployment checks. Never prints credentials or invokes a job.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const envPath = process.argv[2];
if (!envPath) { console.error('Usage: node worker-preflight.mjs /path/to/release/.env'); process.exit(2); }
const env = {};
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
  if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}
let failures = 0;
function check(label, ok) { console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`); if (!ok) failures++; }
check('Outbound dispatch disabled', env.MEGATON_WORKER_SEND_ENABLED !== 'true');
check('ASCEND unattended automation disabled', env.ASCEND_AUTOMATION_ENABLED !== 'true');
check('Worker token present', /^[A-Za-z0-9_-]{43,256}$/.test(env.MEGATON_WORKER_TOKEN || ''));
check('Worker digest matches', !!env.MEGATON_WORKER_TOKEN && createHash('sha256').update(env.MEGATON_WORKER_TOKEN).digest('hex') === env.MEGATON_WORKER_TOKEN_SHA256);
check('Worker identity configured', !!env.MEGATON_WORKER_ADMIN_ID && /^\d+$/.test(env.MEGATON_WORKER_SESSION_VERSION || ''));
let url; try { url = new URL(env.MEGATON_WORKER_URL); } catch {}
check('Worker URL is loopback HTTP or HTTPS', !!url && url.pathname === '/api/megaton/worker' && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))));
const expectedPort = process.argv[3];
if (expectedPort) check('Worker URL targets intended admin port', !!url && url.port === expectedPort);
console.log(failures ? `BLOCKED: ${failures} failed preflight check(s)` : 'Static preflight passed; database/session checks still required');
process.exitCode = failures ? 1 : 0;
