import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import pg from 'pg'
import { generateTotp } from '../../src/lib/server/mfa'
const { Pool } = pg

/**
 * Authenticated Scale Your Future acceptance. Runs only against an explicit disposable loopback stack:
 * EXPANSION_ADMIN_BASE_URL (http://localhost:3103) and EXPANSION_TEST_DATABASE_URL (…/ss_expansion_hardening_browser).
 * Steps marked [API] use authenticated founder/partner API commands for set-up or to reach already UI-proven forms;
 * steps marked [UI] drive the real screens. Nothing here sends email, contacts a prospect or moves money.
 */
const adminOrigin = process.env.EXPANSION_ADMIN_BASE_URL
const databaseUrl = process.env.EXPANSION_TEST_DATABASE_URL
test.skip(!adminOrigin || !databaseUrl, 'An explicit disposable admin server and database are required.')
const password = 'Expansion-Demo-Only-2026'
const evidence = '../docs/expansion/intelligence/evidence/programme'
function origin() {
  const url = new URL(adminOrigin || 'invalid:'); const db = new URL(databaseUrl || 'invalid:')
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '3103' || db.pathname !== '/ss_expansion_hardening_browser') throw new Error('Refusing browser mutations outside the explicit disposable stack.')
  return url.origin
}
async function login(page: Page, email: string) {
  await page.goto(`${origin()}/login`)
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  if (email === 'expansion-founder@example.invalid') await page.getByLabel(/^Authenticator code/).fill(generateTotp('JBSWY3DPEHPK3PXP'))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(/\/(partner|command-centre)$/)
}
const snapshot = async (c: BrowserContext, founder = false) => { const r = await c.request.get(`${origin()}/api/${founder ? 'expansion' : 'partner'}`); expect(r.ok(), await r.text()).toBeTruthy(); return r.json() }
async function command(c: BrowserContext, input: Record<string, unknown>, founder = false) {
  const r = await c.request.post(`${origin()}/api/${founder ? 'expansion' : 'partner'}`, { headers: { origin: origin() }, data: input, timeout: 180000 })
  expect(r.ok(), await r.text()).toBeTruthy(); return (await r.json()).result
}
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()
async function noOverflow(page: Page) { expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0) }

test('founder and partner complete the discounted, withdrawal and isolation journey in a real browser', async ({ browser }) => {
  const pool = new Pool({ connectionString: databaseUrl })
  const founder = await browser.newContext(), a = await browser.newContext(), b = await browser.newContext()
  const founderPage = await founder.newPage(), partnerPage = await a.newPage(), otherPage = await b.newPage()
  const suffix = Date.now().toString(36)
  const emailA = `programme-a-${suffix}@example.invalid`, emailB = `programme-b-${suffix}@example.invalid`
  await mkdir(evidence, { recursive: true })
  try {
    origin() // asserts the disposable database name before any mutation
    await pool.query('truncate expansion_withdrawal_policies cascade'); await pool.query('update expansion_plan_settings set enabled=false')
    await pool.query('truncate expansion_markets cascade'); await pool.query("update expansion_exclusivities set status='ended',ended_at=now() where status='active'")
    await pool.query('truncate expansion_reservations,expansion_capacity')
    await pool.query('delete from login_rate_limits')
    // ---- Set-up [API]: synthetic applicants -> reviewed -> invited -> activated; both then log in through the real login screen [UI]
    for (const [name, email] of [[`DEMO Programme A ${suffix}`, emailA], [`DEMO Programme B ${suffix}`, emailB]]) {
      await pool.query("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'DEMO','Demonstration only','Isolated acceptance only','test-reviewed-v1','onboarding',now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}')", [name, email])
    }
    await login(founderPage, 'expansion-founder@example.invalid')
    for (const [email, ctx] of [[emailA, a], [emailB, b]] as const) {
      const app = (await snapshot(founder, true)).workspace.applications.find((x: { email: string }) => x.email === email)
      await command(founder, { action: 'review_application', id: app.id, status: 'onboarding', notes: 'DEMO reviewed prerequisites.', legal: true, agreement: true, independentStatus: true, operations: true }, true)
      const invite = await command(founder, { action: 'invite', id: app.id, agreementVersion: 'demo-approved-v1' }, true)
      const activated = await ctx.request.post(`${origin()}/api/partner/activate`, { headers: { origin: origin() }, data: { token: invite.invitationToken, password } })
      expect(activated.ok(), await activated.text()).toBeTruthy()
    }
    await login(partnerPage, emailA); await login(otherPage, emailB)
    await founderPage.goto(`${origin()}/expansion`)
    const partnerA = (await snapshot(founder, true)).workspace.partners.find((p: { email: string }) => p.email === emailA)

    // ---- [UI] Commission Centre before any policy: honest unavailable state
    await tab(partnerPage, 'Commission centre')
    await expect(partnerPage.getByText('no payout policy has been approved')).toBeVisible()
    await expect(partnerPage.getByText('not a bank account, wallet or safeguarded deposit')).toBeVisible()
    await expect(partnerPage.getByText('No discount allowance has been approved for you')).toBeVisible()
    await partnerPage.screenshot({ path: `${evidence}/partner-commission-centre-unavailable.png`, fullPage: true })

    // ---- [UI] Founder enables the standard-v2 plan and approves a £1,500 allowance for partner A
    await tab(founderPage, 'Commission centre')
    const planRow = founderPage.locator('.ex-list-row').filter({ hasText: 'standard-v2' }).first()
    await expect(planRow).toContainText('Disabled')
    await planRow.getByLabel('Reason and approval reference').fill('DEMO founder approval of the standard-v2 plan for this isolated test')
    await planRow.getByRole('button', { name: 'Enable plan' }).click()
    await expect(founderPage.locator('.ex-list-row').filter({ hasText: 'standard-v2' }).first()).toContainText('Enabled')
    await founderPage.getByText('Set or change an allowance').click()
    const policyForm = founderPage.locator('form').filter({ has: founderPage.getByRole('button', { name: 'Save allowance' }) })
    await policyForm.locator('select[name=partnerId]').selectOption(partnerA.id)
    await policyForm.locator('input[name=periodStart]').fill('2026-01-01'); await policyForm.locator('input[name=periodEnd]').fill('2099-01-01')
    await policyForm.locator('input[name=allowanceCount]').fill('1'); await policyForm.locator('input[name=feesCsv]').fill('150000')
    await policyForm.locator('input[name=approvalReference]').fill('DEMO allowance approval')
    await policyForm.getByRole('button', { name: 'Save allowance' }).click()
    await expect(founderPage.getByText('0 of 1 used')).toBeVisible()
    await founderPage.screenshot({ path: `${evidence}/founder-plans-and-allowances.png`, fullPage: true })

    // ---- [UI] Partner registers the prospect and submits scope; [UI] founder assesses capacity and approves scope
    const business = `DEMO Programme Business ${suffix}`
    await tab(partnerPage, 'Register prospect')
    await partnerPage.getByLabel('Business name', { exact: true }).fill(business)
    await partnerPage.getByLabel('Business website', { exact: true }).fill(`demo-programme-${suffix}.example`)
    await partnerPage.locator('input[name=country]').fill('FR')
    await partnerPage.getByRole('button', { name: 'Register business', exact: true }).click()
    await expect.poll(async () => (await snapshot(a)).workspace.opportunities.some((r: { business_name: string }) => r.business_name === business)).toBe(true)
    const opp = (await snapshot(a)).workspace.opportunities.find((r: { business_name: string }) => r.business_name === business)
    await command(a, { action: 'discovery', id: opp.id, discovery: { objectives: 'DEMO enquiries', pages: 'Five pages', functionality: 'Enquiry form', budget: 'Standard subject to approval', timescale: 'Assessed availability', decisionProcess: 'Owner approval' } })
    await command(a, { action: 'submit_scope', id: opp.id, summary: 'DEMO five pages and an enquiry form.' })
    await tab(founderPage, 'Delivery capacity')
    await founderPage.getByLabel('Week starting (Monday)', { exact: true }).fill('2099-01-05')
    await founderPage.getByLabel('Available partner delivery hours', { exact: true }).fill('100')
    await founderPage.getByLabel('Assessment and existing commitments', { exact: true }).fill('DEMO isolated allocation')
    await founderPage.getByLabel('I reviewed existing projects, retainers and founder commitments', { exact: true }).check()
    await founderPage.getByRole('button', { name: 'Save assessed allocation', exact: true }).click()
    await expect(founderPage.getByText('Week of 2099-01-05', { exact: true })).toBeVisible()
    await founderPage.reload(); await tab(founderPage, 'Prospects & scope')
    await founderPage.getByRole('button', { name: new RegExp(business) }).click()
    await founderPage.locator('summary').filter({ hasText: 'Scope submission and approval' }).click()
    await founderPage.locator('select[name=decision]').selectOption('approved')
    await founderPage.getByLabel('Technical feasibility, effort, risks, pricing and commercial terms', { exact: true }).fill('DEMO feasibility reviewed')
    await founderPage.locator('select[name=period]').selectOption('2099-01-05')
    await founderPage.getByLabel('Reservation hours (approval only)', { exact: true }).fill('10')
    await founderPage.getByLabel('Technical scope and delivery effort approved', { exact: true }).check()
    await founderPage.getByLabel('Pricing and commercial terms approved', { exact: true }).check()
    await founderPage.getByRole('button', { name: 'Record scope review', exact: true }).click()

    // ---- [UI] Reserve the discount, then accept the contract through the plan selector (no JSON, no manual milestones)
    await founderPage.locator('input[name=feePence]').fill('150000')
    await founderPage.locator('form').filter({ has: founderPage.getByRole('button', { name: 'Reserve discount allowance' }) }).locator('input[name=reason]').fill('DEMO approved £1,500 build')
    await founderPage.getByRole('button', { name: 'Reserve discount allowance' }).click()
    await expect.poll(async () => (await snapshot(a)).workspace.discountAllowances[0]?.used).toBe(1)
    const client = (await snapshot(founder, true)).workspace.clients.find((c: { name: string }) => c.name === 'DEMO Expansion Client')
    const fillAccept = async () => {
      const accept = founderPage.locator('form').filter({ has: founderPage.getByRole('button', { name: 'Record accepted contract' }) })
      await accept.locator('select[name=clientId]').selectOption(String(client.id))
      await accept.locator('input[name=agreementReference]').fill(`DEMO accepted agreement ${suffix}`)
      await accept.locator('select[name=planKey]').selectOption('standard-v2')
      await accept.locator('select[name=scheduleId]').selectOption('equal')
      await accept.locator('input[name=buildFeePence]').fill('150000')
      return accept
    }
    // [UI] Case M: the customer's market (FR) is unapproved, so acceptance is refused in the browser
    let accept = await fillAccept()
    await accept.getByRole('button', { name: 'Record accepted contract' }).click()
    await expect(founderPage.getByRole('alert').filter({ hasText: 'customer market is not approved' })).toBeVisible()
    expect((await pool.query('select count(*)::int c from expansion_contracts where opportunity_id=$1', [opp.id])).rows[0].c).toBe(0)
    await founderPage.screenshot({ path: `${evidence}/founder-market-blocked.png`, fullPage: true })
    // [UI] A founder approves France for standard-v2 after recording every review
    await tab(founderPage, 'Commission centre')
    await founderPage.getByText('Set a market status').click()
    const market = founderPage.locator('form').filter({ has: founderPage.getByRole('button', { name: 'Save market' }) })
    await market.locator('input[name=countryCode]').fill('FR'); await market.locator('input[name=countryName]').fill('France')
    await market.locator('select[name=status]').selectOption('approved'); await market.locator('input[name="plan_standard-v2"]').check()
    for (const name of ['legalReviewed', 'accountingReviewed', 'privacyReviewed', 'operationsReviewed']) await market.locator(`input[name=${name}]`).check()
    await market.locator('input[name=approvalReference]').fill('DEMO synthetic market approval')
    await market.getByRole('button', { name: 'Save market' }).click()
    await expect(founderPage.locator('.ex-list-row').filter({ hasText: 'France (FR)' })).toContainText('Approved')
    await founderPage.screenshot({ path: `${evidence}/founder-markets.png`, fullPage: true })
    await tab(founderPage, 'Prospects & scope'); await founderPage.getByRole('button', { name: new RegExp(business) }).click()
    accept = await fillAccept()
    await founderPage.screenshot({ path: `${evidence}/founder-plan-selection.png`, fullPage: true })
    await accept.getByRole('button', { name: 'Record accepted contract' }).click()
    await expect.poll(async () => (await snapshot(founder, true)).workspace.opportunities.find((r: { id: string }) => r.id === opp.id)?.contract_id).toBeTruthy()
    const contractId = (await snapshot(founder, true)).workspace.opportunities.find((r: { id: string }) => r.id === opp.id).contract_id
    const stored = (await pool.query('select terms from expansion_contracts where id=$1', [contractId])).rows[0].terms
    expect(stored.planVersion).toBe('standard-v2.d150000'); expect(stored.commitment).toMatchObject({ buildPence: '150000', minTermMonths: 12 })

    // ---- [API] invoice, allocations and collections; the first collection also goes through the [UI] form. Case E: £225 + £225 + £105
    const inv = await founder.request.post(`${origin()}/api/invoices`, { data: { clientId: client.id, items: [{ title: 'DEMO discounted build and first retainer', quantity: 1, unitAmount: 185000 }] } })
    expect(inv.ok(), await inv.text()).toBeTruthy(); const invoiceId = (await inv.json()).invoice.id
    expect((await founder.request.patch(`${origin()}/api/invoices/${invoiceId}`, { data: { action: 'issue' } })).ok()).toBeTruthy()
    for (const [m, n] of [['deposit', '75000'], ['final', '75000'], ['first_retainer', '35000']]) await command(founder, { action: 'allocate_invoice', contractId, invoiceId, milestone: m, netPence: n, evidenceReference: 'DEMO approved allocation' }, true)
    await tab(founderPage, 'Commission centre')
    const collect = founderPage.locator('form').filter({ has: founderPage.getByRole('button', { name: 'Verify collection and calculate commission', exact: true }) })
    await collect.locator('select[name=contractId]').selectOption(contractId)
    await collect.getByLabel('Issued invoice ID', { exact: true }).fill(String(invoiceId))
    await collect.locator('select[name=milestone]').selectOption('deposit')
    await collect.getByLabel('Unique bank/payment collection reference', { exact: true }).fill(`demo-prog-dep-${suffix}`)
    await collect.getByLabel('Qualifying VAT-exclusive collected pence', { exact: true }).fill('75000')
    await collect.getByLabel('Total collected pence including VAT', { exact: true }).fill('75000')
    await collect.getByLabel('Verified collection evidence reference', { exact: true }).fill('DEMO verified statement, no real collection')
    await collect.getByLabel('I verified the actual collected payment and VAT-exclusive qualifying amount', { exact: true }).check()
    await collect.getByRole('button', { name: 'Verify collection and calculate commission', exact: true }).click()
    await expect.poll(async () => (await snapshot(a)).finance.earnedPence).toBe('22500')
    const pay = (m: string, n: string) => ({ action: 'verify_payment', contractId, invoiceId, milestone: m, reference: `demo-prog-${m}-${suffix}`, netPence: n, grossPence: n, evidenceReference: 'DEMO verified statement', confirmed: true })
    expect((await command(founder, pay('final', '75000'), true)).commissionPence).toBe('22500')
    expect((await command(founder, pay('first_retainer', '35000'), true)).commissionPence).toBe('10500')
    expect((await snapshot(a)).finance.earnedPence).toBe('55500')   // £450 + £105 = £555 (Case E, through the browser-accepted contract)

    // ---- Case H [UI]: partner claims new work for an existing customer; founder approves; canonical client is reused, not duplicated
    const clientsBefore = (await pool.query('select count(*)::int c from clients')).rows[0].c
    const claimBusiness = `DEMO Existing Customer ${suffix}`
    await partnerPage.reload(); await tab(partnerPage, 'Commission centre')
    await partnerPage.getByText('Request attribution for new work with an existing customer').click()
    const claimForm = partnerPage.locator('form').filter({ has: partnerPage.getByRole('button', { name: 'Submit request' }) })
    await claimForm.locator('input[name=businessName]').fill(claimBusiness)
    await claimForm.locator('input[name=website]').fill(`demo-existing-${suffix}.example`)
    await claimForm.locator('input[name=projectLabel]').fill('Booking platform')
    await claimForm.locator('textarea[name=contribution]').fill('DEMO introduced the director and led the booking requirements.')
    await claimForm.getByRole('button', { name: 'Submit request' }).click()
    await expect.poll(async () => (await snapshot(a)).workspace.additionalClaims.length).toBe(1)
    await founderPage.reload(); await tab(founderPage, 'Commission centre')
    const claimRow = founderPage.locator('details.ex-resource').filter({ hasText: claimBusiness })
    await claimRow.locator('summary').click()
    await claimRow.locator('select[name=decision]').selectOption('approved')
    await claimRow.locator('select[name=clientId]').selectOption(String(client.id))
    await claimRow.locator('textarea[name=notes]').fill('DEMO attribution evidence reviewed.')
    await claimRow.locator('input[name=attributionConfirmed]').check()
    await claimRow.getByRole('button', { name: 'Record attribution decision' }).click()
    await expect.poll(async () => (await snapshot(a)).workspace.opportunities.some((r: { business_name: string }) => r.business_name.includes('Booking platform'))).toBe(true)
    expect((await pool.query('select count(*)::int c from clients')).rows[0].c).toBe(clientsBefore)
    await founderPage.screenshot({ path: `${evidence}/founder-additional-claim-approved.png`, fullPage: true })

    // ---- Case L: customer sector exclusivity. [UI] founder records it; [API] set-up of a second matching prospect; [UI] decision
    const protectedName = `DEMO Protected Customer ${suffix}`
    const protectedId = (await pool.query("insert into clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) values($2,$1,'1 Test Street','Nottingham','NG1 1AA','United Kingdom') returning id", [`DP${suffix.toUpperCase().slice(0, 6)}`, protectedName])).rows[0].id
    await founderPage.reload(); await tab(founderPage, 'Commission centre'); await founderPage.getByText('Record an exclusivity').click()
    const exForm = founderPage.locator('form').filter({ has: founderPage.getByRole('button', { name: 'Save exclusivity' }) })
    await exForm.locator('select[name=clientId]').selectOption(String(protectedId))
    await exForm.locator('input[name=sector]').fill('DEMO Sector'); await exForm.locator('input[name=area]').fill('DEMO Area')
    await exForm.locator('input[name=contractualReference]').fill('DEMO accepted agreement clause 9')
    await exForm.locator('input[name=effectiveFrom]').fill('2020-01-01')
    await exForm.getByRole('button', { name: 'Save exclusivity' }).click()
    await expect(founderPage.locator('.ex-list-row').filter({ hasText: protectedName })).toContainText('Active')
    const second = `DEMO Restricted Business ${suffix}`
    const reg2 = await command(a, { action: 'register', businessName: second, website: `demo-restricted-${suffix}.example`, industry: 'DEMO Sector', region: 'DEMO Area', country: 'FR' })
    await command(a, { action: 'discovery', id: reg2.id, discovery: { objectives: 'DEMO', pages: 'Five', functionality: 'Form', budget: 'Standard', timescale: 'Assessed', decisionProcess: 'Owner' } })
    await command(a, { action: 'submit_scope', id: reg2.id, summary: 'DEMO scope.' })
    await command(founder, { action: 'review_scope', id: reg2.id, decision: 'approved', period: '2099-01-05', hours: 5, technicalConfirmed: true, commercialConfirmed: true, notes: 'DEMO reviewed.' }, true)
    await founderPage.reload(); await tab(founderPage, 'Prospects & scope'); await founderPage.getByRole('button', { name: new RegExp(second) }).click()
    await expect(founderPage.getByText('Restricted', { exact: true }).first()).toBeVisible()
    await founderPage.screenshot({ path: `${evidence}/founder-exclusivity-restricted.png`, fullPage: true })
    const blocked = await founder.request.post(`${origin()}/api/expansion`, { headers: { origin: origin() }, data: { action: 'accept_contract', id: reg2.id, clientId: client.id, plan: { plan: 'standard-v2' }, agreementReference: 'DEMO' } })
    expect(blocked.status()).toBe(409); expect(await blocked.text()).toContain('exclusivity'); expect(await blocked.text()).not.toContain(protectedName)
    await partnerPage.reload(); await tab(partnerPage, 'Prospects & scope'); await partnerPage.getByRole('button', { name: new RegExp(second) }).click()
    await expect(partnerPage.getByText('Commercial checks in progress')).toBeVisible()
    expect(JSON.stringify(await snapshot(a))).not.toMatch(/DEMO Protected Customer|clause 9/)
    await founderPage.locator('select[name=exclusivityId]').selectOption({ index: 0 })
    await founderPage.locator('form').filter({ has: founderPage.getByRole('button', { name: 'Record exclusivity decision' }) }).locator('select[name=decision]').selectOption('exception_approved')
    await founderPage.locator('textarea[name=reference]').fill('DEMO founder exception with protected customer consent')
    await founderPage.getByRole('button', { name: 'Record exclusivity decision' }).click()
    await expect.poll(async () => (await snapshot(founder, true)).workspace.exclusivityStatus[reg2.id]).toBe('exception_approved')
    expect((await founder.request.post(`${origin()}/api/expansion`, { headers: { origin: origin() }, data: { action: 'accept_contract', id: reg2.id, clientId: client.id, plan: { plan: 'standard-v2' }, agreementReference: 'DEMO exception accepted' } })).ok()).toBeTruthy()

    // ---- [UI] Founder approves the payout policy; partner requests a withdrawal; founder reviews and prepares payout
    await partnerPage.reload(); await tab(partnerPage, 'Commission centre')
    await expect(partnerPage.getByText('no payout policy has been approved')).toBeVisible()
    await founderPage.reload(); await tab(founderPage, 'Commission centre')
    await founderPage.getByText('Set payout policy').click()
    const policy = founderPage.locator('form').filter({ has: founderPage.getByRole('button', { name: 'Record new policy version' }) })
    await policy.locator('input[name=enabled]').check(); await policy.locator('input[name=invoiceRequired]').check()
    await policy.locator('input[name=approvalReference]').fill('DEMO accounting approval of synthetic payout policy')
    await policy.getByRole('button', { name: 'Record new policy version' }).click()
    await expect(founderPage.getByText(/Policy v\d+: enabled/)).toBeVisible()
    await partnerPage.reload(); await tab(partnerPage, 'Commission centre')
    await expect(partnerPage.getByText('Available to request')).toBeVisible()
    await partnerPage.screenshot({ path: `${evidence}/partner-commission-centre-available.png`, fullPage: true })
    const request = partnerPage.locator('form').filter({ has: partnerPage.getByRole('button', { name: 'Submit withdrawal request' }) })
    await request.locator('input[name=invoiceReference]').fill(`DEMO-PARTNER-INV-${suffix}`)
    await request.getByRole('button', { name: 'Submit withdrawal request' }).click()
    await expect(partnerPage.getByText(/£555\.00 · DEMO-PARTNER-INV/)).toBeVisible()
    const overview = async () => (await snapshot(a)).withdrawals
    expect((await overview()).balances).toMatchObject({ availablePence: '0', requestedPence: '55500' })
    await partnerPage.screenshot({ path: `${evidence}/partner-withdrawal-submitted.png`, fullPage: true })
    await founderPage.reload(); await tab(founderPage, 'Commission centre')
    const row = founderPage.locator('details.ex-resource').filter({ hasText: `DEMO Programme A ${suffix}` }).filter({ hasText: '£555' })
    await row.locator('summary').click()
    await row.locator('select[name=decision]').selectOption('approved')
    await row.locator('textarea[name=note]').fill('DEMO invoice checked; commission verified.')
    await row.getByRole('button', { name: 'Record decision' }).click()
    await expect(founderPage.locator('details.ex-resource').filter({ hasText: `DEMO Programme A ${suffix}` }).first()).toContainText('Approved')
    await founderPage.locator('details.ex-resource').filter({ hasText: `DEMO Programme A ${suffix}` }).first().getByRole('button', { name: 'Prepare payout' }).click()
    const myPayout = async () => (await snapshot(founder, true)).finance.payouts.find((p: { invoice_reference: string }) => p.invoice_reference === `DEMO-PARTNER-INV-${suffix}`)
    await expect.poll(async () => Boolean(await myPayout())).toBe(true)
    await founderPage.screenshot({ path: `${evidence}/founder-withdrawal-review.png`, fullPage: true })
    const payoutId = (await myPayout()).id
    await command(founder, { action: 'approve_payout', payoutId }, true)               // [API] existing, previously UI-proven payout forms
    await command(founder, { action: 'settle_payout', payoutId, settlementReference: `DEMO-SETTLEMENT-${suffix}` }, true)
    await partnerPage.reload(); await tab(partnerPage, 'Commission centre')
    await expect(partnerPage.locator('.ex-list-row').filter({ hasText: 'DEMO-PARTNER-INV' })).toContainText('Paid')
    expect((await overview()).balances).toMatchObject({ earnedPence: '55500', availablePence: '0', paidPence: '55500' })
    await partnerPage.screenshot({ path: `${evidence}/partner-withdrawal-paid.png`, fullPage: true })

    // ---- Isolation and privilege denial (second partner, and partner -> founder actions)
    const bSnapshot = await snapshot(b)
    expect(bSnapshot.workspace.opportunities).toEqual([]); expect(bSnapshot.finance.ledger).toEqual([]); expect(bSnapshot.withdrawals.requests).toEqual([])
    const reqId = (await overview()).requests[0].id
    const cancelOther = await b.request.post(`${origin()}/api/partner`, { headers: { origin: origin() }, data: { action: 'cancel_withdrawal', requestId: reqId } })
    expect(cancelOther.status()).toBe(404)
    for (const data of [{ action: 'review_withdrawal', requestId: reqId, decision: 'approved', note: 'self' }, { action: 'set_withdrawal_policy', enabled: true, invoiceRequired: false, approvalReference: 'x' }, { action: 'set_discount_policy', partnerId: partnerA.id, periodStart: '2026-01-01', periodEnd: '2099-01-01', allowanceCount: 50, permittedFeesPence: [0], approvalReference: 'x' }, { action: 'set_plan_enabled', planKey: 'bespoke-v1', enabled: true, reason: 'x' }]) {
      const denied = await a.request.post(`${origin()}/api/expansion`, { headers: { origin: origin() }, data })
      expect([401, 403]).toContain(denied.status())
    }
    expect((await a.request.get(`${origin()}/api/expansion`)).status()).toBeGreaterThanOrEqual(401)
    expect((await pool.query("select enabled from expansion_plan_settings where plan_key='bespoke-v1'")).rows[0].enabled).toBe(false)

    // ---- Responsive evidence for the Commission Centre
    for (const width of [320, 390, 768, 1024, 1440]) {
      await partnerPage.setViewportSize({ width, height: 900 }); await partnerPage.reload(); await tab(partnerPage, 'Commission centre')
      await expect(partnerPage.getByText('Your requests')).toBeVisible(); await noOverflow(partnerPage)
      await partnerPage.screenshot({ path: `${evidence}/partner-commission-centre-${width}.png`, fullPage: true })
    }
  } finally { await pool.end(); await Promise.all([founder.close(), a.close(), b.close()]) }
})
