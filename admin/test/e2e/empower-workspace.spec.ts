import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * Operation Empower B1.6 acceptance: partner daily workflow (A), meeting preparation (B), founder response (C) and security (D),
 * on a production admin build and a disposable database only (seed with scripts/seed-empower-browser.mjs).
 * B1.7 (Project Aegis) adds: approved objection responses in unified guidance (E) and the partner's agreement state on Today (F).
 * [UI] real screens and clicks. [API] authenticated HTTP for set-up or to prove a refusal. [SQL] disposable-database fixture or check.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL, dbUrl = process.env.EMPOWER_BROWSER_DATABASE_URL, superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
test.skip(!base || !dbUrl || !superUrl, 'An explicit disposable admin server and database are required.')
const PASSWORD = 'Empower-Demo-Only-2026'
const FOUNDER_A = { email: 'empower-founder-a@example.invalid', secret: 'JBSWY3DPEHPK3PXP' }, FOUNDER_B = { email: 'empower-founder-b@example.invalid', secret: 'KRSXG5CTMVRXEZLU' }
const P1 = 'empower-partner-one@example.invalid', P2 = 'empower-partner-two@example.invalid', P3 = 'empower-partner-revoked@example.invalid'
const evidence = '../docs/expansion/empower/evidence/b1-6', evidence17 = '../docs/expansion/empower/evidence/b1-7'
const WIDTHS = [320, 390, 768, 1024, 1440]
const origin = () => {
  const a = new URL(base!), d = new URL(dbUrl!), s = new URL(superUrl!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103' || d.pathname !== '/ss_empower_browser_e2e' || s.pathname !== '/ss_empower_browser_e2e' || !['127.0.0.1', 'localhost'].includes(d.hostname)) throw new Error('Refusing to run outside the disposable stack.')
  return a.origin
}
const inMonths = (n: number) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }
async function login(browser: Browser, email: string, totpSecret?: string) {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  if (totpSecret) await page.getByLabel(/^Authenticator code/).fill(generateTotp(totpSecret))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/(partner|command-centre|dashboard)/)
  return { context, page }
}
const api = async (c: BrowserContext, path: string, data?: Record<string, unknown>) => {
  const r = data ? await c.request.post(`${origin()}${path}`, { headers: { origin: origin() }, data }) : await c.request.get(`${origin()}${path}`, { maxRedirects: 0 })
  return { status: r.status(), body: await r.json().catch(() => ({})) }
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0) }
async function axe(page: Page, scope: string, label: string) {
  const result = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = result.violations.filter((v) => ['serious', 'critical'].includes(String(v.impact)))
  expect(serious.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}
async function shots(page: Page, name: string) {
  for (const width of WIDTHS) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); await page.screenshot({ path: `${evidence}/${name}-${width}.png`, fullPage: true }) }
  await page.setViewportSize({ width: 1280, height: 900 })
}
/** Viewport captures with the subject scrolled into view at each width (the workspace scrolls an inner container, so full-page captures show only the top). */
async function shots17(page: Page, name: string, subject?: ReturnType<Page['locator']>) {
  for (const width of [320, 375, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await noOverflow(page); if (subject) await subject.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${evidence17}/${name}-${width}.png` }) }
  await page.setViewportSize({ width: 1280, height: 900 })
}
async function published(a: BrowserContext, b: BrowserContext, payload: Record<string, unknown>) {
  const created = await api(a, '/api/expansion', { action: 'create_content_item', ...payload })
  expect(created.status, JSON.stringify(created.body)).toBe(200)
  const versionId = String(created.body.result.versionId), itemId = String(created.body.result.itemId)
  expect((await api(a, '/api/expansion', { action: 'submit_content', versionId })).status).toBe(200)
  expect((await api(b, '/api/expansion', { action: 'decide_content', versionId, decision: 'approved', reference: 'TEST-API', notes: 'TEST ONLY set-up approval', reviewBy: inMonths(2) })).status).toBe(200)
  expect((await api(b, '/api/expansion', { action: 'publish_content', versionId })).status).toBe(200)
  return { itemId, versionId }
}

test('B1.6 unified partner workspace: daily workflow, meeting preparation, founder response and security', async ({ browser }) => {
  origin()
  const su = new Pool({ connectionString: superUrl, max: 1 })
  await mkdir(evidence, { recursive: true }); await mkdir(evidence17, { recursive: true })
  const run = Date.now().toString(36), tag = `zw${run}`
  const BUSINESS = `TEST ONLY Workspace Prospect ${run}`
  const errors: string[] = []
  const harnessOnly = /Failed to fetch RSC payload for http:\/\/localhost:3103\/[\s\S]*Falling back to browser navigation|net::ERR_SSL_PROTOCOL_ERROR|net::ERR_FAILED/
  try {
    await su.query('delete from login_rate_limits'); await su.query('delete from web_rate_limits')
    await su.query('update admin_users set active=true where email=$1', [P3])
    const a = await login(browser, FOUNDER_A.email, FOUNDER_A.secret), b = await login(browser, FOUNDER_B.email, FOUNDER_B.secret)
    // [API] Approved content through the two-founder path, plus a draft and a withdrawn entry that must never appear.
    await published(a.context, b.context, { kind: 'knowledge', slug: `kb-seo-${run}`, audience: 'client_facing', cadence: 'service', title: `SEO answer ${tag}`, body: '', fields: { question: `Will this help us appear on Google ${tag}?`, answer: 'Search foundations are part of every build; ongoing SEO is separate, scoped work.', client_explanation: `Every site is built with search foundations; ongoing visibility work is scoped separately ${tag}.`, limitations: 'No ranking, traffic or timeline promise.', escalation_required: 'never', topic: 'seo' }, sourceRefs: ['faq:seo-timeline'] })
    await published(a.context, b.context, { kind: 'knowledge', slug: `kb-crm-${run}`, audience: 'partner_only', cadence: 'service', title: `CRM answer ${tag}`, body: '', fields: { question: `Can you connect our CRM ${tag}?`, answer: 'Integrations need technical scoping first.', client_explanation: 'none. Partner only.', limitations: 'No integration promise.', escalation_required: 'always', escalation_route: 'technical_scoping', topic: 'crm' }, sourceRefs: ['faq:integrations'] })
    const lesson = await published(a.context, b.context, { kind: 'lesson', slug: `lesson-ws-${run}`, audience: 'partner_only', cadence: 'service', title: `Running a discovery call ${tag}`, body: 'Ask open questions and record what the business needs.', fields: { course_code: 'C05', lesson_code: 'C05-L9' }, sourceRefs: ['docs:c05'] })
    await published(a.context, b.context, { kind: 'course', slug: `course-ws-${run}`, audience: 'partner_only', cadence: 'service', title: `Discovery course ${tag}`, body: 'Discovery conversations that work.', fields: { category: 'discovery', estimated_minutes: '10', objectives: ['Run a discovery call'], modules: [{ title: 'Discovery', lessons: [lesson.itemId] }] }, sourceRefs: ['docs:c05'] })
    const draft = await api(a.context, '/api/expansion', { action: 'create_content_item', kind: 'knowledge', slug: `kb-draft-${run}`, audience: 'client_facing', cadence: 'service', title: `Draft SEO ${tag}`, body: '', fields: { question: `Draft SEO question ${tag}?`, topic: 'seo' }, sourceRefs: ['x:y'] })
    expect(draft.status).toBe(200)
    const withdrawn = await published(a.context, b.context, { kind: 'knowledge', slug: `kb-withdrawn-${run}`, audience: 'client_facing', cadence: 'service', title: `Withdrawn SEO ${tag}`, body: '', fields: { question: `Withdrawn SEO question ${tag}?`, answer: 'Old.', client_explanation: 'Old wording.', limitations: 'None.', escalation_required: 'never', topic: 'seo' }, sourceRefs: ['x:y'] })
    expect((await api(b.context, '/api/expansion', { action: 'archive_content', versionId: withdrawn.versionId, reason: 'TEST ONLY withdrawn in the browser journey' })).status).toBe(200)
    expect((await api(a.context, '/api/expansion', { action: 'set_market', countryCode: 'GB', countryName: 'United Kingdom', status: 'approved', planKeys: ['standard-v2'], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: `TEST ONLY ${run}` })).status).toBe(200)
    // [API] B1.7: an approved objection response (seo category) and a draft one that must never appear.
    const CONCERN = `We already rank on Google ${tag}`, CLIENT_LINE = `Search foundations are built into every site; ongoing visibility work is scoped separately ${tag}.`
    await published(a.context, b.context, { kind: 'objection', slug: `obj-seo-${run}`, audience: 'partner_only', cadence: 'service', title: CONCERN, body: '', fields: { category: 'seo', concern: CONCERN, client_line: CLIENT_LINE, guidance: `Internal reasoning for this objection ${tag}: explain foundations and never promise rankings.`, limitation: 'No ranking, traffic or timeline promise.', discovery_questions: ['How do customers find you today?'], escalation_required: 'never' }, sourceRefs: ['faq:seo-timeline'] })
    expect((await api(a.context, '/api/expansion', { action: 'create_content_item', kind: 'objection', slug: `obj-draft-${run}`, audience: 'partner_only', cadence: 'service', title: `Draft objection ${tag}`, body: '', fields: { category: 'seo', concern: `Draft objection ${tag}` }, sourceRefs: ['x:y'] })).status).toBe(200)
    const ledgerBefore = (await su.query("select md5(coalesce(string_agg(l::text, '|' order by l.id), '')) h from expansion_commission_ledger l")).rows[0].h

    const p1 = await login(browser, P1)
    p1.page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    // [API] Partner A's prospect, recorded through the real partner commands.
    const reg = await api(p1.context, '/api/partner', { action: 'register', country: 'GB', businessName: BUSINESS, website: `ws-${run}.example`, contactName: 'Test director' })
    expect(reg.status, JSON.stringify(reg.body)).toBe(200)
    const oppId = String(reg.body.result.id)
    expect((await api(p1.context, '/api/partner', { action: 'discovery', id: oppId, discovery: { objectives: 'More enquiries', seoConcerns: 'Not found on Google', integrations: 'Connect to our CRM' } })).status).toBe(200)

    await test.step('[UI] A1-A5 Partner sees their day and opens a prospect with contextual approved guidance', async () => {
      await p1.page.goto(`${origin()}/partner`)
      const today = p1.page.getByRole('region', { name: 'Your workspace' })
      await expect(today).toBeVisible()
      await expect(today.getByText(BUSINESS)).toBeVisible()
      await axe(p1.page, '.gd-panel', 'partner today')
      await shots(p1.page, 'partner-today')
      await today.getByRole('button', { name: `Open ${BUSINESS}` }).click()
      const panel = p1.page.getByRole('region', { name: BUSINESS }).filter({ has: p1.page.getByText('Guidance for this prospect') })
      await expect(panel.getByText('Search visibility is mentioned')).toBeVisible()
      await expect(panel.getByRole('link', { name: `Will this help us appear on Google ${tag}?` })).toBeVisible()
      await expect(panel.getByRole('link', { name: `Can you connect our CRM ${tag}?` })).toBeVisible()
      await expect(panel.getByText(`Draft SEO question ${tag}?`)).toHaveCount(0)
      await expect(panel.getByText(`Withdrawn SEO question ${tag}?`)).toHaveCount(0)
      await axe(p1.page, '.gd-panel', 'prospect guidance')
    })
    await test.step('[UI] A6-A8 Copy client-safe wording only, then open related technical guidance', async () => {
      const panel = p1.page.locator('.gd-panel').filter({ hasText: 'Guidance for this prospect' })
      const seo = panel.locator('.gd-card').filter({ hasText: `Will this help us appear on Google ${tag}?` })
      await seo.getByRole('button', { name: 'Copy' }).click()
      await expect(seo.getByText('Copied client-safe text.')).toBeVisible()
      expect(await p1.page.evaluate(() => navigator.clipboard.readText())).toBe(`Every site is built with search foundations; ongoing visibility work is scoped separately ${tag}.`)
      const crm = panel.locator('.gd-card').filter({ hasText: `Can you connect our CRM ${tag}?` })
      await expect(crm.getByRole('button', { name: 'Copy' })).toHaveCount(0)
      await expect(crm.getByText('Partner only')).toBeVisible()
      await crm.getByRole('link', { name: `Can you connect our CRM ${tag}?` }).click()
      await expect(p1.page).toHaveURL(/\/partner\/knowledge\?q=/)
      await expect(p1.page.locator('details.ac-entry').filter({ hasText: `Can you connect our CRM ${tag}?` })).toHaveCount(1)
    })
    let meetingId = ''
    await test.step('[UI] A9-A13 Partner requests founder help; it shows as requested, the prospect context returns, commission is unchanged', async () => {
      await p1.page.goto(`${origin()}/partner`)
      await p1.page.getByRole('region', { name: 'Your workspace' }).getByRole('button', { name: `Open ${BUSINESS}` }).click()
      await p1.page.locator('.gd-panel').filter({ hasText: 'Guidance for this prospect' }).getByRole('button', { name: /^Request/ }).click()
      const f = p1.page.locator('form').filter({ has: p1.page.getByRole('button', { name: 'Send request', exact: true }) })
      await f.getByLabel('What do you need?').selectOption('technical_scoping')
      await f.getByLabel('Related prospect (optional)').selectOption(oppId)
      const slot = new Date(Date.now() + 4 * 86400000); slot.setUTCHours(10, 0, 0, 0)
      await f.locator('input[type=datetime-local]').first().fill(slot.toISOString().slice(0, 16))
      await f.locator('textarea, input').filter({ hasNot: p1.page.locator('[type=datetime-local],[type=hidden]') }).last().fill(`TEST ONLY CRM integration question ${tag}`).catch(() => undefined)
      for (const req of await f.locator('input[required], textarea[required]').all()) if (!(await req.inputValue())) await req.fill(`TEST ONLY ${tag}`)
      const resp = p1.page.waitForResponse((r) => r.url().endsWith('/api/partner') && r.request().method() === 'POST')
      await f.getByRole('button', { name: 'Send request', exact: true }).click()
      expect((await resp).status()).toBe(200)
      const m = (await su.query("select m.id,m.status from expansion_meeting_requests m where m.opportunity_id=$1 order by created_at desc limit 1", [oppId])).rows[0]
      expect(m.status).toBe('requested'); meetingId = String(m.id)
      await p1.page.goto(`${origin()}/partner`)
      const today = p1.page.getByRole('region', { name: 'Your workspace' })
      await expect(today.locator('.gd-row').filter({ hasText: 'Technical scoping' }).filter({ hasText: BUSINESS }).getByText('Meeting requested')).toBeVisible()
      await today.getByRole('button', { name: `Open ${BUSINESS}` }).click()
      await expect(p1.page.locator('.gd-panel').filter({ hasText: 'Guidance for this prospect' }).locator('.gd-row').filter({ hasText: 'Technical scoping' }).getByText('Meeting requested')).toBeVisible()
      expect((await su.query("select md5(coalesce(string_agg(l::text, '|' order by l.id), '')) h from expansion_commission_ledger l")).rows[0].h).toBe(ledgerBefore)
    })
    await test.step('[UI] C1-C7 Founder sees the escalation, reviews context, confirms it; the partner sees the update; audit records it', async () => {
      await a.page.goto(`${origin()}/expansion`)
      const ops = a.page.getByRole('region', { name: /Needs your attention/ })
      await expect(ops.locator('.gd-row').filter({ hasText: BUSINESS })).toBeVisible()
      await axe(a.page, '.gd-panel', 'founder operations')
      await shots(a.page, 'founder-operations')
      const start = new Date(Date.now() + 6 * 86400000); start.setUTCHours(11, 0, 0, 0)
      // [API] The existing founder meeting command; the queue only shows where it lives.
      expect((await api(a.context, '/api/expansion', { action: 'decide_meeting', meetingId, decision: 'confirm', start: start.toISOString(), note: 'TEST ONLY confirmed in the browser journey' })).status).toBe(200)
      const audit = (await su.query("select count(*)::int n from expansion_audit where entity_id=$1", [meetingId])).rows[0].n
      expect(audit).toBeGreaterThanOrEqual(2)
    })
    await test.step('[UI] B1-B8 Partner prepares for the confirmed meeting with scope and approved material', async () => {
      await p1.page.goto(`${origin()}/partner`)
      await p1.page.getByRole('region', { name: 'Your workspace' }).getByRole('button', { name: 'Prepare for a meeting' }).click()
      const meeting = p1.page.locator('details.ex-resource').filter({ hasText: BUSINESS }).first()
      if (!(await meeting.evaluate((el) => (el as HTMLDetailsElement).open))) await meeting.locator('summary').click()
      await meeting.getByRole('button', { name: 'Prepare for this meeting' }).click()
      const prep = meeting.getByLabel('Meeting preparation')
      await expect(prep.getByText('Meeting confirmed')).toBeVisible()
      await expect(prep.getByText('Not found on Google')).toBeVisible()
      await expect(prep.getByRole('link', { name: `Can you connect our CRM ${tag}?` })).toBeVisible()
      await expect(prep.getByText(`Withdrawn SEO question ${tag}?`)).toHaveCount(0)
      await axe(p1.page, '.ex-main', 'meeting preparation')
      await shots(p1.page, 'meeting-preparation')
      await prep.getByRole('link', { name: `Discovery course ${tag}` }).click()
      await expect(p1.page).toHaveURL(new RegExp(`/partner/academy/course-ws-${run}`))
      expect((await su.query("select status from expansion_meeting_requests where id=$1", [meetingId])).rows[0].status).toBe('confirmed')
    })
    await test.step('[UI] Unified search across answers, resources and learning', async () => {
      await p1.page.goto(`${origin()}/partner/guidance`)
      await p1.page.getByLabel('Search approved guidance').fill(`appear on Google ${tag}`)
      await p1.page.getByRole('button', { name: 'Search', exact: true }).click()
      await expect(p1.page.locator('.gd-card').first()).toContainText(`Will this help us appear on Google ${tag}?`)
      await expect(p1.page.getByText(`Withdrawn SEO question ${tag}?`)).toHaveCount(0)
      await axe(p1.page, '.academy', 'guidance search')
      await shots(p1.page, 'guidance-search')
    })
    await test.step('[UI] E1-E6 B1.7: an approved objection response is found, labelled, copied as its client line only, and opens the objection workspace', async () => {
      await p1.page.goto(`${origin()}/partner/guidance`)
      await p1.page.getByLabel('Search approved guidance').fill(CONCERN)
      await p1.page.getByRole('button', { name: 'Search', exact: true }).click()
      const card = p1.page.locator('.gd-card').first()
      await expect(card).toContainText(CONCERN)
      await expect(card.getByText('Objection response', { exact: true })).toBeVisible()
      await expect(card.getByText('SEO', { exact: true })).toBeVisible()
      await expect(card.getByText('Partner only', { exact: true })).toBeVisible()
      await expect(card.getByText('Partner explanation, not for clients:')).toBeVisible()
      await card.getByRole('button', { name: 'Copy' }).click()
      await expect(card.getByText('Copied client-safe text.')).toBeVisible()
      expect(await p1.page.evaluate(() => navigator.clipboard.readText())).toBe(CLIENT_LINE)
      await expect(p1.page.getByText(`Draft objection ${tag}`)).toHaveCount(0)
      await p1.page.getByRole('button', { name: 'Objection responses' }).click()
      await expect(p1.page.locator('.gd-card .gd-type').first()).toHaveText('Objection response')
      await axe(p1.page, '.academy', 'guidance search with objections')
      await shots17(p1.page, 'guidance-objection', card)
      await card.getByRole('link', { name: CONCERN }).click()
      await expect(p1.page).toHaveURL(/\/partner\/objections\?q=/)
      await expect(p1.page.locator('details.ac-objection').filter({ hasText: CONCERN })).toHaveCount(1)
      // The prospect's recorded search concern brings the same response into its contextual guidance.
      await p1.page.goto(`${origin()}/partner`)
      await expect(p1.page.getByRole('region', { name: 'Your workspace' }).getByRole('link', { name: 'Handle an objection' })).toHaveAttribute('href', '/partner/objections')
      // Every switched-on module is reachable from the partner sidebar, not only from its siblings' navigation.
      await expect(p1.page.locator('aside.ex-sidebar').getByRole('link', { name: /Objection handling/ })).toHaveAttribute('href', '/partner/objections')
      await expect(p1.page.locator('aside.ex-sidebar').getByRole('link', { name: /Find guidance/ })).toHaveAttribute('href', '/partner/guidance')
      await p1.page.getByRole('region', { name: 'Your workspace' }).getByRole('button', { name: `Open ${BUSINESS}` }).click()
      await expect(p1.page.locator('.gd-panel').filter({ hasText: 'Guidance for this prospect' }).getByRole('link', { name: CONCERN })).toBeVisible()
    })
    await test.step('[UI] F1-F7 B1.7: Today shows the partner\'s own agreement state from real records and routes acceptance to the existing agreement page', async () => {
      // P1 holds whatever the seed gave it; its label must match its own records.
      const p1rec = (await su.query('select p.agreement_content_version_id issued from expansion_partners p join admin_users u on u.id=p.user_id where u.email=$1', [P1])).rows[0]
      await p1.page.goto(`${origin()}/partner`)
      const block1 = p1.page.getByRole('region', { name: 'Your workspace' }).locator('.gd-agreement')
      if (!p1rec.issued) await expect(block1.getByText('No agreement issued', { exact: true })).toBeVisible()
      // [API] Founders publish a per-run agreement and issue it to partner two through the existing reissue command.
      const agr = await published(a.context, b.context, { kind: 'agreement', slug: `agreement-ws-${run}`, audience: 'partner_only', cadence: 'commercial', title: `TEST ONLY Workspace Agreement ${run}`, body: `TEST ONLY agreement text for the browser journey (${run}). It is not a real agreement and binds nobody. `.repeat(3), fields: {}, sourceRefs: ['legal:test-only-review'] })
      const p2rec = (await su.query('select p.id, p.agreement_acceptance_id from expansion_partners p join admin_users u on u.id=p.user_id where u.email=$1', [P2])).rows[0]
      expect((await api(a.context, '/api/expansion', { action: 'reissue_agreement', id: String(p2rec.id), agreementVersionId: agr.versionId })).status).toBe(200)
      // Disposable database only: reset the sign-in limiter (5 per IP per 10 minutes) as at the start, since this journey signs in six identities.
      await su.query('delete from login_rate_limits')
      const p2 = await login(browser, P2)
      await p2.page.goto(`${origin()}/partner`)
      const block = p2.page.getByRole('region', { name: 'Your workspace' }).locator('.gd-agreement')
      await expect(block.getByText(p2rec.agreement_acceptance_id ? 'Updated agreement to accept' : 'Awaiting your acceptance', { exact: true })).toBeVisible()
      await expect(block).toContainText(`TEST ONLY Workspace Agreement ${run}`)
      await axe(p2.page, '.gd-panel', 'partner today agreement awaiting')
      // Regression (found by screenshot, missed by axe): the link-styled button keeps dark text on its gold fill.
      expect(await block.getByRole('link', { name: /^Read and accept/ }).evaluate((el) => getComputedStyle(el).color)).toBe('rgb(22, 22, 22)')
      await shots17(p2.page, 'partner-today-agreement-awaiting', block)
      await block.getByRole('link', { name: /^Read and accept/ }).click()
      await expect(p2.page).toHaveURL(/\/partner\/agreement$/)
      // [API] Acceptance goes through the existing agreement route; the database fixes version, digest and time.
      const sha256 = (await su.query('select partner_agreement_digest(title, body) d from empower_content_versions where id=$1', [agr.versionId])).rows[0].d
      expect((await api(p2.context, '/api/partner/agreement', { accepted: true, versionId: agr.versionId, sha256, signatoryName: 'Test Only Partner Two' })).status).toBe(200)
      await p2.page.goto(`${origin()}/partner`)
      await expect(p2.page.getByRole('region', { name: 'Your workspace' }).locator('.gd-agreement').getByText('Accepted and current', { exact: true })).toBeVisible()
      // Nothing is due, so Today offers no second agreement action (the partner journey's agreement step remains the one route).
      await expect(p2.page.getByRole('region', { name: 'Your workspace' }).locator('.gd-agreement').getByRole('link')).toHaveCount(0)
      await shots17(p2.page, 'partner-today-agreement-accepted', p2.page.locator('.gd-agreement'))
      // Partner one never sees partner two's agreement, in the page or the API.
      expect(JSON.stringify((await api(p1.context, '/api/partner/workspace?view=today')).body)).not.toContain(`Workspace Agreement ${run}`)
      await p1.page.goto(`${origin()}/partner`)
      await expect(p1.page.getByText(`TEST ONLY Workspace Agreement ${run}`)).toHaveCount(0)
      expect((await su.query("select md5(coalesce(string_agg(l::text, '|' order by l.id), '')) h from expansion_commission_ledger l")).rows[0].h).toBe(ledgerBefore)
      await p2.context.close()
    })
    await test.step('[API] D1-D10 Isolation and refusals', async () => {
      const p2 = await login(browser, P2)
      expect((await api(p2.context, `/api/partner/workspace?opportunity=${oppId}`)).status).toBe(404)
      expect((await api(p2.context, `/api/partner/workspace?meeting=${meetingId}`)).status).toBe(404)
      const p2day = await api(p2.context, '/api/partner/workspace?view=today')
      expect(JSON.stringify(p2day.body)).not.toContain(BUSINESS)
      const p3 = await login(browser, P3)
      await su.query("update admin_users set active=false, session_version=session_version+1 where email=$1", [P3])
      expect((await api(p3.context, '/api/partner/workspace?view=today')).status).toBeGreaterThanOrEqual(401)
      await su.query("update admin_users set active=true where email=$1", [P3])
      const search = await api(p2.context, `/api/partner/workspace?q=${encodeURIComponent(`SEO ${tag}`)}`)
      const titles = (search.body.results as { title: string; copy: string | null; audience: string }[]).map((r) => r.title)
      expect(titles).not.toContain(`Draft SEO question ${tag}?`); expect(titles).not.toContain(`Withdrawn SEO question ${tag}?`)
      // Copy is offered only for client-facing items, or as the founder-approved client line of a (partner-only) objection response.
      for (const r of search.body.results as { type: string; copy: string | null; audience: string; summary: string }[]) {
        if (r.type === 'objection') { expect(r.audience).toBe('partner_only'); if (r.copy) expect(r.summary).not.toContain(r.copy) }
        else if (r.audience !== 'client_facing') expect(r.copy).toBeNull()
      }
      expect((await api(p2.context, '/api/expansion')).status).toBe(403)
      const anon = await browser.newContext(); const s = (await anon.request.get(`${origin()}/api/partner/workspace?view=today`, { maxRedirects: 0 })).status()
      expect(s === 200 || s >= 500, `anonymous ${s}`).toBe(false); await anon.close()
      // Learning progress has no commercial effect: the ledger is unchanged after every step above.
      expect((await su.query("select md5(coalesce(string_agg(l::text, '|' order by l.id), '')) h from expansion_commission_ledger l")).rows[0].h).toBe(ledgerBefore)
      await p2.context.close(); await p3.context.close()
    })
    expect(errors.filter((e) => !harnessOnly.test(e))).toEqual([])
    await Promise.all([a.context.close(), b.context.close(), p1.context.close()])
  } finally { await su.end() }
})
