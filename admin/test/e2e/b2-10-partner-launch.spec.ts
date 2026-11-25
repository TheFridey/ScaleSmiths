import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import bcrypt from 'bcryptjs'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * Operation EMPOWER B2.10 browser acceptance: a genuine authenticated partner journey and the founder launch tools, against the
 * production admin build and the disposable ss_empower_browser_e2e database (seed with scripts/seed-empower-browser.mjs).
 * Synthetic identities only; partner email is off, so nothing is sent. Where an emailed one-time link would be clicked, the test
 * stores the digest of a link it generated itself (exactly what the service stores) and then follows that link in the browser.
 * [UI] real screens and clicks. [API] authenticated HTTP to prove a refusal. [SQL] disposable-database fixture or assertion.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL, dbUrl = process.env.EMPOWER_BROWSER_DATABASE_URL, superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
const PASSWORD = 'Empower-Demo-Only-2026'
const FOUNDER_A = { email: 'empower-founder-a@example.invalid', secret: 'JBSWY3DPEHPK3PXP' }, FOUNDER_B = { email: 'empower-founder-b@example.invalid', secret: 'KRSXG5CTMVRXEZLU' }
const P1 = 'empower-partner-one@example.invalid', P2 = 'empower-partner-two@example.invalid'
const evidence = '../docs/expansion/empower/evidence/b2-10/browser'
const WIDTHS = [320, 390, 768, 1024, 1440, 1920]
const origin = () => {
  const a = new URL(base!), d = new URL(dbUrl!), s = new URL(superUrl!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103' || d.pathname !== '/ss_empower_browser_e2e' || s.pathname !== '/ss_empower_browser_e2e' || !['127.0.0.1', 'localhost'].includes(d.hostname)) throw new Error('Refusing to run outside the disposable browser stack.')
  return a.origin
}
const inMonths = (n: number) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }
const digest = (t: string) => createHash('sha256').update(t).digest('hex')
async function login(browser: Browser, email: string, password = PASSWORD, totpSecret?: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  if (totpSecret) await page.getByLabel(/^Authenticator code/).fill(generateTotp(totpSecret))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/(partner|command-centre|dashboard|expansion)/)
  return { context, page }
}
const api = async (c: BrowserContext, path: string, data?: Record<string, unknown>) => {
  const r = data ? await c.request.post(`${origin()}${path}`, { headers: { origin: origin() }, data }) : await c.request.get(`${origin()}${path}`)
  return { status: r.status(), body: await r.json().catch(() => ({})) }
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0) }
async function axe(page: Page, scope: string, label: string) {
  const result = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(result.violations.filter((v) => ['serious', 'critical'].includes(String(v.impact))).map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}
async function shots(page: Page, name: string) {
  for (const width of WIDTHS) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); await page.screenshot({ path: `${evidence}/${name}-${width}.png`, fullPage: true }) }
  await page.setViewportSize({ width: 1280, height: 900 })
}
const nav = (page: Page) => page.getByRole('navigation', { name: 'Partner workspace' })
const tab = async (page: Page, name: string) => { await nav(page).getByRole('button', { name, exact: true }).click(); await expect(page.getByRole('heading', { level: 1, name })).toBeVisible() }

test('Operation EMPOWER B2.10: authenticated partner journey, recovery, withdrawal and founder launch tools', async ({ browser }) => {
  test.setTimeout(600_000)
  origin()
  const su = new Pool({ connectionString: superUrl, max: 1 })
  await mkdir(evidence, { recursive: true })
  const run = Date.now().toString(36)
  const consoleErrors: string[] = []
  const partnerId = async (email: string) => String((await su.query('select p.id from expansion_partners p join admin_users u on u.id=p.user_id where lower(u.email)=$1', [email])).rows[0].id)
  const P1_ID = await partnerId(P1), P2_ID = await partnerId(P2)
  // Fresh, repeatable start for partner one's journey (append-only rows are removed by the fixture owner only, via TRUNCATE-free delete in a disposable DB).
  await su.query('alter table expansion_onboarding_progress disable trigger expansion_onboarding_progress_no_change')
  await su.query('delete from expansion_onboarding_progress where partner_id in ($1,$2)', [P1_ID, P2_ID])
  await su.query('alter table expansion_onboarding_progress enable trigger expansion_onboarding_progress_no_change')
  await su.query("delete from expansion_toolkit_items where partner_id=$1 and item_key='email'", [P1_ID])
  const clearLimits = () => su.query('delete from login_rate_limits') // same pattern as the ASCEND specs; the limiter stays in force
  await clearLimits()
  await su.query('update admin_users set password_hash=$1 where lower(email)=$2', [await bcrypt.hash(PASSWORD, 12), P2]) // repeatable: a partial earlier run may have reset it

  let p1 = await login(browser, P1)
  p1.page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`p1: ${m.text()}`) })

  await test.step('[UI] Overview: journey summary, recommended next action and explained empty states', async () => {
    await p1.page.goto(`${origin()}/partner`)
    const summary = p1.page.locator('section.jr-summary')
    await expect(summary).toBeVisible()
    await expect(summary).toContainText(/of 4 steps complete|Onboarding complete/)
    await expect(summary.getByText('RECOMMENDED NEXT')).toBeVisible()
    await axe(p1.page, '#partner-main', 'overview')
    await shots(p1.page, 'partner-overview')
  })

  await test.step('[UI] Getting started: acknowledge the three steps; progress is persisted server-side', async () => {
    await tab(p1.page, 'Getting started')
    await expect(p1.page.getByRole('heading', { name: /Welcome, / })).toBeVisible()
    for (const label of ['I understand how I earn', 'I understand the boundaries', 'I have noted my markets']) {
      const resp = p1.page.waitForResponse((r) => r.url().endsWith('/api/partner') && r.request().method() === 'POST')
      await p1.page.getByRole('button', { name: label }).click()
      expect((await resp).status()).toBe(200)
    }
    await expect.poll(async () => Number((await su.query('select count(*)::int n from expansion_onboarding_progress where partner_id=$1', [P1_ID])).rows[0].n)).toBe(3)
    await expect(p1.page.locator('.jr-steps li[data-done=true]')).toHaveCount((await su.query('select (agreement_acceptance_id is not null) a from expansion_partners where id=$1', [P1_ID])).rows[0].a ? 4 : 3)
    await axe(p1.page, '#partner-main', 'getting started')
    await shots(p1.page, 'partner-getting-started')
  })

  await test.step('[UI] Setup request, referral code and founder support actions work from the journey', async () => {
    await p1.page.locator('.jr-tool').filter({ hasText: 'ScaleSmiths email address' }).getByRole('button', { name: 'Request setup' }).click()
    await expect(p1.page.locator('.jr-tool').filter({ hasText: 'ScaleSmiths email address' })).toContainText('Awaiting setup')
    expect((await su.query("select status from expansion_toolkit_items where partner_id=$1 and item_key='email'", [P1_ID])).rows[0]).toEqual({ status: 'awaiting_approval' })
    const referral = p1.page.locator('.jr-tool').filter({ hasText: 'Your referral code' })
    if (await referral.getByRole('button', { name: 'Create my code' }).count()) await referral.getByRole('button', { name: 'Create my code' }).click()
    await expect(referral).toContainText(/Your code: SS-[A-Z2-7]{8}/)
    await p1.page.locator('.jr-tool').filter({ hasText: 'Technical assistance' }).getByRole('button', { name: 'Request assistance' }).click()
    await expect(p1.page.getByRole('heading', { level: 1, name: 'Meetings & support' })).toBeVisible()
    await expect(p1.page.getByLabel('What do you need?')).toHaveValue('technical_scoping')
    await tab(p1.page, 'Getting started')
    await p1.page.locator('.jr-tool').filter({ hasText: 'Optional founder-led training' }).getByRole('button', { name: /Request training|Request/ }).first().click()
    await expect(p1.page.getByLabel('What do you need?')).toHaveValue('training')
  })

  await test.step('[UI] Every journey link opens a working page and every navigation item opens its section', async () => {
    await tab(p1.page, 'Getting started')
    const hrefs = [...new Set(await p1.page.locator('.jr a[href^="/partner"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') as string)))]
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) { const r = await p1.page.request.get(`${origin()}${href}`); expect(r.status(), href).toBe(200) }
    for (const name of ['Overview', 'Getting started', 'Prospects & pipeline', 'Meetings & support', 'Commission', 'Achievements', 'Referrals', 'My partner page', 'Coming soon']) await tab(p1.page, name)
    await expect(p1.page.getByText('none has a confirmed release date')).toBeVisible()
    await shots(p1.page, 'partner-coming-soon')
    for (const link of await p1.page.locator('a.ex-academy-link').evaluateAll((as) => as.map((a) => a.getAttribute('href') as string))) { const r = await p1.page.request.get(`${origin()}${link}`); expect(r.status(), link).toBe(200) }
  })

  await test.step('[UI] Sign out and back in: progress persists', async () => {
    await p1.page.getByRole('button', { name: 'Sign out' }).click()
    await p1.page.waitForURL(/\/login/)
    await p1.context.close()
    p1 = await login(browser, P1)
    await tab(p1.page, 'Getting started')
    await expect(p1.page.locator('.jr-steps li')).toHaveCount(4)
    await expect(p1.page.locator('.jr-steps li[data-done=true]')).toHaveCount((await su.query('select (agreement_acceptance_id is not null) a from expansion_partners where id=$1', [P1_ID])).rows[0].a ? 4 : 3)
    await expect(p1.page.locator('.jr-tool').filter({ hasText: 'ScaleSmiths email address' })).toContainText('Awaiting setup')
  })

  await test.step('[API] Isolation and refusals', async () => {
    await clearLimits()
    const p2 = await login(browser, P2)
    const journey = (await api(p2.context, '/api/partner')).body.journey
    expect(journey.required.find((s: { key: string }) => s.key === 'how_you_earn').status).toBe('action_required') // partner one's progress is not partner two's
    expect((await api(p2.context, '/api/partner', { action: 'acknowledge_onboarding_step', step: 'agreement' })).status).toBe(400)
    expect((await api(p2.context, '/api/partner', { action: 'request_toolkit_item', itemKey: 'academy' })).status).toBe(400)
    expect((await api(p2.context, '/api/expansion')).status).toBe(403)
    expect((await api(p2.context, '/api/expansion', { action: 'publish_content_batch', versionIds: [] })).status).toBe(403)
    await p2.context.close()
  })

  await clearLimits()
  const fa = await login(browser, FOUNDER_A.email, PASSWORD, FOUNDER_A.secret)
  const fb = await login(browser, FOUNDER_B.email, PASSWORD, FOUNDER_B.secret)
  const title = `TEST ONLY Sales guide ${run}`
  await test.step('[UI] Consolidated review queue: author submits, second founder approves and publishes', async () => {
    const created = await api(fa.context, '/api/expansion', { action: 'create_content_item', kind: 'resource', slug: `b210-sales-guide-${run}`, audience: 'partner_only', cadence: 'service', title,
      body: 'How to introduce ScaleSmiths services at the published starting prices. TEST ONLY content for automated acceptance.', fields: { summary: 'Introducing ScaleSmiths services', category: 'guide' }, sourceRefs: ['web/src/lib/published-starting-prices.ts'] })
    expect(created.status).toBe(200)
    await fa.page.goto(`${origin()}/expansion`)
    await fa.page.getByRole('navigation', { name: 'Partner workspace' }).getByRole('button', { name: 'Content', exact: true }).click()
    const queueA = fa.page.locator('section.ex-review-queue')
    await queueA.getByRole('tab', { name: /Drafts to submit/ }).click()
    await queueA.getByRole('checkbox', { name: `Select ${title}` }).check()
    await queueA.getByRole('button', { name: /^Submit 1 for review/ }).click()
    await expect(queueA.getByRole('status')).toContainText('1 done')
    await fb.page.goto(`${origin()}/expansion`)
    await fb.page.getByRole('navigation', { name: 'Partner workspace' }).getByRole('button', { name: 'Content', exact: true }).click()
    const queueB = fb.page.locator('section.ex-review-queue')
    await queueB.getByRole('checkbox', { name: `Select ${title}` }).check()
    await queueB.getByLabel('Review reference (recorded on every approval)').fill(`TEST ONLY founder review ${run}`)
    await queueB.getByLabel(/^Decision notes/).fill('TEST ONLY: read in full; accurate against the published prices.')
    await shots(fb.page, 'founder-review-queue')
    await queueB.getByRole('button', { name: /^Approve 1 I have read/ }).click()
    await expect(queueB.getByRole('status')).toContainText('1 done')
    await queueB.getByRole('tab', { name: /Approved, ready to publish/ }).click()
    await queueB.getByRole('checkbox', { name: `Select ${title}` }).check()
    await queueB.getByRole('button', { name: /^Publish 1/ }).click()
    await expect(queueB.getByRole('status')).toContainText('1 done')
    const row = (await su.query("select v.status,a.decision,ua.email approver from empower_content_versions v join empower_content_approvals a on a.version_id=v.id join admin_users ua on ua.id=a.decided_by where v.title=$1", [title])).rows[0]
    expect(row).toEqual({ status: 'published', decision: 'approved', approver: FOUNDER_B.email }) // recorded as the founder who clicked
    // A founder cannot batch-approve their own content while another founder is active.
    const own = await api(fa.context, '/api/expansion', { action: 'create_content_item', kind: 'resource', slug: `b210-own-${run}`, audience: 'partner_only', cadence: 'service', title: `TEST ONLY own ${run}`, body: 'TEST ONLY content written by founder A for the self-approval refusal check.', fields: { summary: 'x', category: 'guide' }, sourceRefs: ['web/src/lib/published-starting-prices.ts'] })
    await api(fa.context, '/api/expansion', { action: 'submit_content', versionId: own.body.result.versionId })
    const self = await api(fa.context, '/api/expansion', { action: 'decide_content_batch', versionIds: [own.body.result.versionId], decision: 'approved', reference: 'TEST', notes: 'TEST ONLY self-approval attempt', reviewBy: inMonths(2) })
    expect(self.status).toBe(200)
    expect(self.body.result.results[0].ok).toBe(false)
  })

  await test.step('[UI] The partner journey reflects the newly published content', async () => {
    await p1.page.reload(); await tab(p1.page, 'Getting started')
    await expect(p1.page.locator('.jr-tool').filter({ hasText: 'Sales brochures and guides' })).toContainText('Available')
  })

  await test.step('[UI] Founder onboarding command centre shows the partner checklist and the toolkit request', async () => {
    await fb.page.goto(`${origin()}/expansion?tab=operations`)
    const table = fb.page.locator('table.ex-table').filter({ hasText: 'Required steps' })
    const row = table.locator('tr').filter({ hasText: 'TEST ONLY Partner One' })
    await expect(row).toContainText(/[34]\/4/)
    await expect(fb.page.getByText('Toolkit requests awaiting setup')).toBeVisible()
    await axe(fb.page, '.ex-main', 'founder onboarding')
    await shots(fb.page, 'founder-onboarding-command-centre')
  })

  await test.step('[UI] Self-service password recovery: generic reply, one-time link, sessions ended, new password works', async () => {
    await clearLimits()
    const p2 = await login(browser, P2)
    const visitor = await browser.newContext(); const v = await visitor.newPage()
    await v.goto(`${origin()}/login`)
    await v.getByRole('link', { name: 'Forgot your password?' }).click()
    await v.waitForURL(/\/partner\/reset$/)
    await v.getByLabel('Email address').fill('nobody-at-all@example.invalid')
    await v.getByRole('button', { name: 'Send reset link' }).click()
    await expect(v.getByRole('status')).toContainText('If that email address belongs to an active ScaleSmiths partner account')
    await v.goto(`${origin()}/partner/reset`)
    await v.getByLabel('Email address').fill(P2)
    await v.getByRole('button', { name: 'Send reset link' }).click()
    await expect(v.getByRole('status')).toContainText('If that email address belongs to an active ScaleSmiths partner account') // identical reply
    expect(Number((await su.query('select count(*)::int n from partner_password_resets r join admin_users u on u.id=r.user_id where lower(u.email)=$1 and r.used_at is null', [P2])).rows[0].n)).toBeGreaterThan(0)
    const token = randomBytes(32).toString('base64url')
    await su.query("insert into partner_password_resets(id,user_id,token_sha256,expires_at) select gen_random_uuid(),u.id,$1,now()+interval '30 minutes' from admin_users u where lower(u.email)=$2", [digest(token), P2])
    await v.goto(`${origin()}/partner/reset#token=${token}`)
    await v.getByLabel('New password', { exact: true }).fill('TEST-ONLY-new-password-2026')
    await v.getByLabel('Confirm new password').fill('TEST-ONLY-new-password-2026')
    await shots(v, 'partner-password-reset')
    await v.getByRole('button', { name: 'Save new password' }).click()
    await expect(v.getByRole('heading', { name: 'Your password has been changed.' })).toBeVisible()
    await v.goto(`${origin()}/partner/reset#token=${token}`)
    await v.getByLabel('New password', { exact: true }).fill('TEST-ONLY-another-password')
    await v.getByLabel('Confirm new password').fill('TEST-ONLY-another-password')
    await v.getByRole('button', { name: 'Save new password' }).click()
    await expect(v.locator('.activate-error')).toContainText('invalid or has expired') // single use
    await p2.page.reload(); await expect(p2.page).toHaveURL(/\/login/) // the old session ended
    const again = await login(browser, P2, 'TEST-ONLY-new-password-2026')
    await expect(again.page.getByRole('navigation', { name: 'Partner workspace' })).toBeVisible()
    await again.context.close(); await p2.context.close(); await visitor.close()
    await su.query('update admin_users set password_hash=$1 where lower(email)=$2', [await bcrypt.hash(PASSWORD, 12), P2]) // restore the shared fixture password
  })

  await test.step('[UI] Applicant withdrawal: emailed-link proof, confirmation, invitation revoked, record kept for retention', async () => {
    await clearLimits()
    const email = `b210-applicant-${run}@example.invalid`
    const app = (await su.query("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until) values('TEST ONLY Applicant',$1,'TEST ONLY','Synthetic browser fixture','Synthetic browser fixture','test',$2,now()+interval '180 days') returning id", [email, 'under_review'])).rows[0].id
    const visitor = await browser.newContext(); const v = await visitor.newPage()
    await v.goto(`${origin()}/partner/withdraw`)
    await v.getByLabel('Email address').fill(email)
    await v.getByRole('button', { name: 'Send confirmation link' }).click()
    await expect(v.getByRole('status')).toContainText('If that email address has an open partner application')
    const token = randomBytes(32).toString('base64url')
    await su.query("insert into partner_application_withdrawals(id,application_id,token_sha256,expires_at) values(gen_random_uuid(),$1,$2,now()+interval '1 hour')", [app, digest(token)])
    await v.goto(`${origin()}/partner/withdraw#token=${token}`)
    await expect(v.getByText(/This withdraws the partner application you submitted on/)).toBeVisible()
    await shots(v, 'applicant-withdrawal')
    await v.getByRole('button', { name: 'Withdraw my application' }).click()
    await expect(v.getByRole('heading', { name: 'Your application has been withdrawn.' })).toBeVisible()
    expect((await su.query('select status, retention_until > now() kept from partner_applications where id=$1', [app])).rows[0]).toEqual({ status: 'withdrawn', kept: true })
    await v.goto(`${origin()}/partner/withdraw#token=${token}`)
    await expect(v.locator('.activate-error')).toContainText('invalid or has expired')
    const audit = (await su.query("select metadata_json from admin_security_audit where action='partner_application_withdrawn' order by id desc limit 1")).rows[0].metadata_json
    expect(audit).toMatchObject({ applicationId: app, from: 'under_review', by: 'applicant' })
    await visitor.close()
  })

  await test.step('[API] Public endpoints refuse cross-origin and oversized requests', async () => {
    const anon = await browser.newContext()
    for (const path of ['/api/partner/password-reset', '/api/partner/withdraw']) {
      expect((await anon.request.post(`${origin()}${path}`, { headers: { origin: 'https://evil.example' }, data: { action: 'request', email: P1 } })).status()).toBe(403)
      expect((await anon.request.post(`${origin()}${path}`, { headers: { origin: origin() }, data: { action: 'request', email: 'x'.repeat(9000) } })).status()).toBe(413)
      expect((await anon.request.post(`${origin()}${path}`, { headers: { origin: origin() }, data: { action: 'nonsense' } })).status()).toBe(400)
    }
    await anon.close()
  })

  await fa.context.close(); await fb.context.close(); await p1.context.close()
  expect(consoleErrors).toEqual([])
  await su.end()
})
