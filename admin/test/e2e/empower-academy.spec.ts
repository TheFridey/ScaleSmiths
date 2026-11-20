import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * Operation Empower B1.1 + B1.2 acceptance on a production admin build and a disposable database only:
 *   EMPOWER_ADMIN_BASE_URL=http://localhost:3103  EMPOWER_BROWSER_DATABASE_URL=…/ss_empower_browser_e2e (restricted admin role)
 *   EMPOWER_BROWSER_SUPERUSER_URL=…/ss_empower_browser_e2e (operator role, used only for the review-date expiry fixture and rate-limit reset)
 * Seed first with scripts/seed-empower-browser.mjs.
 * [UI] = real screens and clicks.  [API] = authenticated HTTP call, for set-up or to prove a refusal.  [SQL] = disposable-database fixture or check.
 * Everything is synthetic; nothing is sent, deployed or published outside this stack.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL, dbUrl = process.env.EMPOWER_BROWSER_DATABASE_URL, superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
test.skip(!base || !dbUrl || !superUrl, 'An explicit disposable admin server and database are required.')
const PASSWORD = 'Empower-Demo-Only-2026'
const FOUNDER_A = { email: 'empower-founder-a@example.invalid', secret: 'JBSWY3DPEHPK3PXP' }, FOUNDER_B = { email: 'empower-founder-b@example.invalid', secret: 'KRSXG5CTMVRXEZLU' }
const P1 = 'empower-partner-one@example.invalid', P2 = 'empower-partner-two@example.invalid', P3 = 'empower-partner-revoked@example.invalid'
const evidence = '../docs/expansion/empower/evidence/b1-2'
const origin = () => {
  const a = new URL(base!), d = new URL(dbUrl!), s = new URL(superUrl!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103' || d.pathname !== '/ss_empower_browser_e2e' || s.pathname !== '/ss_empower_browser_e2e' || !['127.0.0.1', 'localhost'].includes(d.hostname)) throw new Error('Refusing to run outside the disposable Empower stack.')
  return a.origin
}
const inMonths = (n: number) => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10) }

async function login(browser: Browser, email: string, totpSecret?: string) {
  const context = await browser.newContext()
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
/** Submits a studio form and requires the server to accept it (the form may disappear once the state changes). */
async function submitForm(f: Locator, button: string) {
  const response = f.page().waitForResponse((r) => r.url().endsWith('/api/expansion') && r.request().method() === 'POST', { timeout: 30000 })
  await f.getByRole('button', { name: button, exact: true }).click()
  const r = await response
  expect(r.status(), await r.text()).toBe(200)
  await f.page().waitForResponse((x) => x.url().endsWith('/api/expansion') && x.request().method() === 'GET', { timeout: 15000 }).catch(() => undefined)
}
async function decide(page: Page, slug: string, decision: 'approved' | 'changes_requested', reviewBy?: string) {
  const card = await openItem(page, slug)
  const f = form(card, 'Record decision')
  await f.locator('select[name=decision]').selectOption(decision)
  await f.getByLabel('Decision reference (for example a founder decision ID)').fill('TEST-ONLY-FD-BROWSER')
  await f.getByLabel('What you checked, and why').fill('TEST ONLY: wording checked against the cited sources in the browser journey.')
  if (reviewBy) await f.getByLabel(/^Review by/).fill(reviewBy)
  await submitForm(f, 'Record decision')
}
async function publish(page: Page, slug: string) {
  const card = await openItem(page, slug)
  const button = card.getByRole('button', { name: /^Publish/ })
  const response = page.waitForResponse((r) => r.url().endsWith('/api/expansion') && r.request().method() === 'POST', { timeout: 30000 })
  await button.click()
  const r = await response
  expect(r.status(), await r.text()).toBe(200)
  await page.waitForResponse((x) => x.url().endsWith('/api/expansion') && x.request().method() === 'GET', { timeout: 15000 }).catch(() => undefined)
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0) }
async function axe(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).include('.academy').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = result.violations.filter((v) => ['serious', 'critical'].includes(String(v.impact)))
  expect(serious.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}

test('B1.1 governance and the B1.2 Partner Academy in a real browser', async ({ browser }) => {
  origin()
  const db = new Pool({ connectionString: dbUrl, max: 2 }), su = new Pool({ connectionString: superUrl, max: 1 })
  await mkdir(evidence, { recursive: true })
  const run = Date.now().toString(36)
  const T1 = `Timescales and guarantees ${run}`, T2 = `Build versus ongoing ${run}`
  const L1 = `browser-lesson-${run}`, L2 = `browser-lesson-two-${run}`, L3 = `browser-lesson-three-${run}`, COURSE = `browser-course-${run}`
  try {
    await su.query('delete from login_rate_limits'); await su.query('delete from web_rate_limits')
    await su.query("update admin_users set active=true where email=$1", [P3])

    // ---------------- B1.1: founder authorship and approval separation
    const a = await login(browser, FOUNDER_A.email, FOUNDER_A.secret)
    await test.step('[UI] Founder A creates a lesson draft with Markdown and a knowledge check', async () => {
      await studio(a.page)
      await a.page.locator('details').filter({ has: a.page.locator('summary', { hasText: 'New content item' }) }).locator('summary').click()
      await a.page.getByLabel('Content type').selectOption('lesson')
      const f = form(a.page.locator('section.ex-panel'), 'Create draft')
      await f.getByLabel('Slug (lowercase letters, numbers and hyphens; permanent)').fill(L1)
      await f.getByLabel('Audience (permanent)').selectOption('partner_only')
      await f.getByLabel('Title', { exact: true }).fill(T1)
      await f.getByLabel(/^Body \(Markdown/).fill('## No guarantees\n\nNo one can **guarantee** first place on Google. See the [ICO](https://ico.org.uk/) for marketing rules.\n\n<script>window.__pwned = true</script>\n\n- Technical fixes can be quick\n- Content work takes months')
      await f.getByLabel(/^Sources, one per line/).fill('faq:ranking-guarantees\nfaq:seo-timeline')
      await f.getByLabel('Course code (for example C04)').fill('C03')
      await f.getByLabel('Lesson code (for example C04-L3)').fill('C03-L4')
      await f.getByLabel('Reading time in minutes').fill('6')
      await f.getByRole('button', { name: 'Add a question' }).click()
      await f.getByLabel('Question 1', { exact: true }).fill('Can anyone guarantee first place on Google?')
      await f.getByLabel('Option A').fill('Yes, with enough budget')
      await f.getByLabel('Option B').fill('No')
      await f.getByLabel('Correct answer').nth(1).check()
      await f.getByLabel('Explanation shown after an attempt').fill("Rankings depend on Google's systems, competitors and the searcher.")
      await submitForm(f, 'Create draft')
      await expect(item(a.page, L1)).toHaveCount(1)
    })
    const b = await login(browser, FOUNDER_B.email, FOUNDER_B.secret)
    const l1 = (await db.query("select v.id version_id,i.id item_id from empower_content_items i join empower_content_versions v on v.item_id=i.id where i.slug=$1", [L1])).rows[0]
    await test.step("[UI] Founder B cannot edit Founder A's draft; [API] the server refuses it too", async () => {
      await studio(b.page)
      const card = await openItem(b.page, L1)
      await expect(card.getByText('Only the author can edit or submit it')).toBeVisible()
      await expect(card.getByRole('button', { name: 'Save draft' })).toHaveCount(0)
      await expect(card.getByRole('button', { name: 'Submit for review' })).toHaveCount(0)
      expect((await api(b.context, '/api/expansion', { action: 'save_content_draft', versionId: l1.version_id, title: 'Rewritten by B' })).status).toBe(403)
      expect((await api(b.context, '/api/expansion', { action: 'submit_content', versionId: l1.version_id })).status).toBe(403)
    })
    await test.step('[UI] Founder A edits and submits; A cannot approve while B is active', async () => {
      await studio(a.page)
      const card = await openItem(a.page, L1)
      await submitForm(form(card, 'Submit for review'), 'Submit for review')
      await expect(card.getByText('You wrote this version, so another founder must record the decision.')).toBeVisible()
      const self = await api(a.context, '/api/expansion', { action: 'decide_content', versionId: l1.version_id, decision: 'approved', reference: 'TEST', notes: 'Self approval attempt', reviewBy: inMonths(2) })
      expect(self.status).toBe(403)
    })
    await test.step('[UI] Founder B approves and publishes; version history and approval evidence show', async () => {
      await studio(b.page)
      await decide(b.page, L1, 'approved', inMonths(2))
      await publish(b.page, L1)
      const card = await openItem(b.page, L1)
      await expect(card.locator('summary').first()).toContainText('Published v1')
      await expect(card.getByText(/Approved by TEST ONLY Founder B/)).toBeVisible()
    })
    await test.step('[API set-up] a second lesson published; [UI] a third lesson gets changes requested', async () => {
      for (const [slug, title, code] of [[L2, T2, 'C03-L5'], [L3, `SEO and paid search ${run}`, 'C03-L6']]) {
        const created = await api(a.context, '/api/expansion', { action: 'create_content_item', kind: 'lesson', slug, audience: 'partner_only', cadence: 'service', title, body: 'Search foundations are part of every build. Ongoing SEO is separate, scoped work.', fields: { course_code: 'C03', lesson_code: code }, sourceRefs: ['faq:seo-in-build'] })
        expect(created.status).toBe(200)
        expect((await api(a.context, '/api/expansion', { action: 'submit_content', versionId: created.body.result.versionId })).status).toBe(200)
        if (slug === L2) {
          expect((await api(b.context, '/api/expansion', { action: 'decide_content', versionId: created.body.result.versionId, decision: 'approved', reference: 'TEST-API', notes: 'TEST ONLY set-up approval', reviewBy: inMonths(2) })).status).toBe(200)
          expect((await api(b.context, '/api/expansion', { action: 'publish_content', versionId: created.body.result.versionId })).status).toBe(200)
        }
      }
      await studio(b.page)
      await decide(b.page, L3, 'changes_requested')
      await expect((await openItem(b.page, L3)).locator('.ex-badge', { hasText: 'Changes requested' }).first()).toBeVisible()
    })

    // ---------------- B1.2: course authoring and independent approval
    await test.step('[UI] Founder A builds a course from published lessons and submits it', async () => {
      await studio(a.page)
      await a.page.locator('details').filter({ has: a.page.locator('summary', { hasText: 'New content item' }) }).locator('summary').click()
      await a.page.getByLabel('Content type').selectOption('course')
      const f = form(a.page.locator('section.ex-panel'), 'Create draft')
      await f.getByLabel('Slug (lowercase letters, numbers and hyphens; permanent)').fill(COURSE)
      await f.getByLabel('Title', { exact: true }).fill(`SEO and Digital Growth ${run}`)
      await f.getByLabel('Course description (Markdown)').fill('Talk about search visibility, including AI search, **accurately** and without promises.')
      await f.getByLabel(/^Sources, one per line/).fill('docs/expansion/empower/CURRICULUM.md#c03')
      await f.getByLabel('Category').selectOption('digital-growth')
      await f.getByLabel('Learning objectives, one per line').fill('Explain SEO timescales honestly\nRespond to guarantee questions with the approved answer')
      await f.getByRole('button', { name: 'Add a module' }).click()
      await f.getByLabel('Module 1 title').fill('Honest expectations')
      await f.getByLabel('Add a lesson to module 1').selectOption({ label: `${T1} (Published)` })
      await f.getByLabel('Add a lesson to module 1').selectOption({ label: `${T2} (Published)` })
      await expect(f.locator('.ex-lesson-order li')).toHaveCount(2)
      await f.getByRole('button', { name: 'Down' }).first().click() // reorder, then restore
      await f.getByRole('button', { name: 'Up' }).first().click()
      await expect(f.locator('.ex-lesson-order li').first()).toContainText(T1)
      await submitForm(f, 'Create draft')
      const card = await openItem(a.page, COURSE)
      await expect(card.locator('.ex-preview summary', { hasText: 'Preview as partners will read it' })).toBeVisible()
      await submitForm(form(card, 'Submit for review'), 'Submit for review')
    })
    await test.step('[UI] Founder B approves and publishes the course', async () => {
      await studio(b.page)
      await decide(b.page, COURSE, 'approved', inMonths(2))
      await publish(b.page, COURSE)
    })

    // ---------------- B1.2: the partner experience
    const p1 = await login(browser, P1)
    await test.step('[UI] Partner opens the Academy from the workspace, finds and searches the course', async () => {
      await p1.page.goto(`${origin()}/partner`)
      await p1.page.getByRole('link', { name: /Partner Academy/ }).first().click()
      await p1.page.waitForURL(/\/partner\/academy$/)
      await expect(p1.page.getByRole('heading', { name: 'Learn at your own pace.' })).toBeVisible()
      const search = p1.page.getByLabel('Search courses')
      await search.fill(`zzz-${run}`)
      await expect(p1.page.getByText('No course matches that search.')).toBeVisible()
      await search.fill('guarantees')
      await expect(p1.page.getByLabel('Course catalogue').locator(`[data-course="${COURSE}"]`)).toBeVisible()
      await axe(p1.page, 'dashboard')
      for (const width of [320, 390, 768, 1024, 1440]) {
        await p1.page.setViewportSize({ width, height: 900 }); await noOverflow(p1.page)
        await p1.page.screenshot({ path: `${evidence}/academy-dashboard-${width}.png`, fullPage: true })
      }
      await p1.page.setViewportSize({ width: 1280, height: 900 })
      await p1.page.getByLabel('Course catalogue').locator(`[data-course="${COURSE}"]`).click()
      await p1.page.waitForURL(new RegExp(`/partner/academy/${COURSE}`))
    })
    await test.step('[UI] Lesson Markdown renders safely; script is inert text', async () => {
      const article = p1.page.locator('article.ac-lesson')
      await expect(article.getByRole('heading', { name: T1 })).toBeVisible()
      await expect(article.locator('.ac-prose strong', { hasText: 'guarantee' })).toBeVisible()
      await expect(article.locator('.ac-prose h3', { hasText: 'No guarantees' })).toBeVisible()
      await expect(article.locator('.ac-prose a[href="https://ico.org.uk/"][rel~="noopener"]')).toBeVisible()
      await expect(article.locator('script')).toHaveCount(0)
      await expect(article.getByText('<script>window.__pwned = true</script>')).toBeVisible()
      expect(await p1.page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined()
    })
    await test.step('[UI] Optional knowledge check: wrong, then right, with feedback', async () => {
      const q = p1.page.locator('fieldset[data-question="q1"]')
      await q.getByLabel('Yes, with enough budget').check()
      await q.getByRole('button', { name: 'Check my answer' }).click()
      await expect(q.getByText('Not quite.')).toBeVisible()
      await expect(q.getByText("Rankings depend on Google's systems")).toBeVisible()
      await q.getByLabel('No', { exact: true }).check()
      await q.getByRole('button', { name: 'Try again' }).click()
      await expect(q.getByText('Correct.')).toBeVisible()
    })
    await test.step('[UI] Mark as read, persisted after refresh', async () => {
      await p1.page.getByRole('button', { name: 'Mark as read (optional)' }).click()
      await expect(p1.page.locator('.ac-lesson-actions .ac-chip', { hasText: 'Read' })).toBeVisible()
      await p1.page.reload()
      await expect(p1.page.locator('.ac-lesson-actions .ac-chip', { hasText: 'Read' })).toBeVisible()
      await expect(p1.page.getByText('1 of 2 available lessons read')).toBeVisible()
      await axe(p1.page, 'lesson')
      for (const width of [320, 390, 768, 1024, 1440]) {
        await p1.page.setViewportSize({ width, height: 900 }); await noOverflow(p1.page)
        await p1.page.screenshot({ path: `${evidence}/academy-lesson-${width}.png`, fullPage: true })
      }
      await p1.page.setViewportSize({ width: 1280, height: 900 })
    })
    await test.step('[UI] Partner two sees none of partner one\'s progress; [API] founder routes are refused to partners', async () => {
      const p2 = await login(browser, P2)
      await p2.page.goto(`${origin()}/partner/academy/${COURSE}`)
      await expect(p2.page.getByText('0 of 2 available lessons read')).toBeVisible()
      const view = await api(p2.context, `/api/partner/academy?course=${COURSE}`)
      expect(view.body.course.progress.completed).toBe(0)
      expect(JSON.stringify(view.body)).not.toContain(L3) // a draft lesson is never served
      expect((await api(p1.context, '/api/expansion')).status).toBe(403)
      await p2.context.close()
    })
    await test.step('[UI] A replacement lesson version reaches the partner; earlier history remains', async () => {
      await studio(a.page)
      let card = await openItem(a.page, L1)
      await submitForm(form(card, 'Start a new revision'), 'Start a new revision')
      card = await openItem(a.page, L1)
      const f = form(card, 'Save draft')
      await f.getByLabel(/^Body \(Markdown/).fill('## No guarantees\n\nNo one can **guarantee** first place on Google. Revised guidance: measure progress against a recorded baseline.')
      await submitForm(f, 'Save draft')
      await submitForm(form(await openItem(a.page, L1), 'Submit for review'), 'Submit for review')
      await studio(b.page)
      await decide(b.page, L1, 'approved', inMonths(2))
      await publish(b.page, L1)
      await p1.page.reload()
      await p1.page.getByRole('button', { name: new RegExp(T1) }).click()
      await expect(p1.page.getByText('Revised guidance: measure progress against a recorded baseline.')).toBeVisible()
      await expect(p1.page.getByText('This lesson has been updated since you last read it.')).toBeVisible()
      const history = await db.query('select count(*)::int n from empower_academy_completions where lesson_version_id=$1', [l1.version_id]) // [SQL] check
      expect(history.rows[0].n).toBe(1)
    })
    await test.step('[UI] Founder withdraws a lesson; it becomes unavailable to partners', async () => {
      await studio(b.page)
      const card = await openItem(b.page, L2)
      const f = form(card, 'Withdraw from publication')
      await f.getByLabel('Reason (kept permanently)').fill('TEST ONLY: withdrawn for correction in the browser journey')
      await submitForm(f, 'Withdraw from publication')
      await p1.page.reload()
      await expect(p1.page.getByRole('button', { name: /Lesson under review/ })).toBeDisabled()
      await expect(p1.page.getByText(/1 under review/)).toBeVisible()
    })
    await test.step('[SQL fixture] Review date passes; content is no longer served and the studio flags it', async () => {
      // Review dates cannot be backdated by any runtime role; the operator role simulates time passing in this disposable database only.
      await su.query('alter table empower_content_versions disable trigger empower_content_lifecycle_guard')
      try { await su.query("update empower_content_versions set review_by=(now() at time zone 'UTC')::date - 1 where item_id=$1 and status='published'", [l1.item_id]) }
      finally { await su.query('alter table empower_content_versions enable trigger empower_content_lifecycle_guard') }
      await p1.page.reload()
      await expect(p1.page.getByText('This course is not available.')).toBeVisible() // no lesson in the course is servable any more
      await p1.page.goto(`${origin()}/partner/academy`)
      await expect(p1.page.locator(`[data-course="${COURSE}"]`)).toHaveCount(0)
      await studio(b.page)
      await expect((await openItem(b.page, L1)).getByText('Past review date')).toBeVisible()
    })
    await test.step('[SQL fixture] A revoked partner is denied the Academy', async () => {
      const p3 = await login(browser, P3)
      expect((await api(p3.context, '/api/partner/academy')).status).toBe(200)
      await su.query('update admin_users set active=false where email=$1', [P3])
      const denied = await api(p3.context, '/api/partner/academy')
      expect([401, 403]).toContain(denied.status)
      await p3.page.goto(`${origin()}/partner/academy`)
      await expect(p3.page).toHaveURL(/\/login|\/partner\/academy/)
      if (/\/partner\/academy/.test(p3.page.url())) await expect(p3.page.getByRole('alert')).toBeVisible()
      await p3.context.close()
    })
    await Promise.all([a.context.close(), b.context.close(), p1.context.close()])
  } finally { await su.query('update admin_users set active=true where email=$1', [P3]).catch(() => undefined); await db.end(); await su.end() }
})
