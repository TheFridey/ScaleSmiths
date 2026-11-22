import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mkdir } from 'node:fs/promises'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * Operation Ascend B2.1 acceptance: Journey A (partner pipeline) and Journey E (security), on a production admin build and a
 * disposable database only (seed with scripts/seed-empower-browser.mjs; PARTNER_PIPELINE_ENABLED=true on the disposable server).
 * [UI] real screens and clicks. [API] authenticated HTTP for set-up or to prove a refusal. [SQL] disposable-database fixture or check.
 */
const base = process.env.EMPOWER_ADMIN_BASE_URL, dbUrl = process.env.EMPOWER_BROWSER_DATABASE_URL, superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
test.skip(!base || !dbUrl || !superUrl, 'An explicit disposable admin server and database are required.')
const PASSWORD = 'Empower-Demo-Only-2026'
const FOUNDER_A = { email: 'empower-founder-a@example.invalid', secret: 'JBSWY3DPEHPK3PXP' }
const P1 = 'empower-partner-one@example.invalid', P2 = 'empower-partner-two@example.invalid', P3 = 'empower-partner-revoked@example.invalid'
const evidence = '../docs/expansion/ascend/evidence/b2-1'
const WIDTHS = [320, 390, 768, 1024, 1440, 1920]
const origin = () => {
  const a = new URL(base!), d = new URL(dbUrl!), s = new URL(superUrl!)
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103' || d.pathname !== '/ss_empower_browser_e2e' || s.pathname !== '/ss_empower_browser_e2e' || !['127.0.0.1', 'localhost'].includes(d.hostname)) throw new Error('Refusing to run outside the disposable stack.')
  return a.origin
}
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
  const r = data ? await c.request.post(`${origin()}${path}`, { headers: { origin: origin() }, data }) : await c.request.get(`${origin()}${path}`, { maxRedirects: 0 })
  return { status: r.status(), body: await r.json().catch(() => ({})) }
}
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0) }
async function axe(page: Page, scope: string, label: string) {
  const result = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  const serious = result.violations.filter((v) => ['serious', 'critical'].includes(String(v.impact)))
  expect(serious.map((v) => `${label}: ${v.id} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
}
async function shots(page: Page, name: string, fullPage = true, settle?: () => Promise<void>) {
  for (const width of WIDTHS) { await page.setViewportSize({ width, height: 900 }); await settle?.(); await noOverflow(page); await page.screenshot({ path: `${evidence}/${name}-${width}.png`, fullPage }) }
  await page.setViewportSize({ width: 1280, height: 900 })
}
const ledger = async (su: pg.Pool) => (await su.query("select md5(coalesce(string_agg(l::text, '|' order by l.id), '')) h from expansion_commission_ledger l")).rows[0].h as string

test('B2.1 partner pipeline: Journey A (pipeline, guidance, founder help) and Journey E (isolation and refusals)', async ({ browser }) => {
  origin()
  const su = new Pool({ connectionString: superUrl, max: 1 })
  await mkdir(evidence, { recursive: true })
  const run = Date.now().toString(36)
  const BUSINESS = `TEST ONLY Pipeline Prospect ${run}`
  const errors: string[] = []
  const harnessOnly = /Failed to fetch RSC payload for http:\/\/localhost:3103\/[\s\S]*Falling back to browser navigation|net::ERR_SSL_PROTOCOL_ERROR|net::ERR_FAILED/
  try {
    await su.query('delete from login_rate_limits'); await su.query('delete from web_rate_limits')
    await su.query('update admin_users set active=true where email=$1', [P3])
    const founder = await login(browser, FOUNDER_A.email, FOUNDER_A.secret)
    expect((await api(founder.context, '/api/expansion', { action: 'set_market', countryCode: 'GB', countryName: 'United Kingdom', status: 'approved', planKeys: ['standard-v2'], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: `TEST ONLY ${run}` })).status).toBe(200)
    const ledgerBefore = await ledger(su)

    const p1 = await login(browser, P1)
    p1.page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    // [API] A1-A3 Partner A registers a synthetic prospect through the real partner command.
    const reg = await api(p1.context, '/api/partner', { action: 'register', country: 'GB', businessName: BUSINESS, website: `pl-${run}.example`, industry: 'TEST ONLY Trades' })
    expect(reg.status, JSON.stringify(reg.body)).toBe(200)
    const oppId = String(reg.body.result.id)
    const card = () => p1.page.getByRole('button', { name: new RegExp(`^Open ${BUSINESS}`) })

    await test.step('[UI] A4 The prospect appears in the correct column; board, table and list views; filters', async () => {
      await p1.page.goto(`${origin()}/partner/pipeline`)
      await expect(p1.page.getByRole('heading', { name: 'Every business you have introduced' })).toBeVisible()
      await expect(p1.page.locator('section[aria-labelledby="col-new"]').getByRole('button', { name: new RegExp(`^Open ${BUSINESS}, Registered`) })).toBeVisible()
      await expect(card().getByText('Discovery has not started')).toBeVisible()
      await axe(p1.page, '.academy', 'pipeline board')
      await shots(p1.page, 'pipeline-board')
      await p1.page.getByRole('button', { name: 'Table', exact: true }).click()
      await expect(p1.page.getByRole('table').getByRole('button', { name: BUSINESS })).toBeVisible()
      await axe(p1.page, '.academy', 'pipeline table')
      await shots(p1.page, 'pipeline-table')
      await p1.page.getByRole('button', { name: 'List', exact: true }).click()
      await expect(p1.page.getByRole('list', { name: 'Pipeline list' }).getByRole('button', { name: new RegExp(`^Open ${BUSINESS}`) })).toBeVisible()
      await shots(p1.page, 'pipeline-list')
      await p1.page.getByLabel('Search').fill('no business matches this')
      await expect(p1.page.getByText('No opportunities match these filters.')).toBeVisible()
      await p1.page.getByRole('button', { name: 'Clear filters' }).click()
      await p1.page.getByLabel('Stage').selectOption('closed')
      await expect(card()).toHaveCount(0)
      await p1.page.getByLabel('Stage').selectOption('new')
      await p1.page.getByLabel('Needs my action').check()
      await expect(card()).toBeVisible()
      await p1.page.getByLabel('Sort').selectOption('name')
      await p1.page.getByRole('button', { name: 'Board', exact: true }).click()
    })

    await test.step('[UI] A5 Keyboard: the detail dialog takes focus, contains Tab, closes on Escape and returns focus', async () => {
      await card().focus()
      await p1.page.keyboard.press('Enter')
      const dialog = p1.page.getByRole('dialog', { name: BUSINESS })
      await expect(dialog).toBeVisible()
      await expect(dialog).toBeFocused()
      for (let i = 0; i < 40; i++) await p1.page.keyboard.press('Tab')
      expect(await p1.page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true)
      await p1.page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
      await expect(card()).toBeFocused()
    })

    await test.step('[UI] A6-A7 Authorised stage moves only, with reasons for the rest; history records them', async () => {
      await card().click()
      const dialog = p1.page.getByRole('dialog', { name: BUSINESS })
      await expect(dialog.getByRole('button', { name: 'Mark as contacted' })).toBeVisible()
      await expect(dialog.getByRole('button', { name: /Approved|Contract accepted/ })).toHaveCount(0)
      await dialog.getByText("Why can't I choose other stages?").click()
      await expect(dialog.getByText('Only ScaleSmiths can record this outcome.').first()).toBeVisible()
      p1.page.once('dialog', (d) => d.accept())
      await dialog.getByRole('button', { name: 'Mark as contacted' }).click()
      await expect(dialog.locator('p.pl-live')).toHaveText('Stage updated.')
      p1.page.once('dialog', (d) => d.accept())
      await dialog.getByRole('button', { name: 'Move to discovery' }).click()
      await expect(dialog.getByText('Stage changed from Contacted to Discovery in progress')).toBeVisible()
      expect((await su.query('select status from expansion_opportunities where id=$1', [oppId])).rows[0].status).toBe('discovery')
      expect((await su.query("select count(*)::int n from expansion_audit where entity_id=$1 and action='stage_changed'", [oppId])).rows[0].n).toBe(2)
    })

    await test.step('[UI] A8 Record an interaction and a private follow-up; neither changes the opportunity', async () => {
      const dialog = p1.page.getByRole('dialog', { name: BUSINESS })
      const interaction = dialog.getByRole('form', { name: 'Record an interaction' })
      await interaction.getByLabel('Type').selectOption('call')
      await interaction.getByLabel('Summary').fill(`TEST ONLY spoke to the owner <b>about</b> a new site ${run}`)
      await interaction.getByRole('button', { name: 'Record interaction' }).click()
      await expect(dialog.locator('p.pl-live')).toHaveText('Interaction recorded.')
      await expect(dialog.locator('.pl-text').filter({ hasText: `<b>about</b> a new site ${run}` })).toBeVisible()
      const followUp = dialog.getByRole('form', { name: 'Follow-up reminder' })
      const due = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
      await followUp.getByLabel('Date').fill(due)
      await followUp.getByRole('button', { name: 'Save follow-up' }).click()
      await expect(dialog.locator('p.pl-live')).toHaveText('Follow-up date saved.')
      await expect(dialog.getByText('Follow-up date set')).toBeVisible()
      expect((await su.query('select status from expansion_opportunities where id=$1', [oppId])).rows[0].status).toBe('discovery')
      expect((await su.query('select count(*)::int n from expansion_opportunity_interactions where opportunity_id=$1', [oppId])).rows[0].n).toBe(1)
    })

    await test.step('[API+UI] B2.2 Qualification readiness: explainable factors, escalation shortcut, founder inspection, no state change', async () => {
      // [API] Discovery through the real partner command (the discovery form itself lives in the partner workspace).
      expect((await api(p1.context, '/api/partner', { action: 'discovery', id: oppId, discovery: { objectives: 'Win more local enquiries online', pages: 'Home, services, contact', decisionProcess: 'Owner decides', functionality: 'Online booking and payments' } })).status).toBe(200)
      await p1.page.keyboard.press('Escape')
      // The New-stage and needs-action filters from A4 still apply and now hide this discovery-stage prospect.
      await p1.page.getByRole('button', { name: 'Clear filters' }).click()
      await card().click()
      const dialog = p1.page.getByRole('dialog', { name: BUSINESS })
      const qa =dialog.getByRole('region', { name: 'Qualification readiness' })
      await expect(qa.getByText('3 of 6')).toBeVisible()
      await expect(qa.getByText(/not a prediction that the business will buy/)).toBeVisible()
      await expect(qa.locator('li[data-met="true"]')).toHaveCount(3)
      await expect(qa.getByText('Timescale understood')).toBeVisible()
      await qa.getByRole('button', { name: 'Ask for technical scoping' }).click()
      const help = dialog.getByRole('form', { name: 'Ask a founder for help' })
      await expect(help.getByLabel('What do you need?')).toHaveValue('technical_scoping')
      await expect(help.getByLabel('What do you need?')).toBeFocused()
      await axe(p1.page, '[role=dialog]', 'qualification')
      await shots(p1.page, 'qualification-partner', false, async () => { await qa.scrollIntoViewIfNeeded() })
      // [API] Founders inspect the same factors; partners cannot reach the founder view.
      const founderView = await api(founder.context, `/api/expansion/qualification?id=${oppId}`)
      expect(founderView.status, JSON.stringify(founderView.body)).toBe(200)
      expect(founderView.body.qualification.met).toBe(3)
      expect([401, 403]).toContain((await api(p1.context, `/api/expansion/qualification?id=${oppId}`)).status)
      // [UI] The founder sees how the readiness was derived on the opportunity itself.
      await founder.page.setViewportSize({ width: 1440, height: 900 })
      await founder.page.goto(`${origin()}/expansion`)
      await founder.page.getByRole('navigation', { name: 'Partner workspace' }).getByRole('button', { name: 'Prospects & scope' }).click()
      await founder.page.locator('.ex-list-row').filter({ hasText: BUSINESS }).first().click()
      const inspect = founder.page.locator('details.qa-founder')
      await expect(inspect.getByText('3 of 6')).toBeVisible()
      await inspect.scrollIntoViewIfNeeded()
      await founder.page.screenshot({ path: `${evidence}/qualification-founder-1440.png` })
      expect((await su.query('select status from expansion_opportunities where id=$1', [oppId])).rows[0].status).toBe('discovery')
    })

    let meetingId = ''
    await test.step('[UI] A9-A10 Partner asks a founder for help; it reaches the founder queue', async () => {
      const dialog = p1.page.getByRole('dialog', { name: BUSINESS })
      const help = dialog.getByRole('form', { name: 'Ask a founder for help' })
      await help.getByLabel('What do you need?').selectOption('technical_scoping')
      const slot = new Date(Date.now() + 4 * 86400000); slot.setUTCHours(10, 0, 0, 0)
      await help.getByLabel('A time that suits you').fill(slot.toISOString().slice(0, 16))
      await help.getByLabel('What should the founder know?').fill(`TEST ONLY CRM integration question ${run}`)
      await help.getByRole('button', { name: 'Send request' }).click()
      await expect(dialog.locator('p.pl-live')).toHaveText(/Request sent to ScaleSmiths/)
      await expect(dialog.getByText('Meeting requested').first()).toBeVisible()
      await axe(p1.page, '[role=dialog]', 'pipeline detail')
      await shots(p1.page, 'pipeline-detail', false, async () => { await dialog.evaluate((el) => { el.scrollTop = 0 }) })
      await shots(p1.page, 'pipeline-history', false, async () => { await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight }) })
      const m = (await su.query('select id,status from expansion_meeting_requests where opportunity_id=$1 order by created_at desc limit 1', [oppId])).rows[0]
      expect(m.status).toBe('requested'); meetingId = String(m.id)
      await founder.page.goto(`${origin()}/expansion`)
      await expect(founder.page.getByRole('region', { name: /Needs your attention/ }).locator('.gd-row').filter({ hasText: BUSINESS })).toBeVisible()
    })

    await test.step('[API+UI] A11-A12 Founder confirms; the partner sees the outcome; commission is unchanged', async () => {
      const start = new Date(Date.now() + 6 * 86400000); start.setUTCHours(11, 0, 0, 0)
      expect((await api(founder.context, '/api/expansion', { action: 'decide_meeting', meetingId, decision: 'confirm', start: start.toISOString(), note: 'TEST ONLY confirmed in the B2.1 journey' })).status).toBe(200)
      await p1.page.reload()
      await expect(card().getByText('Meeting confirmed')).toBeVisible()
      await card().click()
      const dialog = p1.page.getByRole('dialog', { name: BUSINESS })
      await expect(dialog.locator('.pl-timeline').getByText('Meeting confirmed')).toBeVisible()
      // The founder's private note never reaches the partner's history.
      await expect(dialog.getByText('TEST ONLY confirmed in the B2.1 journey')).toHaveCount(0)
      await p1.page.keyboard.press('Escape')
      expect(await ledger(su)).toBe(ledgerBefore)
    })

    await test.step('[UI+API] B1-B9 Founder sales command centre: queue, assignment, deep link, authorised decision, audit', async () => {
      // [API] The partner completes discovery and submits the scope through the real partner commands.
      expect((await api(p1.context, '/api/partner', { action: 'discovery', id: oppId, discovery: { objectives: 'Win more local enquiries online', pages: 'Home, services, contact', functionality: 'Online booking and payments', budget: 'Discussed with the owner', timescale: 'Spring', decisionProcess: 'Owner decides' } })).status).toBe(200)
      const submitted = await api(p1.context, '/api/partner', { action: 'submit_scope', id: oppId, summary: `TEST ONLY scope for ${BUSINESS}` })
      expect(submitted.status, JSON.stringify(submitted.body)).toBe(200)
      await founder.page.setViewportSize({ width: 1440, height: 900 })
      await founder.page.goto(`${origin()}/expansion/command`)
      await expect(founder.page.getByRole('heading', { name: 'Sales command centre' })).toBeVisible()
      await founder.page.getByLabel('Kind').selectOption('scope_review')
      const row = founder.page.locator('li.sc-item').filter({ hasText: BUSINESS })
      await expect(row).toBeVisible()
      await expect(row.locator('.sc-tag')).toHaveText('Technical scoping')
      await expect(row.getByText('No founder assigned')).toBeVisible()
      await axe(founder.page, '.sc', 'command centre')
      await shots(founder.page, 'command-centre')
      await row.getByRole('button', { name: 'Assign' }).click()
      const form = row.getByRole('form', { name: `Assign a founder to ${BUSINESS}` })
      await form.getByLabel('Founder').selectOption({ label: 'TEST ONLY Founder A' })
      await form.getByLabel('Reason').fill('TEST ONLY takes technical scoping this week')
      await form.getByRole('button', { name: 'Save assignment' }).click()
      await expect(row.getByText('Handled by TEST ONLY Founder A')).toBeVisible()
      // [API] A stale second assignment from an old view is refused; the partner keeps ownership.
      const stale = await api(founder.context, '/api/expansion/command', { action: 'assign', opportunityId: oppId, assigneeId: null, reason: 'TEST ONLY stale view', expectedCurrentId: null })
      expect(stale.status).toBe(409)
      expect((await su.query('select p.user_id from expansion_opportunities o join expansion_partners p on p.id=o.partner_id where o.id=$1', [oppId])).rows[0].user_id).toBe((await su.query('select id from admin_users where email=$1', [P1])).rows[0].id)
      // [UI] The queue item opens the opportunity itself in the founder workspace.
      await row.getByRole('link', { name: new RegExp(`^Open scope to review: ${BUSINESS}`) }).click()
      await expect(founder.page).toHaveURL(new RegExp(`/expansion\?tab=pipeline&opportunity=${oppId}`))
      await expect(founder.page.getByRole('heading', { name: BUSINESS })).toBeVisible()
      // [API] An authorised founder decision through the existing command; audit records it and the partner sees the outcome.
      expect((await api(founder.context, '/api/expansion', { action: 'review_scope', id: oppId, decision: 'more_information', notes: 'TEST ONLY internal: confirm booking provider before pricing' })).status).toBe(200)
      expect((await su.query("select count(*)::int n from expansion_audit where entity_id=$1 and action in ('scope_reviewed','founder_assignment')", [oppId])).rows[0].n).toBe(2)
      const detail = await api(p1.context, `/api/partner/pipeline?id=${oppId}`)
      expect(detail.body.opportunity.status).toBe('more_information')
      expect(JSON.stringify(detail.body)).not.toMatch(/confirm booking provider|founder_assignment|takes technical scoping/)
      expect((detail.body.timeline as { label: string }[]).map((t) => t.label)).toContain('ScaleSmiths asked for more information')
      // [API] Partners cannot open the command centre.
      expect([401, 403]).toContain((await api(p1.context, '/api/expansion/command')).status)
      expect(await ledger(su)).toBe(ledgerBefore)
    })

    await test.step('[API] E1-E9 Isolation and refusals', async () => {
      const p2 = await login(browser, P2)
      expect((await api(p2.context, `/api/partner/pipeline?id=${oppId}`)).status).toBe(404)
      expect((await api(p2.context, '/api/partner/pipeline?id=not-a-uuid')).status).toBe(404)
      expect(JSON.stringify((await api(p2.context, '/api/partner/pipeline')).body)).not.toContain(BUSINESS)
      const forged = await api(p2.context, '/api/partner', { action: 'stage', id: oppId, status: 'withdrawn' })
      expect(forged.status).toBe(404)
      expect((await api(p2.context, '/api/partner/pipeline', { action: 'record_interaction', opportunityId: oppId, kind: 'note', summary: 'probe', occurredOn: new Date().toISOString().slice(0, 10) })).status).toBe(404)
      expect((await api(p2.context, '/api/partner/pipeline', { action: 'schedule_follow_up', opportunityId: oppId, date: '' })).status).toBe(404)
      // A partner cannot skip the founder's decision, even on their own opportunity.
      expect((await api(p1.context, '/api/partner', { action: 'stage', id: oppId, status: 'approved' })).status).toBe(409)
      expect((await su.query('select status from expansion_opportunities where id=$1', [oppId])).rows[0].status).toBe('more_information')
      expect((await api(p2.context, '/api/expansion')).status).toBe(403)
      const p3 = await login(browser, P3)
      await su.query('update admin_users set active=false, session_version=session_version+1 where email=$1', [P3])
      expect((await api(p3.context, '/api/partner/pipeline')).status).toBeGreaterThanOrEqual(401)
      await su.query('update admin_users set active=true where email=$1', [P3])
      const anon = await browser.newContext(); const s = (await anon.request.get(`${origin()}/api/partner/pipeline`, { maxRedirects: 0 })).status()
      expect(s === 200 || s >= 500, `anonymous ${s}`).toBe(false); await anon.close()
      expect(await ledger(su)).toBe(ledgerBefore)
      await p2.context.close(); await p3.context.close()
    })
    expect(errors.filter((e) => !harnessOnly.test(e))).toEqual([])
    await p1.context.close(); await founder.context.close()
  } finally { await su.end() }
})
