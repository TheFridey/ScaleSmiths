import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * B2.11 hotfix: first-login MFA enrolment for privileged accounts, against the production admin build (MFA mandatory) and the
 * disposable ss_empower_browser_e2e database. Synthetic identities only.
 * Proves: new administrator onboarding, enrolment-only restriction of pages and APIs, forced re-sign-in after activation,
 * returning administrator sign-in, owner MFA reset (recovery), owner password reset (now audited), expired and missing
 * allowances stay locked out, and the login rate limit still applies.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL, superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
const OWNER = { email: 'empower-founder-a@example.invalid', password: 'Empower-Demo-Only-2026', secret: 'JBSWY3DPEHPK3PXP' }
const origin = () => {
  const a = new URL(base!), s = new URL(superUrl!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103' || s.pathname !== '/ss_empower_browser_e2e' || !['127.0.0.1', 'localhost'].includes(s.hostname)) throw new Error('Refusing to run outside the disposable browser stack.')
  return a.origin
}
const pool = () => new Pool({ connectionString: superUrl, max: 2 })
const clearLimiter = (db: pg.Pool) => db.query("delete from login_rate_limits where key like 'admin-login:%'")
const api = async (c: BrowserContext, method: 'GET' | 'POST' | 'PATCH', path: string, data?: Record<string, unknown>) => {
  const r = await c.request.fetch(`${origin()}${path}`, { method, headers: { origin: origin() }, data, maxRedirects: 0 })
  return { status: r.status(), body: await r.json().catch(() => ({})) }
}
/** Fills the real login form. Returns the page after the post-sign-in navigation settles. */
async function signIn(browser: Browser, email: string, password: string, totp?: string): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  if (totp) await page.getByLabel(/^Authenticator code/).fill(totp)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await Promise.race([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }), page.getByText('Invalid credentials').waitFor({ timeout: 20000 })]).catch(() => {})
  return { context, page }
}
/** Waits until a fresh 30-second TOTP step so a code is never reused within its window. */
async function freshTotp(secret: string) {
  const left = 30_000 - (Date.now() % 30_000)
  if (left < 5_000) await new Promise((r) => setTimeout(r, left + 500))
  return generateTotp(secret)
}

test('a new administrator enrols MFA on first sign-in and is restricted until enrolment completes', async ({ browser }) => {
  test.setTimeout(300_000)
  const db = pool()
  const email = `b211-new-admin-${Date.now()}@example.invalid`, password = 'B211-Synthetic-Admin-Only-1', nextPassword = 'B211-Synthetic-Admin-Only-2'
  try {
    await clearLimiter(db)
    // Owner creates a privileged account through the real API: it starts with a 72-hour enrolment allowance.
    const owner = await signIn(browser, OWNER.email, OWNER.password, await freshTotp(OWNER.secret))
    await expect(owner.page).not.toHaveURL(/\/login/)
    const created = await api(owner.context, 'POST', '/api/admin-users', { email, displayName: 'B211 Synthetic Admin', password, role: 'administrator' })
    expect(created.status).toBe(201)
    const userId = created.body.userId as string
    const issued = (await db.query("select metadata_json from admin_security_audit where target_user_id=$1 and action='mfa_enrolment_issued'", [userId])).rows
    expect(issued).toHaveLength(1)

    // 1. Password-only first sign-in lands on the MFA setup page, not the workspace.
    await clearLimiter(db)
    const first = await signIn(browser, email, password)
    await expect(first.page).toHaveURL(/\/security\?reason=mfa_enrolment/)
    await expect(first.page.getByText('Set up multi-factor authentication to continue')).toBeVisible()

    // 2. Every privileged page and API is refused while enrolment is outstanding.
    await first.page.goto(`${origin()}/dashboard`)
    await expect(first.page).toHaveURL(/\/security\?reason=mfa_enrolment/)
    for (const path of ['/api/admin-users', '/api/expansion']) {
      const r = await api(first.context, 'GET', path)
      expect(r.status, path).toBe(403)
      expect(r.body.code, path).toBe('mfa_enrolment_required')
    }
    expect((await api(first.context, 'PATCH', `/api/admin-users/${userId}`, { revokeSessions: true })).status).toBe(403)

    // 3. Enrol through the real setup API; activation revokes the enrolment session.
    const begun = await api(first.context, 'POST', '/api/security/mfa', { action: 'begin' })
    expect(begun.status).toBe(200)
    const secret = begun.body.secret as string
    expect(begun.body.recoveryCodes).toHaveLength(10)
    expect((await api(first.context, 'POST', '/api/security/mfa', { action: 'verify', code: await freshTotp(secret) })).status).toBe(200)
    expect((await api(first.context, 'GET', '/api/security/mfa')).status).toBe(401)
    await first.context.close()
    const enabled = (await db.query('select mfa_enabled, mfa_state ? $2 as has_allowance from admin_users where id=$1', [userId, 'enrolment'])).rows[0]
    expect(enabled).toEqual({ mfa_enabled: true, has_allowance: false })

    // 4. Returning administrator: password alone is now refused; password + authenticator code reaches the workspace.
    await clearLimiter(db)
    const passwordOnly = await signIn(browser, email, password)
    await expect(passwordOnly.page).toHaveURL(/\/login/)
    await passwordOnly.context.close()
    const full = await signIn(browser, email, password, await freshTotp(secret))
    await expect(full.page).not.toHaveURL(/\/login|\/security/)
    const afterEnrolment = await api(full.context, 'GET', '/api/admin-users')
    expect(afterEnrolment.status).not.toBe(401)
    expect(afterEnrolment.body.code).not.toBe('mfa_enrolment_required')

    // 5. Recovery: owner resets MFA (owner password required) - the session is revoked and a new enrolment window opens.
    expect((await api(owner.context, 'PATCH', `/api/admin-users/${userId}`, { disableMfa: true, ownerPassword: OWNER.password })).status).toBe(200)
    expect((await api(full.context, 'GET', '/api/admin-users')).status).toBe(401)
    await full.context.close()
    await clearLimiter(db)
    const reEnrol = await signIn(browser, email, password)
    await expect(reEnrol.page).toHaveURL(/\/security\?reason=mfa_enrolment/)
    await reEnrol.context.close()

    // 6. Owner password reset is audited and revokes sessions; the old password stops working.
    expect((await api(owner.context, 'PATCH', `/api/admin-users/${userId}`, { password: nextPassword })).status).toBe(200)
    expect((await db.query("select count(*)::int n from admin_security_audit where target_user_id=$1 and action='password_reset' and success", [userId])).rows[0].n).toBe(1)
    await clearLimiter(db)
    const oldPassword = await signIn(browser, email, password)
    await expect(oldPassword.page).toHaveURL(/\/login/)
    await oldPassword.context.close()
    const newPassword = await signIn(browser, email, nextPassword)
    await expect(newPassword.page).toHaveURL(/\/security\?reason=mfa_enrolment/)
    await newPassword.context.close()

    // 7. An expired allowance, and MFA cleared without an allowance (the pre-fix state), both stay locked out and are audited.
    await db.query("update admin_users set mfa_state = jsonb_set(mfa_state, '{enrolment,expiresAt}', to_jsonb((now() - interval '1 minute')::text)) where id=$1", [userId])
    await clearLimiter(db)
    const expired = await signIn(browser, email, nextPassword)
    await expect(expired.page).toHaveURL(/\/login/)
    await expired.context.close()
    await db.query('update admin_users set mfa_state = null where id=$1', [userId])
    const legacy = await signIn(browser, email, nextPassword)
    await expect(legacy.page).toHaveURL(/\/login/)
    await legacy.context.close()
    const reasons = (await db.query("select metadata_json->>'enrolment' r from admin_security_audit where target_user_id=$1 and action='mfa_challenge_failed' order by created_at", [userId])).rows.map((r) => r.r)
    expect(reasons).toEqual(expect.arrayContaining(['enrolment_allowance_expired', 'no_enrolment_allowance']))

    // 7b. Recovery of exactly that pre-fix state through the owner UI: Reset MFA is offered for a privileged user without MFA.
    await owner.page.goto(`${origin()}/users`)
    const row = owner.page.getByRole('row').filter({ hasText: email })
    await row.getByRole('button', { name: 'Reset MFA', exact: true }).click()
    await owner.page.getByLabel(/Confirm your owner password/).fill(OWNER.password)
    await owner.page.getByRole('button', { name: /Reset MFA and sessions/ }).click()
    await expect.poll(async () => (await db.query('select mfa_state ? $2 as a from admin_users where id=$1', [userId, 'enrolment'])).rows[0].a).toBe(true)
    await clearLimiter(db)
    const recovered = await signIn(browser, email, nextPassword)
    await expect(recovered.page).toHaveURL(/\/security\?reason=mfa_enrolment/)
    await recovered.context.close()

    // 7c. Promotion of a non-privileged user without MFA into a privileged role opens an enrolment window (audited).
    const devEmail = `b211-promoted-${Date.now()}@example.invalid`
    const dev = await api(owner.context, 'POST', '/api/admin-users', { email: devEmail, displayName: 'B211 Promoted Synthetic', password, role: 'developer' })
    expect(dev.status).toBe(201)
    expect((await db.query('select mfa_state from admin_users where id=$1', [dev.body.userId])).rows[0].mfa_state).toBeNull()
    expect((await api(owner.context, 'PATCH', `/api/admin-users/${dev.body.userId}`, { role: 'administrator' })).status).toBe(200)
    expect((await db.query('select mfa_state ? $2 as a from admin_users where id=$1', [dev.body.userId, 'enrolment'])).rows[0].a).toBe(true)
    expect((await db.query("select count(*)::int n from admin_security_audit where target_user_id=$1 and action='mfa_enrolment_issued' and metadata_json->>'reason'='role_promoted'", [dev.body.userId])).rows[0].n).toBe(1)

    // 8. The login rate limit still applies: after five attempts for this email the sixth is refused before any check.
    await clearLimiter(db)
    for (let i = 0; i < 5; i++) { const t = await signIn(browser, email, 'wrong-password-' + i); await t.context.close() }
    const audited = (await db.query('select count(*)::int n from admin_security_audit where target_user_id=$1', [userId])).rows[0].n
    const blocked = await signIn(browser, email, nextPassword)
    await expect(blocked.page).toHaveURL(/\/login/)
    await blocked.context.close()
    expect((await db.query('select count(*)::int n from admin_security_audit where target_user_id=$1', [userId])).rows[0].n).toBe(audited)
    await owner.context.close()
  } finally {
    await clearLimiter(db).catch(() => {})
    await db.end()
  }
})
