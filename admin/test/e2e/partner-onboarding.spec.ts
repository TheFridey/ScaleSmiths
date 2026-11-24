import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * Operation Launch Ready browser acceptance: founder recruitment, agreement issue, applicant activation with explicit acceptance,
 * the partner's agreement page and first-login steps, and refusals. Production admin build, disposable database, synthetic
 * identities only (seed with scripts/seed-empower-browser.mjs). Partner email is off, so nothing is sent.
 * [UI] real screens and clicks. [API] authenticated HTTP for set-up or to prove a refusal. [SQL] disposable-database fixture.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL, dbUrl = process.env.EMPOWER_BROWSER_DATABASE_URL, superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
test.skip(!base || !dbUrl || !superUrl, 'An explicit disposable admin server and database are required.')
const PASSWORD = 'Empower-Demo-Only-2026'
const FOUNDER_A = { email: 'empower-founder-a@example.invalid', secret: 'JBSWY3DPEHPK3PXP' }, FOUNDER_B = { email: 'empower-founder-b@example.invalid', secret: 'KRSXG5CTMVRXEZLU' }
const evidence = '../docs/launch-ready/evidence'
const WIDTHS = [390, 768, 1024, 1440]
const origin = () => {
  const a = new URL(base!), d = new URL(dbUrl!), s = new URL(superUrl!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103' || d.pathname !== '/ss_empower_browser_e2e' || s.pathname !== '/ss_empower_browser_e2e' || !['127.0.0.1', 'localhost'].includes(d.hostname)) throw new Error('Refusing to run outside the disposable stack.')
  return a.origin
}
const inMonths = (n: number) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }
async function login(browser: Browser, email: string, password = PASSWORD, totpSecret?: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  if (totpSecret) await page.getByLabel(/^Authenticator code/).fill(generateTotp(totpSecret))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/(partner|command-centre|dashboard)/)
  return { context, page }
}
const api = async (c: BrowserContext, path: string, data?: Record<string, unknown>) => {
  const r = data ? await c.request.post(`${origin()}${path}`, { headers: { origin: origin() }, data }) : await c.request.get(`${origin()}${path}`)
  return { status: r.status(), body: await r.json().catch(() => ({})) }
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0) }
async function axe(page: Page, scope: string, label: string) {
  const result = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = result.violations.filter((v) => ['serious', 'critical'].includes(String(v.impact)))
  expect(serious.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}
async function shots(page: Page, name: string) {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 }); await noOverflow(page)
    await page.screenshot({ path: `${evidence}/${name}-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 1280, height: 900 })
}

test('Operation Launch Ready: recruitment, agreement acceptance and partner onboarding in a real browser', async ({ browser }) => {
  origin()
  const su = new Pool({ connectionString: superUrl, max: 1 })
  await mkdir(evidence, { recursive: true })
  const run = Date.now().toString(36)
  const applicantEmail = `launch-applicant-${run}@example.invalid`, applicantName = `TEST ONLY Applicant ${run}`
  const consoleErrors: string[] = []
  try {
    await su.query('delete from login_rate_limits'); await su.query('delete from web_rate_limits')
    // [SQL] A synthetic application, as the public form would create it.
    const app = await su.query<{ id: number }>("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until) values($1,$2,'TEST ONLY region','Synthetic browser experience text','Synthetic browser motivation text','test-reviewed-v1','submitted',now()+interval '30 days') returning id", [applicantName, applicantEmail])
    const appId = app.rows[0].id

    // Founder A drafts an agreement [API]; founder B approves and publishes it [API]. The studio UI is covered by the B1 journeys.
    const a = await login(browser, FOUNDER_A.email, PASSWORD, FOUNDER_A.secret)
    a.page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`founder: ${m.text()}`) })
    // [API] The launch market, approved through the founder command so the market gate is exercised as in production.
    expect((await api(a.context, '/api/expansion', { action: 'set_market', countryCode: 'GB', countryName: 'United Kingdom', status: 'approved', planKeys: ['standard-v2'], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: `TEST ONLY browser ${run}` })).status).toBe(200)
    const body = `## 1. About this agreement\n\nTEST ONLY partner agreement for browser acceptance (${run}). It is not a real agreement and binds nobody.\n\n## 2. Your role\n\n1. You introduce businesses to ScaleSmiths.\n2. You act independently.\n\n## 3. Ending this agreement\n\nTEST ONLY text. `.repeat(2)
    const created = await api(a.context, '/api/expansion', { action: 'create_content_item', kind: 'agreement', slug: `launch-agreement-${run}`, audience: 'partner_only', cadence: 'commercial', title: `TEST ONLY Independent Partner Agreement ${run}`, body, sourceRefs: ['legal:test-only-browser-review'] })
    expect(created.status, JSON.stringify(created.body)).toBe(200)
    const versionId = String(created.body.result.versionId)
    expect((await api(a.context, '/api/expansion', { action: 'submit_content', versionId })).status).toBe(200)
    const b = await login(browser, FOUNDER_B.email, PASSWORD, FOUNDER_B.secret)
    expect((await api(b.context, '/api/expansion', { action: 'decide_content', versionId, decision: 'approved', reference: 'TEST-ONLY-FD-LAUNCH', notes: 'TEST ONLY: browser acceptance agreement.', reviewBy: inMonths(2) })).status).toBe(200)
    expect((await api(b.context, '/api/expansion', { action: 'publish_content', versionId })).status).toBe(200)

    // [UI] Founder recruitment: filter, search, open the applicant, and record a review that needs a second, explicit press.
    await a.page.goto(`${origin()}/expansion`)
    await a.page.getByRole('button', { name: 'Recruitment', exact: true }).click()
    await expect(a.page.getByRole('heading', { name: 'Partner applications' })).toBeVisible()
    await a.page.getByLabel('Search name, email, region or industry').fill(run)
    await expect(a.page.getByRole('status').filter({ hasText: /^1 of \d+ shown$/ })).toBeVisible()
    const card = a.page.locator('details.ex-applicant').filter({ hasText: applicantName })
    await card.locator('summary').click()
    await expect(card.locator('summary .ex-pill')).toHaveText('Application received')
    const reviewForm = card.locator('form').filter({ has: a.page.getByRole('button', { name: 'Record founder review' }) })
    await reviewForm.locator('select[name=status]').selectOption('under_review')
    await reviewForm.getByLabel('Internal review notes (never shown to the applicant)').fill('TEST ONLY: application read in the browser journey.')
    await reviewForm.getByRole('button', { name: 'Record founder review' }).click()
    const confirmBox = reviewForm.getByRole('alertdialog')
    await expect(confirmBox).toContainText('audited with your name')
    await axe(a.page, '.ex-applicant', 'review confirmation')
    const saved = a.page.waitForResponse((r) => r.url().endsWith('/api/expansion') && r.request().method() === 'POST')
    await confirmBox.getByRole('button', { name: /^Confirm: Record founder review/ }).click()
    expect((await saved).status()).toBe(200)
    await expect(reviewForm.getByText('Change recorded.')).toBeVisible()
    // [API] An illegal jump is refused with a clear message.
    const jump = await api(a.context, '/api/expansion', { action: 'review_application', id: appId, status: 'onboarding', notes: 'TEST ONLY', legal: true, agreement: true, independentStatus: true, operations: true })
    expect(jump.status).toBe(409); expect(String(jump.body.error)).toMatch(/cannot move from "Under review" to "Ready to invite"/)
    for (const status of ['assessment_in_progress', 'approved_in_principle', 'agreement_pending']) expect((await api(a.context, '/api/expansion', { action: 'review_application', id: appId, status, notes: 'TEST ONLY' })).status).toBe(200)
    expect((await api(a.context, '/api/expansion', { action: 'review_application', id: appId, status: 'onboarding', notes: 'TEST ONLY', legal: true, agreement: true, independentStatus: true, operations: true })).status).toBe(200)

    // [UI] Invitation: the founder must choose a published agreement; the secret link is shown once.
    await a.page.reload(); await a.page.getByRole('button', { name: 'Recruitment', exact: true }).click()
    await a.page.getByLabel('Search name, email, region or industry').fill(run)
    const ready = a.page.locator('details.ex-applicant').filter({ hasText: applicantName })
    await ready.locator('summary').click()
    await expect(ready.locator('summary .ex-pill')).toHaveText('Ready to invite')
    await expect(ready.locator('.ex-steps li[data-done=true]')).toHaveCount(4)
    const inviteForm = ready.locator('form').filter({ has: a.page.getByRole('button', { name: 'Issue single-use invitation' }) })
    await inviteForm.getByLabel('Agreement version to issue').selectOption(versionId)
    await inviteForm.getByLabel('Partner operating market, two-letter code (must be an approved market)').fill('GB')
    await inviteForm.getByRole('button', { name: 'Issue single-use invitation' }).click()
    await inviteForm.getByRole('button', { name: /^Confirm: Issue single-use invitation/ }).click()
    const link = await a.page.getByLabel('Single-use invitation link').inputValue()
    expect(link).toMatch(/\/partner\/activate#token=[A-Za-z0-9_-]{43}$/)
    await shots(a.page, 'founder-recruitment')
    await axe(a.page, '.ex-main', 'founder recruitment')

    // [UI] Applicant: welcome, read the full agreement (acceptance unlocks only at the end), accept with name, set password.
    const visitor = await browser.newContext()
    const ap = await visitor.newPage()
    ap.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`applicant: ${m.text()}`) })
    await ap.goto(link)
    await expect(ap.getByRole('heading', { name: 'Welcome to ScaleSmiths.' })).toBeVisible()
    await axe(ap, '.activate', 'activation welcome')
    await shots(ap, 'activation-welcome')
    await ap.getByRole('button', { name: 'Read the partner agreement' }).click()
    await expect(ap.getByRole('heading', { name: `TEST ONLY Independent Partner Agreement ${run}` })).toBeVisible()
    await expect(ap.getByLabel('Your full legal name')).toBeDisabled()
    await shots(ap, 'activation-agreement')
    await axe(ap, '.activate', 'activation agreement')
    await ap.getByRole('region', { name: 'Agreement text' }).evaluate((el) => { el.scrollTop = el.scrollHeight })
    await expect(ap.getByLabel('Your full legal name')).toBeEnabled()
    await ap.getByLabel('Your full legal name').fill(applicantName)
    await ap.getByLabel('New password').fill('Launch-Ready-Test-2026')
    await ap.getByLabel('Confirm password').fill('Launch-Ready-Test-2026')
    // Without the tick the browser refuses to submit; nothing is sent.
    await ap.getByRole('button', { name: 'Accept and activate my account' }).click()
    await expect(ap.getByRole('heading', { name: 'Your partner account is active.' })).toHaveCount(0)
    await ap.getByLabel('I have read this agreement in full and I accept it.').check()
    await ap.getByRole('button', { name: 'Accept and activate my account' }).click()
    await expect(ap.getByRole('heading', { name: 'Your partner account is active.' })).toBeVisible()
    expect(ap.url()).not.toContain('token=')
    // [SQL] The record holds the version, digest and server time; the application is activated.
    const record = (await su.query("select a.agreement_version, a.method, a.content_sha256 = partner_agreement_digest(v.title, v.body) intact, p2.status from partner_agreement_acceptances a join empower_content_versions v on v.id = a.content_version_id join expansion_partners p on p.id = a.partner_id join partner_applications p2 on p2.id = p.application_id where p.application_id = $1", [appId])).rows
    expect(record).toEqual([{ agreement_version: 1, method: 'activation', intact: true, status: 'activated' }])
    // [UI] Replay of the used link fails without revealing anything.
    const replay = await visitor.newPage(); await replay.goto(link)
    await replay.getByRole('button', { name: 'Read the partner agreement' }).click()
    await expect(replay.locator('.activate-error')).toContainText('Invitation is invalid or unavailable.')
    await visitor.close()

    // [UI] The new partner: first-login steps, agreement page and download; founder-only pages refused.
    const partner = await login(browser, applicantEmail, 'Launch-Ready-Test-2026')
    partner.page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`partner: ${m.text()}`) })
    await partner.page.goto(`${origin()}/partner`)
    // B2.10: the overview summarises the persisted partner journey; agreement acceptance is derived from the acceptance record.
    await expect(partner.page.locator('section.jr-summary')).toContainText('1 of 4 steps complete')
    await shots(partner.page, 'partner-first-login')
    await partner.page.getByRole('navigation', { name: 'Partner workspace' }).getByRole('button', { name: 'Getting started', exact: true }).click()
    await expect(partner.page.locator('.jr-steps li[data-done=true]').first()).toContainText('Partner agreement accepted')
    await partner.page.getByRole('link', { name: 'View agreement' }).click()
    await expect(partner.page.getByRole('heading', { name: 'Partner agreement', level: 1 })).toBeVisible()
    await expect(partner.page.getByText(`as ${applicantName}`)).toBeVisible()
    await axe(partner.page, '.academy', 'partner agreement')
    await shots(partner.page, 'partner-agreement')
    const download = partner.page.waitForEvent('download')
    await partner.page.getByRole('link', { name: 'Download what you accepted' }).click()
    expect((await download).suggestedFilename()).toBe(`scalesmiths-launch-agreement-${run}-v1.txt`)
    expect((await api(partner.context, '/api/expansion')).status).toBe(403)
    expect((await api(partner.context, `/api/expansion/agreements/${record.length ? (await su.query('select id from partner_agreement_acceptances order by accepted_at desc limit 1')).rows[0].id : 'x'}`)).status).toBe(403)
    await partner.page.goto(`${origin()}/expansion`)
    await expect(partner.page).not.toHaveURL(/\/expansion$/)

    // [UI] An unauthenticated visitor is sent to sign in.
    const anon = await browser.newContext(); const anonPage = await anon.newPage()
    await anonPage.goto(`${origin()}/partner/agreement`)
    await expect(anonPage).toHaveURL(/\/login/)
    await anon.close()

    // The production build sends upgrade-insecure-requests and HSTS. On this plain-HTTP loopback stack Chrome therefore upgrades
    // background RSC prefetches to HTTPS and they fail (ERR_SSL_PROTOCOL_ERROR / ERR_FAILED, "Falling back to browser navigation").
    // That cannot happen on the HTTPS production origin, so exactly those messages are excluded; every other console error fails.
    const harnessOnly = /Failed to fetch RSC payload for http:\/\/localhost:3103\/[\s\S]*Falling back to browser navigation|net::ERR_SSL_PROTOCOL_ERROR|net::ERR_FAILED/
    expect(consoleErrors.filter((e) => !harnessOnly.test(e) && !/favicon|Download the React DevTools/.test(e))).toEqual([])
    await Promise.all([a.context.close(), b.context.close(), partner.context.close()])
  } finally { await su.end() }
})
