import { expect, test, type Browser, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { randomUUID } from "node:crypto"
import { mkdir } from "node:fs/promises"
import pg from "pg"
import { generateTotp } from "../../src/lib/server/mfa"

/*
 * Operation ASCEND B2.8 browser acceptance on the disposable Empower stack: the founder command centre and the real worker
 * HTTP endpoint, end to end. Synthetic identities only; no client, partner or prospect is contacted.
 * Like the other Empower journeys it expects the freshly migrated and seeded CI stack: execution history is immutable, so a
 * second run against the same database meets the one-hour cooldown created by the first (which the engine correctly enforces).
 */
const { Pool } = pg
const base = process.env.EMPOWER_ADMIN_BASE_URL
const db = process.env.EMPOWER_BROWSER_DATABASE_URL
const superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
test.skip(!base || !db || !superUrl, "Requires the dedicated disposable Empower browser PostgreSQL stack.")
test.describe.configure({ timeout: 300_000 })
const password = "Empower-Demo-Only-2026"
const shots = "test-results/ascend-engine"
function origin() {
  const app = new URL(base!), connection = new URL(db!), superDb = new URL(superUrl!)
  if (!["127.0.0.1", "localhost"].includes(app.hostname) || app.port !== "3103" || !["127.0.0.1", "localhost"].includes(connection.hostname) ||
      !["127.0.0.1", "localhost"].includes(superDb.hostname) || connection.pathname !== "/ss_empower_browser_e2e" || superDb.pathname !== connection.pathname)
    throw Error("Refusing B2.8 testing outside the disposable local acceptance database.")
  return app.origin
}
async function login(browser: Browser, email: string, founder = false, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  await page.goto(origin() + "/login")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  if (founder) await page.getByLabel(/^Authenticator code/).fill(generateTotp("JBSWY3DPEHPK3PXP"))
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible()
  return { context, page }
}
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
async function confirmDialog(page: Page, button: RegExp | string, reason?: string) {
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  if (reason) await dialog.getByLabel(/Reason/).fill(reason)
  await dialog.getByRole("button", { name: button }).click()
  await expect(dialog).toBeHidden()
}
async function financialFingerprint(pool: pg.Pool) {
  const out: Record<string, string> = {}
  for (const t of ["expansion_commission_ledger", "expansion_payouts", "expansion_withdrawal_requests", "expansion_contracts", "partner_agreement_acceptances", "invoices"])
    out[t] = (await pool.query(`select count(*)::text || ':' || coalesce(md5(string_agg(x::text, '|' order by x::text)), '-') f from ${t} x`)).rows[0].f
  return out
}

test("B2.8 founder governs the automation engine end to end and the worker endpoint executes only approved work", async ({ browser }) => {
  origin()
  const pool = new Pool({ connectionString: superUrl, max: 2 })
  // Suite convention on this disposable fixture: start from clear sign-in counters (the per-IP and per-identity
  // limit of 5 per 10 minutes is shared by every spec, since all browser logins come from one local address).
  await pool.query("delete from login_rate_limits"); await pool.query("delete from web_rate_limits")
  const financialBefore = await financialFingerprint(pool)
  const founder = await login(browser, "empower-founder-a@example.invalid", true)
  const partner = await login(browser, "empower-partner-one@example.invalid")
  const anonymous = await browser.newContext()
  const tag = randomUUID().slice(0, 8)
  try {
    // RBAC: partners, anonymous users and founders' browser sessions on machine routes are all refused.
    for (const context of [partner.context, anonymous]) {
      expect((await context.request.get(origin() + "/api/expansion/automation/engine", { maxRedirects: 0 })).status()).not.toBe(200)
      expect((await context.request.post(origin() + "/api/expansion/automation/engine", { data: { action: "control", scope: "global", suspended: false, reason: "partner attempt" }, maxRedirects: 0 })).status()).not.toBe(200)
    }
    expect((await founder.context.request.post(origin() + "/api/ascend/worker", { data: {} })).status()).toBe(401)
    const partnerPage = await partner.context.newPage()
    await partnerPage.goto(origin() + "/expansion/automation/engine")
    await expect(partnerPage.getByRole("heading", { name: "Automation command centre" })).toHaveCount(0)

    const page = founder.page
    await page.goto(origin() + "/expansion/automation/engine")
    await expect(page.getByRole("heading", { level: 1, name: "Automation command centre" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "Emergency stop is active" })).toBeVisible() // safe initial state

    // Keyboard dialog: focus moves in, Escape cancels, focus returns to the trigger.
    const resume = page.getByRole("button", { name: "Resume automation…" })
    await resume.focus(); await page.keyboard.press("Enter")
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("dialog").getByLabel(/Reason/)).toBeFocused()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(resume).toBeFocused()
    // A reason is required and recorded.
    await resume.click()
    await page.getByRole("dialog").getByRole("button", { name: "Resume automation" }).click()
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("reason")
    await page.getByRole("dialog").getByLabel(/Reason/).fill(`TEST ONLY ${tag}: browser acceptance resume`)
    await page.getByRole("dialog").getByRole("button", { name: "Resume automation" }).click()
    await expect(page.getByRole("heading", { name: "Automation is running" })).toBeVisible()

    // Enable an automation with founder approval and request a run.
    await page.getByRole("tab", { name: "Automations" }).click()
    const card = page.getByRole("article", { name: "Operational health assessment" })
    await card.getByRole("button", { name: /^(Enable|Disable)$/ }).textContent().then(async (label) => {
      if (label === "Enable") { await card.getByRole("button", { name: "Enable" }).click(); await confirmDialog(page, "Enable") }
    })
    await expect(card.getByText("Enabled", { exact: true })).toBeVisible()
    await expect(card.getByText(/Required \(valid/)).toBeVisible()
    await card.getByRole("button", { name: "Request a run…" }).click()
    await confirmDialog(page, "Request run")
    await expect(page.getByRole("status").filter({ hasText: "awaiting approval" })).toBeVisible()

    // Approve from the overview, bound to the digest shown.
    await page.getByRole("tab", { name: "Overview" }).click()
    const pendingList = page.getByRole("region", { name: "Awaiting your approval" })
    await pendingList.getByRole("button", { name: "Review" }).first().click()
    await expect(page.getByRole("heading", { name: "Operational health assessment" })).toBeVisible()
    await page.getByRole("button", { name: "Approve…" }).click()
    await expect(page.getByRole("dialog")).toContainText("payload digest")
    await confirmDialog(page, "Approve")
    await expect(page.locator(".ae-badge").filter({ hasText: "Queued" }).first()).toBeVisible()
    const executionId = (await page.locator(".ae-kv dd.ae-mono").first().textContent())!.trim()

    // Provision a worker identity; the token is shown exactly once.
    await page.getByRole("button", { name: "← All executions" }).click()
    await page.getByRole("tab", { name: "Workers & identities" }).click()
    await page.getByLabel("Name").fill(`browser-worker-${tag}`)
    await page.getByRole("button", { name: "Create identity" }).click()
    const secret = page.locator(".ae-secret code")
    await expect(secret).toBeVisible()
    const token = (await secret.textContent())!.trim()
    expect(token).toMatch(/^asc_[A-Za-z0-9_-]{43}$/)
    await page.getByRole("button", { name: "I have stored it" }).click()
    await expect(page.getByText(token)).toHaveCount(0)
    expect((await pool.query("select count(*)::int c from ascend_service_identities where token_sha256 = encode(sha256($1::bytea), 'hex')", [token])).rows[0].c).toBe(1)
    expect(JSON.stringify((await pool.query("select * from ascend_control_events order by id desc limit 5")).rows)).not.toContain(token)

    // The real worker endpoint (machine route, bearer token) executes the approved operation.
    const worker = await browser.newContext()
    const tick = () => worker.request.post(origin() + "/api/ascend/worker", { headers: { authorization: `Bearer ${token}` }, data: { workerId: `browser-${tag}`, version: "e2e-1", maxConcurrency: 1, inFlight: 0 } })
    const ticked = await tick()
    expect(ticked.status()).toBe(200)
    expect(await ticked.json()).toMatchObject({ claimed: { id: executionId, status: "completed" } })
    expect((await (await tick()).json()).claimed).toBeNull()

    // The founder sees the outcome, its source and a complete timeline.
    await page.getByRole("tab", { name: "Executions" }).click()
    await page.getByRole("button", { name: executionId.slice(0, 8) }).click()
    await expect(page.locator(".ae-badge").filter({ hasText: "Completed" }).first()).toBeVisible()
    await expect(page.getByText(/Source: ascend_executions/)).toBeVisible()
    for (const step of ["created", "approved", "queued", "claimed", "started", "completed"]) await expect(page.locator(".ae-timeline").getByText(step, { exact: true })).toBeVisible()

    // Emergency stop blocks the worker; revocation locks it out entirely.
    await page.getByRole("button", { name: "Emergency stop…" }).click()
    await confirmDialog(page, "Stop all automation", `TEST ONLY ${tag}: emergency drill`)
    await expect(page.getByRole("heading", { name: "Emergency stop is active" })).toBeVisible()
    await page.getByRole("tab", { name: "Automations" }).click()
    // The identical operation is inside its cooldown: the refusal is explained, nothing is created.
    await card.getByRole("button", { name: "Request a run…" }).click()
    await page.getByRole("dialog").getByRole("button", { name: "Request run" }).click()
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("cooldown")
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click()
    // Change policy through the UI: a new policy version, no cooldown, no approval step.
    const versionBefore = Number((await card.locator("dt:text-is('Policy') + dd").textContent())!.replace(/\D/g, ""))
    await card.getByText("Edit policy").click()
    await card.getByLabel("Cooldown (seconds)").fill("0")
    await card.getByLabel("Founder approval required").uncheck()
    await card.getByRole("button", { name: "Save policy…" }).click()
    await confirmDialog(page, "Save new policy")
    await expect(card.locator("dt:text-is('Policy') + dd")).toHaveText(`v${versionBefore + 1}`)
    await expect(card.getByText("Not required", { exact: true })).toBeVisible()
    await card.getByRole("button", { name: "Request a run…" }).click()
    await confirmDialog(page, "Request run")
    await expect(page.getByRole("status").filter({ hasText: "Queued for the next worker" })).toBeVisible()
    // The emergency stop holds: the worker claims nothing and the work stays queued and recoverable.
    expect((await (await tick()).json()).claimed).toBeNull()
    expect((await pool.query("select count(*)::int c from ascend_executions where action_type = 'ops.queue_health' and status = 'queued'")).rows[0].c).toBe(1)
    await page.getByRole("tab", { name: "Workers & identities" }).click()
    await expect(page.getByRole("cell", { name: `browser-${tag}` })).toBeVisible()
    await page.getByRole("listitem").filter({ hasText: `browser-worker-${tag}` }).getByRole("button", { name: "Revoke…" }).click()
    await confirmDialog(page, "Revoke identity", `TEST ONLY ${tag}: revoke browser worker`)
    expect((await tick()).status()).toBe(403)
    await worker.close()

    // Long diagnostics and high volume render without breaking layout.
    const longError = "TEST ONLY " + "very-long-unbroken-diagnostic-".repeat(15)
    await pool.query(`insert into ascend_executions (id, correlation_id, idempotency_key, action_type, payload_version, payload, payload_sha256, scope, policy_version, policy_decision, origin,
        requested_by_admin, status, approval_required, deadline_at, max_attempts, attempts, failure_class, last_error, created_at, updated_at, completed_at)
      select gen_random_uuid(), gen_random_uuid(), 'e2e:${tag}:' || g, 'pipeline.inactivity_scan', 1, '{"inactiveDays":14}', repeat('e', 64), '{"markets":["GB"]}', 1, '{"decision":"accepted"}', 'founder',
        (select id from admin_users where email = 'empower-founder-a@example.invalid'), case when g % 10 = 0 then 'dead_lettered' else 'completed' end, false, now() + interval '1 day', 5,
        case when g % 10 = 0 then 5 else 1 end, case when g % 10 = 0 then 'database_unavailable' end, case when g % 10 = 0 then left($1, 480) end,
        now() - (g || ' seconds')::interval, now(), now() from generate_series(1, 150) g`, [longError])
    await page.goto(origin() + "/expansion/automation/engine?status=dead_lettered")
    await expect(page.getByRole("tab", { name: "Executions" })).toHaveAttribute("aria-selected", "true")
    await expect(page.locator(".ae-badge").filter({ hasText: "Dead letter" }).first()).toBeVisible()
    await page.getByLabel("Status").selectOption("")
    await page.getByRole("button", { name: "Apply" }).click()
    await expect(page.getByText("50 shown, newest first")).toBeVisible()
    await page.getByRole("button", { name: "Load older executions" }).click()
    await expect(page.getByText("100 shown, newest first")).toBeVisible()
    // High volume with long diagnostics stays scannable: every row is compact.
    const tallest = await page.locator(".sc-table tbody tr").evaluateAll((rows) => Math.max(...rows.map((r) => r.getBoundingClientRect().height)))
    expect(tallest).toBeLessThanOrEqual(80)

    // Accessibility: no serious or critical axe violations on each view.
    for (const tab of ["Overview", "Executions", "Automations", "Workers & identities"]) {
      await page.getByRole("tab", { name: tab }).click()
      const results = await new AxeBuilder({ page }).include("main").analyze()
      expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${tab}: ${v.id}`)).toEqual([])
    }

    // Six widths: no page-level horizontal overflow; tables scroll inside their own container; 44px targets.
    await mkdir(shots, { recursive: true })
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      // MFA codes are single-use, so each viewport reuses the founder's authenticated session rather than logging in again.
      const viewContext = await browser.newContext({ viewport: { width, height: 900 }, storageState: await founder.context.storageState() })
      const view = { context: viewContext, page: await viewContext.newPage() }
      for (const [tab, url] of [["Overview", "/expansion/automation/engine"], ["Executions", "/expansion/automation/engine?status=dead_lettered"]] as const) {
        await view.page.goto(origin() + url)
        await expect(view.page.getByRole("heading", { level: 1, name: "Automation command centre" })).toBeVisible()
        if (tab === "Executions") await expect(view.page.locator(".ae-badge").filter({ hasText: "Dead letter" }).first()).toBeVisible()
        expect(await overflow(view.page), `${tab} at ${width}px`).toBeLessThanOrEqual(0)
        const small = await view.page.locator("main .sc-button:visible, main .ae-tab:visible").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length)
        expect(small, `${tab} touch targets at ${width}px`).toBe(0)
        // Tabs must never overlap or clip their labels (caught visually at 320px before this assertion existed).
        const tabsOk = await view.page.locator(".ae-tab").evaluateAll((els) => {
          const r = els.map((e) => e.getBoundingClientRect())
          const overlap = r.some((a, i) => r.some((b, j) => i < j && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1))
          const clipped = els.some((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          return !overlap && !clipped
        })
        expect(tabsOk, `${tab} tabs at ${width}px`).toBe(true)
        // The admin shell scrolls an inner container, so grow the viewport to the content to capture everything.
        const height = await view.page.locator("main.sc").evaluate((e) => Math.ceil(e.getBoundingClientRect().top + e.scrollHeight + 48))
        await view.page.setViewportSize({ width, height: Math.min(Math.max(height, 900), 7000) })
        await view.page.screenshot({ path: `${shots}/${tab.toLowerCase()}-${width}.png` })
        await view.page.setViewportSize({ width, height: 900 })
      }
      await view.context.close()
    }

    // Reduced motion disables the status pulse.
    const calmContext = await browser.newContext({ storageState: await founder.context.storageState() })
    const calm = { context: calmContext, page: await calmContext.newPage() }
    await calm.page.emulateMedia({ reducedMotion: "reduce" })
    await calm.page.goto(origin() + "/expansion/automation/engine")
    expect(await calm.page.locator(".ae-pulse").evaluate((el) => getComputedStyle(el).animationName)).toBe("none")
    await calm.context.close()

    expect(await financialFingerprint(pool)).toEqual(financialBefore)
  } finally {
    await pool.query("update ascend_automation_controls set suspended = true, reason = 'TEST ONLY: browser suite finished; automation left suspended', version = version + 1 where scope = 'global'")
    // Leave the counters as the following specs (which do not reset them themselves) found them before this spec existed.
    await pool.query("delete from login_rate_limits"); await pool.query("delete from web_rate_limits")
    await founder.context.close(); await partner.context.close(); await anonymous.close(); await pool.end()
  }
})
