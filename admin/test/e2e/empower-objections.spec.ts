import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * Operation Empower B1.5 acceptance on a production admin build and a disposable database only (seed with
 * scripts/seed-empower-browser.mjs). [UI] real screens and clicks. [API] authenticated HTTP for set-up or to prove a refusal.
 * [SQL] disposable-database fixture or check. Everything is synthetic; nothing is sent, deployed or published outside this stack.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL, dbUrl = process.env.EMPOWER_BROWSER_DATABASE_URL, superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
test.skip(!base || !dbUrl || !superUrl, 'An explicit disposable admin server and database are required.')
const PASSWORD = 'Empower-Demo-Only-2026'
const FOUNDER_A = { email: 'empower-founder-a@example.invalid', secret: 'JBSWY3DPEHPK3PXP' }, FOUNDER_B = { email: 'empower-founder-b@example.invalid', secret: 'KRSXG5CTMVRXEZLU' }
const P1 = 'empower-partner-one@example.invalid', P2 = 'empower-partner-two@example.invalid', P3 = 'empower-partner-revoked@example.invalid'
const evidence = '../docs/expansion/empower/evidence/b1-5'
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
  const r = data ? await c.request.post(`${origin()}${path}`, { headers: { origin: origin() }, data }) : await c.request.get(`${origin()}${path}`)
  return { status: r.status(), body: await r.json().catch(() => ({})) }
}
async function studio(page: Page) {
  await page.goto(`${origin()}/expansion`)
  await page.getByRole('button', { name: 'Content', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Content studio' })).toBeVisible()
}
const item = (page: Page, slug: string) => page.locator('details.ex-resource').filter({ has: page.locator('summary', { hasText: slug }) })
async function openItem(page: Page, slug: string) {
  const card = item(page, slug)
  await expect(card).toHaveCount(1)
  if (!(await card.evaluate((el) => (el as HTMLDetailsElement).open))) await card.locator('summary').first().click()
  return card
}
const form = (scope: Locator, button: string) => scope.locator('form').filter({ has: scope.page().getByRole('button', { name: button, exact: true }) })
async function submitForm(f: Locator, button: string) {
  const response = f.page().waitForResponse((r) => r.url().endsWith('/api/expansion') && r.request().method() === 'POST', { timeout: 30000 })
  await f.getByRole('button', { name: button, exact: true }).click()
  const r = await response
  expect(r.status(), await r.text()).toBe(200)
  await f.page().waitForResponse((x) => x.url().endsWith('/api/expansion') && x.request().method() === 'GET', { timeout: 15000 }).catch(() => undefined)
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0) }
async function axe(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).include('.academy').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = result.violations.filter((v) => ['serious', 'critical'].includes(String(v.impact)))
  expect(serious.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}
/** [API] Set-up content published by the normal two-founder path. */
async function published(a: BrowserContext, b: BrowserContext, payload: Record<string, unknown>) {
  const created = await api(a, '/api/expansion', { action: 'create_content_item', ...payload })
  expect(created.status, JSON.stringify(created.body)).toBe(200)
  const versionId = String(created.body.result.versionId), itemId = String(created.body.result.itemId)
  expect((await api(a, '/api/expansion', { action: 'submit_content', versionId })).status).toBe(200)
  expect((await api(b, '/api/expansion', { action: 'decide_content', versionId, decision: 'approved', reference: 'TEST-API', notes: 'TEST ONLY set-up approval', reviewBy: inMonths(2) })).status).toBe(200)
  expect((await api(b, '/api/expansion', { action: 'publish_content', versionId })).status).toBe(200)
  return { itemId, versionId }
}

test('B1.5 objection handling: founder governance and the partner workspace in a real browser', async ({ browser }) => {
  origin()
  const su = new Pool({ connectionString: superUrl, max: 1 })
  await mkdir(evidence, { recursive: true })
  const run = Date.now().toString(36), tag = `zz${run}`
  const SLUG = `objection-browser-${run}`, CONCERN = `It is too expensive ${tag}`
  const CLIENT_LINE = `A proposal lists exactly what is included, and the work can be phased ${tag}.`
  try {
    await su.query('delete from login_rate_limits'); await su.query('delete from web_rate_limits')
    await su.query('update admin_users set active=true where email=$1', [P3])
    const a = await login(browser, FOUNDER_A.email, FOUNDER_A.secret)
    const b = await login(browser, FOUNDER_B.email, FOUNDER_B.secret)
    // [API] Related material through the normal two-founder path: a resource, a Knowledge Base answer, and a lesson in a course.
    const resource = await published(a.context, b.context, { kind: 'resource', slug: `res-obj-${run}`, audience: 'client_facing', cadence: 'service', title: `Pricing explained ${tag}`, body: 'A proposal lists what is included and how the work is phased.', fields: { summary: 'How proposals and phasing work', category: 'guide' }, sourceRefs: ['faq:pricing'] })
    const kb = await published(a.context, b.context, { kind: 'knowledge', slug: `kb-obj-${run}`, audience: 'client_facing', cadence: 'service', title: `Can the work be phased ${tag}?`, body: '', fields: { question: `Can the work be phased ${tag}?`, answer: 'Yes, scope can be split into phases in the proposal.', client_explanation: 'Work can be phased.', limitations: 'No price or timeline.', escalation_required: 'never', topic: 'client-onboarding' }, sourceRefs: ['faq:pricing'] })
    const lesson = await published(a.context, b.context, { kind: 'lesson', slug: `lesson-obj-${run}`, audience: 'partner_only', cadence: 'service', title: `Handling price objections ${tag}`, body: 'Acknowledge, clarify, answer, confirm. Never resolve an objection with a discount.', fields: { course_code: 'C09', lesson_code: 'C09-L9' }, sourceRefs: ['docs:r08'] })
    await published(a.context, b.context, { kind: 'course', slug: `course-obj-${run}`, audience: 'partner_only', cadence: 'service', title: `Objections course ${tag}`, body: 'Handling objections honestly.', fields: { category: 'sales-fundamentals', estimated_minutes: '10', objectives: ['Answer price objections honestly'], modules: [{ title: 'Price', lessons: [lesson.itemId] }] }, sourceRefs: ['docs:r08'] })

    await test.step('[UI] 1-2 Founder A drafts an objection in Content studio and submits it', async () => {
      await studio(a.page)
      await a.page.locator('details').filter({ has: a.page.locator('summary', { hasText: 'New content item' }) }).locator('summary').click()
      await a.page.getByLabel('Content type').selectOption('objection')
      const f = form(a.page.locator('section.ex-panel'), 'Create draft')
      await f.getByLabel('Slug (lowercase letters, numbers and hyphens; permanent)').fill(SLUG)
      await f.getByLabel('Audience (permanent)').selectOption('partner_only')
      await f.getByLabel('Review cadence').selectOption('commercial')
      await f.getByLabel('Title', { exact: true }).fill(CONCERN)
      await f.getByLabel(/^Sources, one per line/).fill('docs/expansion/empower/resources/R08-objection-handling-playbook.md#ap-obj-01')
      await f.getByLabel('Category').selectOption('price')
      await f.getByLabel('Customer concern, as the client says it').fill(CONCERN)
      await f.getByLabel('Other ways clients say it, one per line').fill(`that is a lot of money ${tag}`)
      await f.getByLabel(/^Recommended response: client-facing words/).fill(CLIENT_LINE)
      await f.getByLabel('Why this response is appropriate (partner only)').fill('Explain the starting-price boundary and phasing; never resolve price with a concession.')
      await f.getByLabel('Discovery questions, one per line').fill('Compared with what?\nFor what scope?')
      await f.getByLabel('Limitation: what the partner must not promise').fill('No discount, payment plan or special price may be offered or hinted at.')
      await f.locator('select[name=f_escalation_required]').selectOption('when')
      await f.getByLabel('Escalate when (required if conditional)').fill('the client asks for a specific discount or payment plan')
      await f.getByLabel('Escalation meeting type').selectOption('commercial_assistance')
      for (const id of [resource.itemId, kb.itemId, lesson.itemId]) await f.getByLabel('Add a related item').selectOption(id)
      await submitForm(f, 'Create draft')
      const card = await openItem(a.page, SLUG)
      await submitForm(form(card, 'Submit for review'), 'Submit for review')
    })
    const version = (await su.query("select v.id from empower_content_versions v join empower_content_items i on i.id=v.item_id where i.slug=$1", [SLUG])).rows[0].id as string

    await test.step('[UI] 3 Founder A cannot approve their own submission while Founder B is active', async () => {
      const card = await openItem(a.page, SLUG)
      await expect(card.getByText('You wrote this version, so another founder must record the decision.')).toBeVisible()
      expect((await api(a.context, '/api/expansion', { action: 'decide_content', versionId: version, decision: 'approved', reference: 'TEST', notes: 'Self approval attempt', reviewBy: inMonths(2) })).status).toBe(403)
    })
    await test.step('[UI] 4-5 Founder B approves and publishes', async () => {
      await studio(b.page)
      const card = await openItem(b.page, SLUG)
      const f = form(card, 'Record decision')
      await f.locator('select[name=decision]').selectOption('approved')
      await f.getByLabel('Decision reference (for example a founder decision ID)').fill('TEST-ONLY-FD-B15')
      await f.getByLabel('What you checked, and why').fill('TEST ONLY: response checked against R08 and the pricing reference.')
      await f.getByLabel(/^Review by/).fill(inMonths(2))
      await submitForm(f, 'Record decision')
      const pub = await openItem(b.page, SLUG)
      const response = b.page.waitForResponse((r) => r.url().endsWith('/api/expansion') && r.request().method() === 'POST')
      await pub.getByRole('button', { name: /^Publish/ }).click()
      expect((await response).status()).toBe(200)
    })

    const p1 = await login(browser, P1)
    const consoleErrors: string[] = []
    p1.page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
    await test.step('[UI] 6-10 Partner opens Objection handling, searches and opens the response', async () => {
      await p1.page.goto(`${origin()}/partner/academy`)
      await p1.page.getByRole('link', { name: 'Objection handling' }).click()
      await expect(p1.page.getByRole('heading', { name: 'What did the client say?' })).toBeVisible()
      await expect(p1.page.getByRole('group', { name: 'Filter by category' }).getByRole('button', { name: /Price/ })).toBeVisible()
      await p1.page.getByLabel('Search approved responses').fill(`that is a lot of money ${tag}`)
      await p1.page.getByRole('button', { name: 'Search', exact: true }).click()
      const card = p1.page.locator(`details[data-objection="${SLUG}"]`)
      await expect(card).toHaveCount(1)
      await expect(card).toHaveAttribute('open', '')
      await expect(card.getByText(CLIENT_LINE)).toBeVisible()
      await expect(card.getByText('Compared with what?')).toBeVisible()
      await expect(card.getByText('Partner only: do not read out or send to the client')).toBeVisible()
      await axe(p1.page, 'objection search')
      for (const width of WIDTHS) { await p1.page.setViewportSize({ width, height: 900 }); await noOverflow(p1.page); await p1.page.screenshot({ path: `${evidence}/objection-result-${width}.png`, fullPage: true }) }
      await p1.page.setViewportSize({ width: 1280, height: 900 })
    })
    await test.step('[UI] 11 The client-safe response copies exactly, and only that text', async () => {
      const card = p1.page.locator(`details[data-objection="${SLUG}"]`)
      await card.getByRole('button', { name: 'Copy response' }).click()
      await expect(card.getByText('Copied the client-safe response.')).toBeVisible()
      expect(await p1.page.evaluate(() => navigator.clipboard.readText())).toBe(CLIENT_LINE)
    })
    await test.step('[UI] 12-14 Related resource, Academy lesson and Knowledge Base answer all open', async () => {
      const card = () => p1.page.locator(`details[data-objection="${SLUG}"]`)
      // Returning to the workspace starts a fresh page, so the partner searches again (the top search result opens).
      const searchAgain = async () => { await p1.page.goto(`${origin()}/partner/objections`); await p1.page.getByLabel('Search approved responses').fill(`that is a lot of money ${tag}`); await p1.page.getByRole('button', { name: 'Search', exact: true }).click(); await expect(card()).toHaveAttribute('open', '') }
      await card().getByRole('link', { name: `Pricing explained ${tag}` }).click()
      await expect(p1.page).toHaveURL(new RegExp(`/partner/resources/res-obj-${run}$`))
      await expect(p1.page.getByRole('heading', { name: `Pricing explained ${tag}` })).toBeVisible()
      await searchAgain()
      await card().getByRole('link', { name: `Handling price objections ${tag}` }).click()
      await expect(p1.page).toHaveURL(new RegExp(`/partner/academy/course-obj-${run}\\?lesson=${lesson.itemId}`))
      await expect(p1.page.getByRole('heading', { name: `Handling price objections ${tag}` })).toBeVisible()
      await searchAgain()
      await card().getByRole('link', { name: `Can the work be phased ${tag}?` }).click()
      await expect(p1.page).toHaveURL(/\/partner\/knowledge\?q=/)
      await expect(p1.page.locator('details.ac-entry').filter({ hasText: `Can the work be phased ${tag}?` })).toHaveCount(1)
    })
    await test.step('[UI] 15-16 Partner requests founder help; an ordinary meeting request is recorded, not confirmed', async () => {
      await p1.page.goto(`${origin()}/partner/objections`)
      await p1.page.getByLabel('Search approved responses').fill(CONCERN)
      await p1.page.getByRole('button', { name: 'Search', exact: true }).click()
      const card = p1.page.locator(`details[data-objection="${SLUG}"]`)
      await card.getByRole('button', { name: 'Request help from ScaleSmiths' }).click()
      const when = new Date(Date.now() + 3 * 86400000); when.setUTCHours(10, 0, 0, 0)
      await card.getByLabel('A time that suits you').fill(when.toISOString().slice(0, 16))
      await card.getByRole('button', { name: 'Send request' }).click()
      await expect(card.getByText(/Request sent\. ScaleSmiths will confirm a time/)).toBeVisible()
      const m = (await su.query("select m.status, m.meeting_type from expansion_meeting_requests m join expansion_partners p on p.id=m.partner_id join admin_users u on u.id=p.user_id where u.email=$1 and m.purpose like $2", [P1, `%${tag}%`])).rows
      expect(m).toEqual([{ status: 'requested', meeting_type: 'commercial_assistance' }])
    })
    await test.step('[UI] 17-18 Founder withdraws the response; the partner can no longer retrieve it', async () => {
      await studio(b.page)
      const card = await openItem(b.page, SLUG)
      const f = form(card, 'Withdraw from publication')
      await f.getByLabel('Reason (kept permanently)').fill('TEST ONLY: withdrawn for correction in the browser journey')
      await submitForm(f, 'Withdraw from publication')
      await p1.page.getByRole('button', { name: 'Search', exact: true }).click()
      await expect(p1.page.locator(`details[data-objection="${SLUG}"]`)).toHaveCount(0)
      await expect(p1.page.getByText('No approved response yet.')).toBeVisible()
      const r = await api(p1.context, `/api/partner/objections?q=${encodeURIComponent(CONCERN)}`)
      expect(r.body.entries.map((e: { slug: string }) => e.slug)).not.toContain(SLUG)
      await axe(p1.page, 'objection empty state')
    })
    await test.step('[UI] 19-20 Suspended and unauthorised identities are refused; partners see no one else’s data', async () => {
      const p3 = await login(browser, P3)
      await su.query("update admin_users set active=false, session_version=session_version+1 where email=$1", [P3])
      expect((await api(p3.context, '/api/partner/objections?q=price')).status).toBeGreaterThanOrEqual(401)
      await su.query("update admin_users set active=true where email=$1", [P3])
      const p2 = await login(browser, P2)
      const shared = await api(p2.context, '/api/partner/objections')
      expect(shared.status).toBe(200)
      expect(JSON.stringify(shared.body)).not.toMatch(/empower-partner-one|meeting|preferredSlots|TEST ONLY Partner One/)
      expect((await api(p2.context, '/api/expansion')).status).toBe(403)
      expect((await api(p2.context, '/api/partner/objections?category=gossip')).status).toBe(400)
      const anon = await browser.newContext(); const anonPage = await anon.newPage()
      const anonStatus = (await anonPage.request.get(`${origin()}/api/partner/objections`, { maxRedirects: 0 })).status()
      expect(anonStatus === 200 || anonStatus >= 500, `anonymous status ${anonStatus}`).toBe(false)
      await anon.close(); await p2.context.close(); await p3.context.close()
    })
    const harnessOnly = /Failed to fetch RSC payload for http:\/\/localhost:3103\/[\s\S]*Falling back to browser navigation|net::ERR_SSL_PROTOCOL_ERROR|net::ERR_FAILED/
    expect(consoleErrors.filter((e) => !harnessOnly.test(e))).toEqual([])
    await Promise.all([a.context.close(), b.context.close(), p1.context.close()])
  } finally { await su.end() }
})
