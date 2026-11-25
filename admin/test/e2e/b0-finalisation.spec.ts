import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * B0 finalisation acceptance (checkpoint 5), production builds, disposable stack only:
 *   EXPANSION_ADMIN_BASE_URL (http://localhost:3103), EXPANSION_WEB_BASE_URL (http://localhost:3102),
 *   EXPANSION_TEST_DATABASE_URL (…/ss_expansion_hardening_browser).
 * [UI]  = driven through the real screens.   [API] = authenticated command used for set-up only.   [SQL] = disposable-database set-up.
 * Everything is synthetic. Nothing here emails, contacts a prospect, moves money or publishes a real partner.
 */
const adminOrigin = process.env.EXPANSION_ADMIN_BASE_URL, webOrigin = process.env.EXPANSION_WEB_BASE_URL, databaseUrl = process.env.EXPANSION_TEST_DATABASE_URL
test.skip(!adminOrigin || !webOrigin || !databaseUrl, 'An explicit disposable admin server, web server and database are required.')
const password = 'Expansion-Demo-Only-2026'
const evidence = '../docs/expansion/intelligence/evidence/b0'
function origins() {
  const a = new URL(adminOrigin || 'invalid:'), w = new URL(webOrigin || 'invalid:'), db = new URL(databaseUrl || 'invalid:')
  if (!['localhost', '127.0.0.1'].includes(a.hostname) || a.port !== '3103' || !['localhost', '127.0.0.1'].includes(w.hostname) || w.port !== '3102' || db.pathname !== '/ss_expansion_hardening_browser') throw new Error('Refusing browser mutations outside the explicit disposable stack.')
  return { admin: a.origin, web: w.origin }
}
const admin = () => origins().admin, web = () => origins().web
async function login(page: Page, email: string) {
  await page.goto(`${admin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email); await page.getByLabel('Password', { exact: true }).fill(password)
  if (email === 'expansion-founder@example.invalid') await page.getByLabel(/^Authenticator code/).fill(generateTotp('JBSWY3DPEHPK3PXP'))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await page.waitForURL(/\/(partner|command-centre)$/)
}
const snapshot = async (c: BrowserContext, founder = false) => { const r = await c.request.get(`${admin()}/api/${founder ? 'expansion' : 'partner'}`); expect(r.ok(), await r.text()).toBeTruthy(); return r.json() }
async function command(c: BrowserContext, input: Record<string, unknown>, founder = false) {
  const r = await c.request.post(`${admin()}/api/${founder ? 'expansion' : 'partner'}`, { headers: { origin: admin() }, data: input, timeout: 180000 })
  expect(r.ok(), await r.text()).toBeTruthy(); return (await r.json()).result
}
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()
const form = (scope: Page | ReturnType<Page['locator']>, button: string) => scope.locator('form').filter({ has: ('page' in scope && typeof scope.page === 'function' ? scope.page() : (scope as Page)).getByRole('button', { name: button, exact: true }) })
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0) }
const openCard = async (card: ReturnType<Page['locator']>) => { if (!(await card.evaluate((el) => (el as HTMLDetailsElement).open))) await card.locator('summary').first().click() }

test('allocation, market and exclusivity enforcement, recognition and a synthetic public profile in a real browser', async ({ browser }) => {
  const pool = new Pool({ connectionString: databaseUrl })
  const founder = await browser.newContext(), a = await browser.newContext(), b = await browser.newContext(), visitor = await browser.newContext()
  const founderPage = await founder.newPage(), pageA = await a.newPage(), pageB = await b.newPage()
  const suffix = Date.now().toString(36), today = new Date().toISOString().slice(0, 10)
  const emailA = `b0-a-${suffix}@example.invalid`, emailB = `b0-b-${suffix}@example.invalid`, nameA = `DEMO B0 A ${suffix}`, nameB = `DEMO B0 B ${suffix}`
  await mkdir(evidence, { recursive: true })
  for (const [name, pg] of [['founder', founderPage], ['partnerA', pageA], ['partnerB', pageB]] as const) pg.on('response', async (r) => { if (r.url().includes('/api/') && r.request().method() === 'POST' && r.status() >= 429) console.log(`NON-OK ${name} POST ${r.url().replace(/^.*\/api/, '/api')} ${r.status()} ${(await r.text().catch(() => '')).slice(0, 120)}`) })
  try {
    admin()
    // ---- [SQL] clean slate for this journey (disposable database only)
    await pool.query('truncate expansion_profile_publications,expansion_profile_versions,expansion_profile_slugs,expansion_recognition_corrections,expansion_recognition_fulfilments,expansion_recognition_benefits,expansion_recognition_evidence,expansion_recognitions,expansion_candidate_events,expansion_candidate_exclusivity_decisions,expansion_research_candidates cascade')
    await pool.query('truncate expansion_markets cascade'); await pool.query("update expansion_exclusivities set status='ended',ended_at=now() where status='active'")
    await pool.query('truncate expansion_suppressions'); await pool.query('truncate expansion_qualification_flags,expansion_referral_rewards,expansion_referrals,expansion_referral_codes,expansion_achievement_rewards,expansion_client_qualifications,expansion_achievement_milestones,expansion_achievement_programmes cascade')
    await pool.query('delete from login_rate_limits'); await pool.query('delete from web_rate_limits')
    for (const [name, email] of [[nameA, emailA], [nameB, emailB]]) await pool.query("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'DEMO','Demonstration only','Isolated acceptance only','test-reviewed-v1','onboarding',now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}')", [name, email])
    await login(founderPage, 'expansion-founder@example.invalid')
    // [API] GB (operating market) and IE (a customer market) are founder-approved. NL is deliberately never approved.
    for (const [countryCode, countryName] of [['GB', 'United Kingdom'], ['IE', 'Ireland']]) await command(founder, { action: 'set_market', countryCode, countryName, status: 'approved', planKeys: ['standard-v2'], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: 'DEMO synthetic market approval (set-up)' }, true)
    for (const [email, ctx] of [[emailA, a], [emailB, b]] as const) {
      const app = (await snapshot(founder, true)).workspace.applications.find((x: { email: string }) => x.email === email)
      const invite = await command(founder, { action: 'invite', id: app.id, agreementVersion: 'demo-approved-v1' }, true)
      const activated = await ctx.request.post(`${admin()}/api/partner/activate`, { headers: { origin: admin() }, data: { token: invite.invitationToken, password } }); expect(activated.ok(), await activated.text()).toBeTruthy()
    }
    await login(pageA, emailA); await login(pageB, emailB)
    const partners = (await snapshot(founder, true)).workspace.partners
    const partnerA = partners.find((p: { email: string }) => p.email === emailA), partnerB = partners.find((p: { email: string }) => p.email === emailB)
    expect(partnerA.operating_country).toBe('GB')
    const client = (await snapshot(founder, true)).workspace.clients.find((c: { name: string }) => c.name === 'DEMO Expansion Client')

    // ================= Researched prospect allocation =================
    const business = (tag: string) => `DEMO B0 Research ${tag} ${suffix}`
    const domain = (tag: string) => `demo-b0-${tag}-${suffix}.example`
    await founderPage.goto(`${admin()}/expansion`); await tab(founderPage, 'Research & allocation')
    async function createCandidate(tag: string, over: Record<string, string> = {}) {
      const f = form(founderPage, 'Create candidate')
      const v = { businessName: business(tag), website: domain(tag), industry: 'DEMO B0 trade', country: 'IE', region: 'DEMO County', area: 'DEMO Area', publicSource: 'DEMO public business directory listing', researchedOn: today, partnerNotes: `Public notes for ${tag}: a small local business with a dated website.`, internalNotes: `INTERNAL founder-only note ${tag}`, ...over }
      for (const [k, val] of Object.entries(v)) await f.locator(`[name=${k}]`).fill(val)
      await f.getByRole('button', { name: 'Create candidate', exact: true }).click()
      const card = founderPage.locator('details.ex-resource').filter({ hasText: v.businessName })
      await expect(card).toHaveCount(1); await card.locator('summary').click(); return card
    }
    const screen = async (card: ReturnType<Page['locator']>) => { const f = form(card, 'Record marketing screening'); await f.locator('select[name=outcome]').selectOption('evidenced'); await f.locator('textarea[name=evidence]').fill('DEMO screening: public marketing consent position reviewed by a founder.'); await f.getByRole('button', { name: 'Record marketing screening', exact: true }).click() }
    // [UI] a researched business: screening is mandatory and never automatic
    const c1 = await createCandidate('one')
    await expect(c1).toContainText('Marketing screening: Pending'); await expect(c1).toContainText('Marketing screening evidence has not been recorded.')
    await form(c1, 'Mark eligible (re-runs every check)').getByRole('button', { name: 'Mark eligible (re-runs every check)', exact: true }).click()
    await expect(form(c1, 'Mark eligible (re-runs every check)').locator('.ex-form-error')).toContainText('Not eligible yet')
    await screen(c1); await form(c1, 'Mark eligible (re-runs every check)').getByRole('button', { name: 'Mark eligible (re-runs every check)', exact: true }).click()
    await expect(c1.locator('summary .ex-badge').first()).toHaveText('Eligible')
    await founderPage.screenshot({ path: `${evidence}/founder-research-eligible.png`, fullPage: true })
    // [UI] allocate candidate one to partner A now, before any restriction exists (a later restriction would be seen at allocation and refuse it)
    await openCard(c1)
    const alloc = form(c1, 'Allocate to a partner'); await alloc.locator('select[name=partnerId]').selectOption(partnerA.id); await alloc.getByRole('button', { name: 'Allocate to a partner', exact: true }).click()
    await expect(c1.locator('summary')).toContainText(nameA); await expect(c1).toContainText('Allocated')
    // [UI] partner A sees the allocated prospect with the authorised research, never the internal notes, and continues in the normal workflow
    await pageA.reload(); await tab(pageA, 'Prospects & pipeline')
    await pageA.getByRole('button', { name: new RegExp(business('one')) }).click()
    const panel = pageA.getByLabel('Allocated research')
    await expect(panel).toContainText('not'); await expect(panel).toContainText('lead, an enquiry or a qualified or interested customer'); await expect(panel).toContainText('DEMO public business directory listing'); await expect(panel).toContainText('Public notes for one')
    expect(await pageA.locator('body').innerText()).not.toContain('INTERNAL'); expect(await pageA.locator('body').innerText()).not.toMatch(/exclusiv/i)
    await pageA.screenshot({ path: `${evidence}/partner-allocated-desktop.png`, fullPage: true })
    await pageA.setViewportSize({ width: 390, height: 844 }); await pageA.reload(); await tab(pageA, 'Prospects & pipeline'); await pageA.getByRole('button', { name: new RegExp(business('one')) }).click()
    await noOverflow(pageA); await pageA.screenshot({ path: `${evidence}/partner-allocated-mobile-390.png`, fullPage: true }); await pageA.setViewportSize({ width: 1440, height: 1000 })
    await pageB.reload(); await tab(pageB, 'Prospects & pipeline'); await expect(pageB.getByRole('button', { name: new RegExp(business('one')) })).toHaveCount(0)
    // [UI] the allocated prospect continues through the canonical CRM: discovery is saved by the partner
    await pageA.reload(); await tab(pageA, 'Prospects & pipeline'); await pageA.getByRole('button', { name: new RegExp(business('one')) }).click()
    const disc = form(pageA, 'Save discovery draft')
    for (const [k, v] of Object.entries({ objectives: 'DEMO more enquiries', pages: 'Five pages', functionality: 'Enquiry form', budget: 'Standard subject to approval', timescale: 'Assessed availability', decisionProcess: 'Owner approval' })) await disc.locator(`textarea[name=${k}]`).fill(v)
    await disc.getByRole('button', { name: 'Save discovery draft', exact: true }).click()
    await expect.poll(async () => (await snapshot(a)).workspace.opportunities.find((r: { business_name: string }) => r.business_name === business('one'))?.discovery?.objectives).toBe('DEMO more enquiries')
    // [UI] market restriction: NL is not approved, so research is recorded but nothing can be made eligible
    const cNl = await createCandidate('nl', { country: 'NL' }); await screen(cNl)
    await expect(cNl).toContainText('Market: Not approved')
    await form(cNl, 'Mark eligible (re-runs every check)').getByRole('button', { name: 'Mark eligible (re-runs every check)', exact: true }).click()
    await expect(form(cNl, 'Mark eligible (re-runs every check)').locator('.ex-form-error')).toContainText('market is not approved')
    // [UI] suppression: a suppressed domain is blocked everywhere
    await createCandidate('sup')
    await founderPage.getByText('Suppress a business domain').click()
    const supForm = form(founderPage, 'Record suppression'); await supForm.locator('input[name=domain]').fill(domain('sup')); await supForm.locator('textarea[name=reason]').fill('DEMO: business asked not to be approached')
    await supForm.getByRole('button', { name: 'Record suppression', exact: true }).click()
    await expect.poll(async () => (await pool.query('select count(*)::int c from expansion_suppressions where normalized_domain=$1', [domain('sup')])).rows[0].c).toBe(1)
    await founderPage.reload(); await tab(founderPage, 'Research & allocation')
    const cSupReload = founderPage.locator('details.ex-resource').filter({ hasText: business('sup') }); await cSupReload.locator('summary').click(); await expect(cSupReload).toContainText('Suppression: SUPPRESSED')
    // [API] an exclusivity exists; [UI] an uncertain wording match needs a founder review, a confirmed one is restricted
    await command(founder, { action: 'create_exclusivity', clientId: client.id, sector: 'DEMO B0 sector', area: 'DEMO B0 area', contractualReference: 'DEMO accepted agreement clause 9', effectiveFrom: '2020-01-01' }, true)
    await founderPage.reload(); await tab(founderPage, 'Research & allocation')
    const cRev = await createCandidate('review', { industry: 'Entirely different wording', area: 'DEMO B0 area' }); await screen(cRev)
    await expect(cRev).toContainText('Exclusivity: Review required')
    const cRes = await createCandidate('restricted', { industry: 'DEMO B0 sector', area: 'DEMO B0 area' }); await expect(cRes).toContainText('Exclusivity: Restricted'); await expect(cRes.getByRole('button', { name: 'Clear an exclusivity review' })).toHaveCount(0)
    const clear = form(cRev, 'Clear an exclusivity review'); await clear.locator('input[name=reference]').fill('DEMO founder review: different business activity confirmed')
    await clear.getByRole('button', { name: 'Clear an exclusivity review', exact: true }).click()
    await expect(cRev).toContainText('Exclusivity: Cleared by a founder')
    await form(cRev, 'Mark eligible (re-runs every check)').getByRole('button', { name: 'Mark eligible (re-runs every check)', exact: true }).click(); await expect(cRev.locator('summary .ex-badge').first()).toHaveText('Eligible')
    await founderPage.screenshot({ path: `${evidence}/founder-research-exclusivity-review.png`, fullPage: true })
    // [UI] allocate the reviewed candidate to B
    const alloc2 = form(cRev, 'Allocate to a partner'); await alloc2.locator('select[name=partnerId]').selectOption(partnerB.id); await alloc2.getByRole('button', { name: 'Allocate to a partner', exact: true }).click()
    await expect(cRev.locator('summary')).toContainText(nameB)
    await pageB.reload(); await tab(pageB, 'Prospects & pipeline'); await expect(pageB.getByRole('button', { name: new RegExp(business('review')) })).toHaveCount(1)
    // a prospect that was worked on can no longer be released: refused in the UI with a precise message
    await founderPage.reload(); await tab(founderPage, 'Research & allocation')
    const c1b = founderPage.locator('details.ex-resource').filter({ hasText: business('one') }); await c1b.locator('summary').click()
    const rel = form(c1b, 'Release from the partner'); await rel.locator('input[name=note]').fill('DEMO release attempt'); await rel.getByRole('button', { name: 'Release from the partner', exact: true }).click()
    await expect(rel.locator('.ex-form-error')).toContainText('already worked on this prospect')
    // [UI] reassign the unworked prospect from B to A, then release it
    const cRevB = founderPage.locator('details.ex-resource').filter({ hasText: business('review') }); await cRevB.locator('summary').click()
    const re = form(cRevB, 'Reassign to another partner'); await re.locator('select[name=partnerId]').selectOption(partnerA.id); await re.locator('input[name=note]').fill('DEMO better regional fit'); await re.getByRole('button', { name: 'Reassign to another partner', exact: true }).click()
    await expect(cRevB.locator('summary')).toContainText(nameA); await expect(cRevB).toContainText('Reassigned')
    const rl = form(cRevB, 'Release from the partner'); await rl.locator('input[name=note]').fill('DEMO returned to the founder pool'); await rl.getByRole('button', { name: 'Release from the partner', exact: true }).click()
    await expect(cRevB.locator('summary .ex-badge').first()).toHaveText('Eligible'); await expect(cRevB).toContainText('Released')
    await founderPage.screenshot({ path: `${evidence}/founder-allocation-history.png`, fullPage: true })
    await pageA.reload(); await tab(pageA, 'Prospects & pipeline'); await expect(pageA.getByRole('button', { name: new RegExp(business('review')) })).toHaveCount(0)

    await pool.query('delete from web_rate_limits')   // the app's durable 120-per-minute founder limit is production behaviour; the journey resets it between sections
    // ================= Market and exclusivity at partner progression [UI] =================
    await tab(pageA, 'Prospects & pipeline')
    const reg = form(pageA, 'Register business'); await reg.getByLabel('Business name', { exact: true }).fill(business('nl-own')); await reg.getByLabel('Business website', { exact: true }).fill(domain('nl-own')); await reg.locator('input[name=country]').fill('NL')
    await reg.getByRole('button', { name: 'Register business', exact: true }).click()
    await pageA.getByRole('button', { name: new RegExp(business('nl-own')) }).click()
    const d2 = form(pageA, 'Save discovery draft'); for (const k of ['objectives', 'pages', 'functionality', 'budget', 'timescale', 'decisionProcess']) await d2.locator(`textarea[name=${k}]`).fill('DEMO')
    await d2.getByRole('button', { name: 'Save discovery draft', exact: true }).click()
    await expect(d2.locator('.ex-form-error')).toContainText('awaiting commercial approval from a founder')
    await pageA.screenshot({ path: `${evidence}/partner-market-restricted.png`, fullPage: true })

    await pool.query('delete from web_rate_limits')   // the app's durable 120-per-minute founder limit is production behaviour; the journey resets it between sections
    // ================= Founding Partner recognition =================
    await tab(founderPage, 'Recognition')
    const nom = form(founderPage, 'Record nomination'); await nom.locator('select[name=partnerId]').selectOption(partnerA.id); await nom.locator('textarea[name=rationale]').fill('DEMO nomination for sustained contribution to the programme.')
    await nom.getByRole('button', { name: 'Record nomination', exact: true }).click()
    const nomCard = founderPage.locator('details.ex-resource').filter({ hasText: nameA }); await expect(nomCard).toHaveCount(1); await nomCard.locator('summary').click()
    const premature = form(nomCard, 'Start review'); await premature.getByRole('button', { name: 'Start review', exact: true }).click()
    await expect(nomCard.locator('summary .ex-badge').first()).toHaveText('Under review')
    const dec = form(nomCard, 'Record decision'); await dec.locator('select[name=decision]').selectOption('approved'); await dec.locator('textarea[name=note]').fill('DEMO approved on reviewed evidence.')
    await dec.getByRole('button', { name: 'Record decision', exact: true }).click()
    await expect(dec.locator('.ex-form-error')).toContainText('supporting evidence')       // the database refuses approval without evidence
    const ev = form(nomCard, 'Add evidence'); await ev.locator('textarea[name=description]').fill('DEMO reviewed introductions and support given to other partners.'); await ev.getByRole('button', { name: 'Add evidence', exact: true }).click()
    await expect(nomCard).toContainText('DEMO reviewed introductions')
    await dec.getByRole('button', { name: 'Record decision', exact: true }).click(); await expect(nomCard.locator('summary .ex-badge').first()).toHaveText('Approved')
    const ben = form(nomCard, 'Approve a benefit'); await ben.locator('input[name=benefit]').fill('Equity in the company'); await ben.getByRole('button', { name: 'Approve a benefit', exact: true }).click()
    await expect(ben.locator('.ex-form-error')).toContainText('must not suggest equity'); await ben.locator('input[name=benefit]').fill('Invitation to a partner roundtable'); await ben.getByRole('button', { name: 'Approve a benefit', exact: true }).click()
    await expect(nomCard).toContainText('Invitation to a partner roundtable')
    await founderPage.screenshot({ path: `${evidence}/founder-recognition.png`, fullPage: true })
    await pageA.setViewportSize({ width: 1440, height: 1000 }); await pageA.reload(); await tab(pageA, 'Achievements')
    await expect(pageA.getByRole('heading', { name: 'ScaleSmiths Founding Partner' })).toBeVisible(); await expect(pageA.getByRole('img', { name: /ScaleSmiths Founding Partner/ })).toBeVisible()
    await expect(pageA.getByText('does not confer equity, ownership, directorship, employment or any guaranteed income')).toBeVisible(); await expect(pageA.getByText('Invitation to a partner roundtable')).toBeVisible()
    await pageA.screenshot({ path: `${evidence}/partner-founding-partner-desktop.png`, fullPage: true })
    await pageA.setViewportSize({ width: 390, height: 844 }); await pageA.reload(); await tab(pageA, 'Achievements'); await noOverflow(pageA); await pageA.screenshot({ path: `${evidence}/partner-founding-partner-mobile-390.png`, fullPage: true }); await pageA.setViewportSize({ width: 1440, height: 1000 })
    await pageB.reload(); await tab(pageB, 'Achievements'); await expect(pageB.getByRole('heading', { name: 'ScaleSmiths Founding Partner' })).toHaveCount(0)

    await pool.query('delete from web_rate_limits')   // the app's durable 120-per-minute founder limit is production behaviour; the journey resets it between sections
    // ================= Personal partner web pages =================
    // [API]+[SQL] Entitlement set-up: the five-qualifying-clients path is proven on real PostgreSQL (integration suite 5E). Here an approved programme version
    // and an approved personal-webpage reward are created directly in the disposable database so the browser journey can focus on the profile workflow.
    const prog = await command(founder, { action: 'create_programme', label: `DEMO B0 profile programme ${suffix}` }, true)
    await command(founder, { action: 'approve_programme', version: prog.version, approvalReference: 'DEMO synthetic programme approval' }, true)
    const founderId = (await pool.query("select id from admin_users where email='expansion-founder@example.invalid'")).rows[0].id
    for (const p of [partnerA, partnerB]) {
      const c = await pool.connect()
      try { await c.query('begin'); await c.query("set local session_replication_role = replica")
        await c.query("insert into expansion_achievement_rewards(id,partner_id,programme_version,milestone_clients,kind,reward_pence,label,status,reviewed_by,review_note) values(gen_random_uuid(),$1,$2,5,'webpage',0,'Personal ScaleSmiths webpage','approved',$3,'DEMO synthetic entitlement set-up')", [p.id, prog.version, founderId]); // current entitlement is part of the public projection: five founder-qualified clients per partner (synthetic rows; FK triggers are off in replica mode)
        for (let i = 0; i < 5; i++) await c.query("insert into expansion_client_qualifications(id,partner_id,client_id,contract_id,status,net_collected_pence,note,decided_by) values(gen_random_uuid(),$1,$2,gen_random_uuid(),'qualified',100000,'DEMO synthetic set-up',$3)", [p.id, 900000 + Math.floor(Math.random() * 90000000) + i, founderId])
        await c.query('commit') }
      finally { c.release() }
    }
    await pageA.reload(); await tab(pageA, 'My partner page')
    const draft = form(pageA, 'Start a draft')
    await draft.locator('input[name=displayName]').fill(`Synthetic Partner ${suffix}`); await draft.locator('input[name=operatingArea]').fill('Synthetic Testshire')
    await draft.locator('textarea[name=biography]').fill('Write to me at someone@example.com and I will gladly help you with any project you have in mind today.')
    await draft.getByRole('button', { name: 'Start a draft', exact: true }).click(); await expect(draft.locator('.ex-form-error')).toContainText('must not contain email addresses')
    await draft.locator('textarea[name=biography]').fill('A fictional independent partner created only to demonstrate the ScaleSmiths partner page, its consent step and the founder review.')
    await draft.getByRole('button', { name: 'Start a draft', exact: true }).click()
    await expect.poll(async () => (await pool.query("select count(*)::int c from expansion_profile_versions v join expansion_partners p on p.id=v.partner_id where p.id=$1", [partnerA.id])).rows[0].c).toBe(1)
    await pageA.reload(); await tab(pageA, 'My partner page')
    const submitEarly = form(pageA, 'Submit for founder review'); await submitEarly.getByRole('button', { name: 'Submit for founder review', exact: true }).click()
    await expect(submitEarly.locator('.ex-form-error')).toContainText('Record your publication consent')
    const consent = form(pageA, 'Record my consent'); await consent.getByRole('button', { name: 'Record my consent', exact: true }).click(); await expect(consent.locator('.ex-form-error')).toBeVisible()   // the statement must be accepted
    await consent.getByLabel('I have read and agree to the statement above').check(); await consent.getByRole('button', { name: 'Record my consent', exact: true }).click()
    await expect(pageA.getByText(/Consent recorded for the current wording/)).toBeVisible()
    await form(pageA, 'Submit for founder review').getByRole('button', { name: 'Submit for founder review', exact: true }).click()
    await expect(pageA.getByText('With a founder for review')).toBeVisible()
    await pageA.screenshot({ path: `${evidence}/partner-profile-submitted.png`, fullPage: true })
    // [UI] founder reviews and approves; approval alone publishes nothing
    await founderPage.reload(); await tab(founderPage, 'Web pages'); const vCard = founderPage.locator('details.ex-resource').filter({ hasText: `Synthetic Partner ${suffix}` }); await expect(vCard).toHaveCount(1)
    const rev = form(vCard, 'Record review decision'); await rev.locator('select[name=decision]').selectOption('approved'); await rev.locator('textarea[name=note]').fill('DEMO content reviewed: no contact details, no claims.'); await rev.getByRole('button', { name: 'Record review decision', exact: true }).click()
    await expect(vCard.locator('summary .ex-badge').first()).toHaveText('Approved')
    const slug = `synthetic-${suffix}`
    expect((await (await visitor.request.get(`${web()}/partners/${slug}`)).status())).toBe(404)
    await openCard(vCard)
    const pub = form(vCard, 'Publish this version'); await pub.locator('input[name=slug]').fill('admin'); await pub.getByRole('button', { name: 'Publish this version', exact: true }).click(); await expect(pub.locator('.ex-form-error')).toBeVisible()   // reserved word
    await pub.locator('input[name=slug]').fill(slug); await pub.locator('textarea[name=achievements]').fill('Personal webpage recognition\nFounding Partner'); await pub.getByRole('button', { name: 'Publish this version', exact: true }).click()
    await expect.poll(async () => (await pool.query("select count(*)::int c from expansion_profile_publications where slug=$1 and status='live'", [slug])).rows[0].c).toBe(1)
    await founderPage.screenshot({ path: `${evidence}/founder-profile-published.png`, fullPage: true })
    // [UI] the synthetic public page, anonymous visitor, desktop and mobile
    const pub1 = await visitor.newPage(); const response = await pub1.goto(`${web()}/partners/${slug}`); expect(response?.status()).toBe(200)
    expect(response?.headers()['cache-control'] ?? '').toMatch(/no-store|no-cache|private/)
    await expect(pub1.getByRole('heading', { name: `Synthetic Partner ${suffix}`, level: 1 })).toBeVisible(); await expect(pub1.getByText('Verified ScaleSmiths partner')).toBeVisible()
    await expect(pub1.getByRole('img', { name: /Founding Partner, recognised/ })).toBeVisible(); await expect(pub1.getByText('Personal webpage recognition')).toBeVisible()
    expect(await pub1.locator('meta[name=robots]').getAttribute('content')).toMatch(/noindex/)
    const html = await pub1.content(); for (const forbidden of [emailA, 'commission', 'INTERNAL', partnerA.id, 'someone@example.com']) expect(html).not.toContain(forbidden)
    await pub1.screenshot({ path: `${evidence}/public-profile-desktop.png`, fullPage: true })
    // [SQL] entitlement lapses: the page is suspended on the very next request (no stale cache), and returns when entitlement is restored; the records stay
    const lapse = async (status: string) => { const c = await pool.connect(); try { await c.query('begin'); await c.query('set local session_replication_role = replica'); await c.query("update expansion_client_qualifications set status=$2, revoked_by=case when $2='revoked' then $3::uuid end, revoked_at=case when $2='revoked' then now() end, revoke_reason=case when $2='revoked' then 'DEMO synthetic lapse' end where id=(select id from expansion_client_qualifications where partner_id=$1 order by id limit 1)", [partnerA.id, status, founderId]); await c.query('commit') } finally { c.release() } }
    await lapse('revoked'); expect((await visitor.request.get(`${web()}/partners/${slug}`)).status()).toBe(404)
    expect((await pool.query("select status from expansion_profile_publications where slug=$1", [slug])).rows[0].status).toBe('live')
    await lapse('qualified'); expect((await visitor.request.get(`${web()}/partners/${slug}`)).status()).toBe(200)
    await pub1.setViewportSize({ width: 390, height: 844 }); await pub1.reload(); await noOverflow(pub1); await pub1.screenshot({ path: `${evidence}/public-profile-mobile-390.png`, fullPage: true })
    // [UI] partner revocation removes the page at once, on the next request
    await tab(founderPage, 'Recruitment'); const row = founderPage.locator('.ex-resource').filter({ hasText: emailA })
    await row.getByRole('button', { name: 'Revoke access and sessions', exact: true }).click()
    await expect.poll(async () => (await visitor.request.get(`${web()}/partners/${slug}`)).status()).toBe(404)
    // Partner B: [API] draft, consent, submission, review, publication. [UI] the PARTNER withdraws consent and the page goes at once, with no founder.
    const slugB = `synthetic-b-${suffix}`
    const publishB = async (tag: string) => {
      const v = await command(b, { action: 'save_profile_draft', displayName: `Synthetic Partner B ${suffix}`, biography: `A second fictional partner used to demonstrate removal of a published page, version ${tag}, straight away.`, operatingArea: 'Synthetic Testshire' })
      await command(b, { action: 'record_profile_consent', versionId: v.versionId, accept: true }); await command(b, { action: 'submit_profile', versionId: v.versionId })
      await command(founder, { action: 'review_profile', versionId: v.versionId, decision: 'approved', note: 'DEMO approved' }, true)
      await command(founder, { action: 'publish_profile', versionId: v.versionId, slug: slugB }, true)
    }
    await publishB('one')
    expect((await visitor.request.get(`${web()}/partners/${slugB}`)).status()).toBe(200)
    await pageB.reload(); await tab(pageB, 'My partner page')
    await pageB.getByRole('button', { name: 'Withdraw my consent and remove my page', exact: true }).click()
    await expect.poll(async () => (await visitor.request.get(`${web()}/partners/${slugB}`)).status()).toBe(404)
    await pageB.screenshot({ path: `${evidence}/partner-profile-withdrawn.png`, fullPage: true })
    // A newer version for the same address is published, then a FOUNDER removes it in the UI.
    await publishB('two')
    expect((await visitor.request.get(`${web()}/partners/${slugB}`)).status()).toBe(200)
    await founderPage.reload(); await tab(founderPage, 'Web pages')
    const pubRow = founderPage.locator('.ex-resource').filter({ hasText: `/partners/${slugB}` }).filter({ has: founderPage.getByRole('button', { name: 'Remove from public view' }) })
    const removal = form(pubRow, 'Remove from public view'); await removal.locator('textarea[name=reason]').fill('DEMO removed by a founder'); await removal.getByRole('button', { name: 'Remove from public view', exact: true }).click()
    await expect.poll(async () => (await visitor.request.get(`${web()}/partners/${slugB}`)).status()).toBe(404)
    await founderPage.screenshot({ path: `${evidence}/founder-profile-revoked.png`, fullPage: true })
  } finally { await pool.end(); await Promise.all([founder.close(), a.close(), b.close(), visitor.close()]) }
})
