#!/usr/bin/env node
// Read-only Megaton worker deployment checks. Never prints credentials or invokes a job.
//
// Disabling outbound email (MEGATON_WORKER_SEND_ENABLED) does NOT make the Megaton worker side-effect free. Each call to
// /api/megaton/worker (runMegatonWorker in admin/src/lib/server/megaton.ts) can also deliver review notifications,
// dispatch social posts, delete messages for retention, enqueue mailbox sync and process already-queued jobs, each behind
// a different switch. This preflight reports every one and blocks on any external or destructive effect that has not
// been separately authorised in MEGATON_PREFLIGHT_AUTHORISED_EFFECTS (comma-separated effect names).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

/** Mirrors the gating in megaton-config.ts, megaton-growth.ts and runMegatonWorker. Keep in step with those files. */
export function megatonWorkerEffects(env) {
  const on = (k) => env[k] === 'true';
  const enabled = on('MEGATON_ENABLED'), external = on('MEGATON_EXTERNAL_ENABLED'), stopped = env.MEGATON_STOP !== 'false';
  const live = enabled && !stopped;
  const mailbox = ['MEGATON_MAILCOW_HOST', 'MEGATON_MAILCOW_USER', 'MEGATON_MAILCOW_PASSWORD', 'MEGATON_MAILCOW_FROM'].every((k) => !!env[k]?.trim());
  const retentionDays = Number(env.MEGATON_MESSAGE_RETENTION_DAYS ?? 0);
  return [
    { name: 'review_notifications', kind: 'external', active: on('MEGATON_NOTIFICATIONS_ENABLED') && live && external, gate: 'MEGATON_NOTIFICATIONS_ENABLED + MEGATON_ENABLED + MEGATON_EXTERNAL_ENABLED + MEGATON_STOP=false', note: 'Independent of every send switch.' },
    { name: 'social_dispatch', kind: 'external', active: live && external && on('MEGATON_SEND_ENABLED') && on('MEGATON_SOCIAL_SEND_ENABLED'), gate: 'MEGATON_SEND_ENABLED + MEGATON_SOCIAL_SEND_ENABLED (+ enabled, external, not stopped)' },
    { name: 'outbox_email_dispatch', kind: 'external', active: on('MEGATON_WORKER_SEND_ENABLED'), gate: 'MEGATON_WORKER_SEND_ENABLED (and megaton.approve on the worker identity)' },
    { name: 'message_retention_delete', kind: 'destructive', active: live && Number.isInteger(retentionDays) && retentionDays > 0, gate: 'MEGATON_MESSAGE_RETENTION_DAYS > 0 (+ enabled, not stopped)', note: 'Deletes megaton_messages rows; irreversible.' },
    { name: 'mailbox_sync', kind: 'inbound', active: live && external && mailbox, gate: 'MEGATON_ENABLED + MEGATON_EXTERNAL_ENABLED + MEGATON_STOP=false + all MEGATON_MAILCOW_* set', note: 'Reads the company mailbox into the database.' },
    { name: 'queued_job_processing', kind: 'inbound', active: live && external, gate: 'MEGATON_ENABLED + MEGATON_EXTERNAL_ENABLED + MEGATON_STOP=false', note: 'Runs jobs founders already queued (for example mail sync).' },
  ];
}

export function preflight(env, expectedPort) {
  const results = [];
  const check = (label, ok, level = 'FAIL') => results.push({ label, status: ok ? 'PASS' : level });
  check('Worker token present', /^[A-Za-z0-9_-]{43,256}$/.test(env.MEGATON_WORKER_TOKEN || ''));
  check('Worker digest matches', !!env.MEGATON_WORKER_TOKEN && createHash('sha256').update(env.MEGATON_WORKER_TOKEN).digest('hex') === env.MEGATON_WORKER_TOKEN_SHA256);
  check('Worker identity configured', !!env.MEGATON_WORKER_ADMIN_ID && /^\d+$/.test(env.MEGATON_WORKER_SESSION_VERSION || ''));
  let url; try { url = new URL(env.MEGATON_WORKER_URL); } catch { /* reported below */ }
  check('Worker URL is loopback HTTP or HTTPS', !!url && url.pathname === '/api/megaton/worker' && (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))));
  if (expectedPort) check(`Worker URL targets intended admin port ${expectedPort}`, !!url && url.port === String(expectedPort));
  check('ASCEND B2.7 founder automation view not enabled by the worker environment', env.ASCEND_AUTOMATION_ENABLED !== 'true');
  const authorised = new Set((env.MEGATON_PREFLIGHT_AUTHORISED_EFFECTS || '').split(',').map((s) => s.trim()).filter(Boolean));
  const effects = megatonWorkerEffects(env);
  for (const e of effects) {
    if (!e.active) { check(`Effect ${e.name} inactive`, true); continue; }
    if (e.kind === 'inbound') { check(`Effect ${e.name} ACTIVE (${e.kind})`, false, 'WARN'); continue; }
    check(`Effect ${e.name} ACTIVE (${e.kind})${authorised.has(e.name) ? ' and explicitly authorised' : ' without authorisation'}`, authorised.has(e.name));
  }
  const failures = results.filter((r) => r.status === 'FAIL').length;
  return { results, effects, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const envPath = process.argv[2];
  if (!envPath) { console.error('Usage: node worker-preflight.mjs /path/to/release/.env [expected-admin-port]'); process.exit(2); }
  const { results, effects, failures } = preflight(parseEnv(readFileSync(envPath, 'utf8')), process.argv[3]);
  for (const r of results) console.log(`${r.status} ${r.label}`);
  console.log('\nEffects a worker invocation can perform (values are never printed):');
  for (const e of effects) console.log(`  ${e.active ? 'ON ' : 'off'} ${e.name.padEnd(26)} ${e.kind.padEnd(11)} gate: ${e.gate}${e.note ? ` - ${e.note}` : ''}`);
  console.log(failures ? `\nBLOCKED: ${failures} failed preflight check(s)` : '\nStatic preflight passed; database/session checks still required');
  process.exitCode = failures ? 1 : 0;
}
