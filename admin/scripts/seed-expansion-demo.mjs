import { createRequire } from 'node:module'
import { encryptMfaSecret, generateTotp, verifyTotp } from '../src/lib/server/mfa.ts'
const require = createRequire(import.meta.url)
const { Pool } = require('pg')
const bcrypt = require('bcryptjs')

// Deliberately independent of DATABASE_URL and root .env. Never seed a normal runtime database.
const url = new URL(process.env.EXPANSION_TEST_DATABASE_URL || 'invalid:')
const demoDatabases = ['/ss_expansion_test', '/ss_expansion_hardening_browser']
if (process.env.NODE_ENV === 'production' || !['127.0.0.1', 'localhost'].includes(url.hostname) || !demoDatabases.includes(url.pathname)) {
  throw new Error('An explicit loopback Expansion demonstration database is required.')
}
if (!process.env.MFA_ENCRYPTION_KEY) throw new Error('A dedicated test MFA_ENCRYPTION_KEY is required; do not reuse a production key.')
const pool = new Pool({connectionString:url.toString()})
try {
  const hash = await bcrypt.hash('Expansion-Demo-Only-2026',12)
  const result = await pool.query("insert into admin_users(email,display_name,password_hash,role,active) values($1,$2,$3,'owner',true) on conflict(lower(email)) do update set password_hash=excluded.password_hash,active=true returning id",['expansion-founder@example.invalid','DEMO Expansion Founder',hash])
  // A public fixture secret is safe only behind the disposable-database guard above.
  // Exercise the existing production MFA code; never relax required privileged MFA.
  const secret='JBSWY3DPEHPK3PXP'
  if (!verifyTotp(secret,generateTotp(secret))) throw new Error('Demo MFA verification failed.')
  const state={version:1,status:'active',encryptedSecret:encryptMfaSecret(secret),recoveryCodeHashes:[],createdAt:new Date().toISOString(),verifiedAt:new Date().toISOString()}
  await pool.query('update admin_users set mfa_enabled=true,mfa_state=$1 where id=$2',[JSON.stringify(state),result.rows[0].id])
  const client = await pool.query("insert into clients(name,contact_email,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) select 'DEMO Expansion Client','expansion-client@example.invalid','EXPDEMO','1 Test Street','Nottingham','NG1 1AA','United Kingdom' where not exists(select 1 from clients where contact_email='expansion-client@example.invalid') returning id")
  await pool.query("insert into invoice_supplier_settings(id,legal_name,address_line_1,city,postcode,country,payment_instructions) values(1,'DEMO Supplier - test only','1 Test Street','Nottingham','NG1 1AA','United Kingdom','Demonstration only. Do not transfer funds.') on conflict(id) do nothing")
  console.log(JSON.stringify({founderId:result.rows[0].id,clientCreated:client.rows.length,identity:'expansion-founder@example.invalid',scope:'Disposable local demonstration only'}))
} finally {await pool.end()}
