import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { megatonWorkerEffects, parseEnv, preflight } from './worker-preflight.mjs';

const token = 'T'.repeat(43);
const base = { MEGATON_WORKER_TOKEN: token, MEGATON_WORKER_TOKEN_SHA256: createHash('sha256').update(token).digest('hex'), MEGATON_WORKER_ADMIN_ID: 'a', MEGATON_WORKER_SESSION_VERSION: '3', MEGATON_WORKER_URL: 'http://127.0.0.1:3301/api/megaton/worker' };
const active = (env) => megatonWorkerEffects(env).filter((e) => e.active).map((e) => e.name);

test('a safe production environment passes and reports every effect inactive', () => {
  const r = preflight(base, '3301');
  assert.equal(r.failures, 0);
  assert.deepEqual(active(base), []);
});

test('the historical canary port is caught when the live admin port is expected', () => {
  assert.equal(preflight({ ...base, MEGATON_WORKER_URL: 'http://127.0.0.1:3201/api/megaton/worker' }, '3301').failures, 1);
});

test('notifications run even with every send switch off, and block until authorised', () => {
  const env = { ...base, MEGATON_ENABLED: 'true', MEGATON_EXTERNAL_ENABLED: 'true', MEGATON_STOP: 'false', MEGATON_NOTIFICATIONS_ENABLED: 'true', MEGATON_WORKER_SEND_ENABLED: 'false', MEGATON_SEND_ENABLED: 'false' };
  assert.ok(active(env).includes('review_notifications'));
  assert.equal(preflight(env).failures, 1);
  assert.equal(preflight({ ...env, MEGATON_PREFLIGHT_AUTHORISED_EFFECTS: 'review_notifications' }).failures, 0);
});

test('retention deletion is destructive and blocks; mailbox sync is reported as a warning', () => {
  const env = { ...base, MEGATON_ENABLED: 'true', MEGATON_STOP: 'false', MEGATON_MESSAGE_RETENTION_DAYS: '30', MEGATON_EXTERNAL_ENABLED: 'true', MEGATON_MAILCOW_HOST: 'h', MEGATON_MAILCOW_USER: 'u', MEGATON_MAILCOW_PASSWORD: 'p', MEGATON_MAILCOW_FROM: 'f@x.invalid' };
  const r = preflight(env);
  assert.deepEqual(active(env).sort(), ['mailbox_sync', 'message_retention_delete', 'queued_job_processing']);
  assert.equal(r.failures, 1);
  assert.ok(r.results.some((x) => x.status === 'WARN' && /mailbox_sync/.test(x.label)));
});

test('MEGATON_STOP defaults to stopped, matching megaton-config', () => {
  assert.deepEqual(active({ ...base, MEGATON_ENABLED: 'true', MEGATON_EXTERNAL_ENABLED: 'true', MEGATON_NOTIFICATIONS_ENABLED: 'true', MEGATON_MESSAGE_RETENTION_DAYS: '30' }), []);
});

test('parses quoted values and never needs to print them', () => {
  assert.deepEqual(parseEnv('A="1"\nB=\'two\'\n# c\nbad line'), { A: '1', B: 'two' });
});

test('B2.9: parses exactly like node --env-file, so a switch that is on at runtime is never reported inactive', () => {
  const text = 'MEGATON_ENABLED=true # live\nexport MEGATON_EXTERNAL_ENABLED=true\nMEGATON_STOP = false\nMEGATON_NOTIFICATIONS_ENABLED=true\n';
  const env = parseEnv(text);
  assert.equal(env.MEGATON_ENABLED, 'true');
  assert.equal(env.MEGATON_EXTERNAL_ENABLED, 'true');
  assert.equal(env.MEGATON_STOP, 'false');
  assert.ok(active({ ...base, ...env }).includes('review_notifications'));
  assert.equal(preflight({ ...base, ...env }).failures, 1);
});
