import { createRequire } from 'node:module'
import { encryptMfaSecret, generateTotp, verifyTotp } from '../src/lib/server/mfa.ts'
const require = createRequire(import.meta.url)
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

// Operation Empower browser acceptance fixtures. Deliberately independent of DATABASE_URL and root .env; refuses anything but
// the dedicated loopback disposable database. Every identity is synthetic (.invalid) and labelled TEST ONLY.
const url = new URL(process.env.EMPOWER_BROWSER_DATABASE_URL || 'invalid:')
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/ss_empower_browser_e2e') {
  throw new Error('An explicit loopback ss_empower_browser_e2e database is required.')
}
if (!process.env.MFA_ENCRYPTION_KEY) throw new Error('A dedicated test MFA_ENCRYPTION_KEY is required; never reuse a production key.')
export const EMPOWER_DEMO_PASSWORD = 'Empower-Demo-Only-2026'
// Public fixture secrets, safe only behind the guard above. Production MFA code is exercised unchanged.
const FOUNDERS = [
  { email: 'empower-founder-a@example.invalid', name: 'TEST ONLY Founder A', secret: 'JBSWY3DPEHPK3PXP' },
  { email: 'empower-founder-b@example.invalid', name: 'TEST ONLY Founder B', secret: 'KRSXG5CTMVRXEZLU' },
]
const PARTNERS = [
  { email: 'empower-partner-one@example.invalid', name: 'TEST ONLY Partner One' },
  { email: 'empower-partner-two@example.invalid', name: 'TEST ONLY Partner Two' },
  { email: 'empower-partner-revoked@example.invalid', name: 'TEST ONLY Partner Revoked' },
]
const pool = new Pool({ connectionString: url.toString() })
try {
  const hash = await bcrypt.hash(EMPOWER_DEMO_PASSWORD, 12)
  const ids = {}
  for (const f of FOUNDERS) {
    if (!verifyTotp(f.secret, generateTotp(f.secret))) throw new Error('Demo MFA verification failed.')
    const r = await pool.query("insert into admin_users(email,display_name,password_hash,role,active) values($1,$2,$3,'owner',true) on conflict(lower(email)) do update set password_hash=excluded.password_hash,active=true,session_version=admin_users.session_version returning id", [f.email, f.name, hash])
    const state = { version: 1, status: 'active', encryptedSecret: encryptMfaSecret(f.secret), recoveryCodeHashes: [], createdAt: new Date().toISOString(), verifiedAt: new Date().toISOString() }
    await pool.query('update admin_users set mfa_enabled=true,mfa_state=$1 where id=$2', [JSON.stringify(state), r.rows[0].id])
    ids[f.email] = r.rows[0].id
  }
  for (const p of PARTNERS) {
    const u = await pool.query("insert into admin_users(email,display_name,password_hash,role,active) values($1,$2,$3,'independent_partner',true) on conflict(lower(email)) do update set password_hash=excluded.password_hash,active=true returning id", [p.email, p.name, hash])
    const existing = await pool.query('select id from expansion_partners where user_id=$1', [u.rows[0].id])
    if (!existing.rows.length) {
      const app = await pool.query("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'TEST ONLY','Synthetic browser fixture','Synthetic browser fixture','test-reviewed-v1','activated',now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}') returning id", [p.name, p.email])
      await pool.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at,operating_country) values(gen_random_uuid(),$1,$2,'test-reviewed-v1',now(),now(),'GB')", [u.rows[0].id, app.rows[0].id])
    }
    ids[p.email] = u.rows[0].id
  }
  console.log(JSON.stringify({ founders: FOUNDERS.map((f) => f.email), partners: PARTNERS.map((p) => p.email), scope: 'Disposable local browser acceptance only' }))
} finally { await pool.end() }
