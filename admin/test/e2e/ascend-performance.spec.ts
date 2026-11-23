import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { mkdir } from "node:fs/promises"
import pg from "pg"
import { generateTotp } from "../../src/lib/server/mfa"

const { Pool } = pg
const base = process.env.EMPOWER_ADMIN_BASE_URL
const dbUrl = process.env.EMPOWER_BROWSER_DATABASE_URL
const superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
test.skip(!base || !dbUrl || !superUrl, "Disposable B2.5 acceptance stack is required.")
const PASSWORD = "Empower-Demo-Only-2026"
const FOUNDER = "empower-founder-a@example.invalid", MFA = "JBSWY3DPEHPK3PXP"
const PARTNER_A = "empower-partner-one@example.invalid", PARTNER_B = "empower-partner-two@example.invalid"
const WIDTHS = [320, 390, 768, 1024, 1440, 1920]
const origin = () => {
  const a = new URL(base!), d = new URL(dbUrl!), s = new URL(superUrl!)
  if (!["localhost", "127.0.0.1"].includes(a.hostname) || a.port !== "3103" || d.pathname !== "/ss_empower_browser_e2e" ||
      s.pathname !== "/ss_empower_browser_e2e" || !["localhost", "127.0.0.1"].includes(d.hostname)) throw new Error("Refusing non-disposable test target.")
  return a.origin
}
async function login(browser: Browser, email: string, founder = false) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(origin() + "/login")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  if (founder) await page.getByLabel(/^Authenticator code/).fill(generateTotp(MFA))
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/(partner|command-centre|dashboard)/)
  return { context, page }
}
const call = async (context: BrowserContext, path: string, data?: Record<string, unknown>) => {
  const r = data ? await context.request.post(origin() + path, { headers: { origin: origin() }, data })
    : await context.request.get(origin() + path, { maxRedirects: 0 })
  return { status: r.status(), data: await r.json().catch(() => ({})) }
}
const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)

test("B2.5 personal performance uses owned real events, keeps finance immutable and hides other partners", async ({ browser }) => {
  origin()
  const su = new Pool({ connectionString: superUrl, max: 1 })
  const evidence = "../docs/expansion/ascend/evidence/b2-5"
  await mkdir(evidence, { recursive: true })
  const run = Date.now().toString(36)
  const fingerprint = async () => (await su.query("select md5(coalesce(string_agg(l::text, '|' order by l.id), '')) as h from expansion_commission_ledger l")).rows[0].h
  const before = await fingerprint()
  const founder = await login(browser, FOUNDER, true)
  const p1 = await login(browser, PARTNER_A)
  const p2 = await login(browser, PARTNER_B)
  try {
    await su.query("delete from login_rate_limits")
    // Same authorised synthetic market setup as the B2.1 browser journey.
    const market = await call(founder.context, "/api/expansion", { action: "set_market", countryCode: "GB", countryName: "United Kingdom", status: "approved", planKeys: ["standard-v2"], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: "TEST ONLY B2.5 " + run })
    expect(market.status, JSON.stringify(market.data)).toBe(200)
    const aBefore = await call(p1.context, "/api/partner/performance?period=30d")
    const bBefore = await call(p2.context, "/api/partner/performance?period=30d")
    expect(aBefore.status).toBe(200)
    expect(bBefore.status).toBe(200)
    const registered = await call(p1.context, "/api/partner", { action: "register", country: "GB", businessName: "TEST ONLY Performance " + run, website: "pf-" + run + ".example", industry: "TEST ONLY Trades" })
    expect(registered.status, JSON.stringify(registered.data)).toBe(200)
    const aAfter = await call(p1.context, "/api/partner/performance?period=30d")
    const bAfter = await call(p2.context, "/api/partner/performance?period=30d")
    expect(aAfter.status).toBe(200)
    expect(bAfter.status).toBe(200)
    expect(aAfter.data.metrics.registered).toBe(aBefore.data.metrics.registered + 1)
    expect(bAfter.data.metrics.registered).toBe(bBefore.data.metrics.registered)
    expect(aAfter.data.metrics.earnedPence).toBe(aBefore.data.metrics.earnedPence)
    expect(aAfter.data.metrics.paidPence).toBe(aBefore.data.metrics.paidPence)
    expect(aAfter.data.distribution.kind).toBe("current_state_only")
    await p1.page.goto(origin() + "/partner/performance?period=30d")
    await expect(p1.page.getByRole("heading", { name: "Your performance" })).toBeVisible()
    await expect(p1.page.locator(".pf-card").filter({ hasText: "Prospects registered" })).toContainText(String(aAfter.data.metrics.registered))
    // Next.js App Router must finish hydration before its client-side link navigation is exercised.
    await expect(p1.page.locator("html")).toHaveAttribute("data-scalesmiths-hydrated", "true")
    await expect(p1.page.getByRole("link", { name: "7 days" })).toHaveAttribute("href", "/partner/performance?period=7d")
    await p1.page.getByRole("link", { name: "7 days" }).click()
    await expect(p1.page).toHaveURL(/period=7d/)
    await expect(p1.page.getByText(/Current opportunity states, not a historical conversion funnel/)).toBeVisible()
    const violations = await new AxeBuilder({ page: p1.page }).include(".academy").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
    expect(violations.violations.filter((v) => ["serious", "critical"].includes(String(v.impact)))).toEqual([])
    for (const width of WIDTHS) {
      await p1.page.setViewportSize({ width, height: 900 })
      await noOverflow(p1.page)
      await p1.page.screenshot({ path: evidence + "/performance-" + width + ".png", fullPage: true })
    }
    expect((await call(founder.context, "/api/partner/performance")).status).not.toBe(200)
    expect((await call(p1.context, "/api/partner/performance?period=garbage")).status).not.toBe(200)
    const anonymous = await browser.newContext()
    try { expect((await call(anonymous, "/api/partner/performance")).status).not.toBe(200) }
    finally { await anonymous.close() }
    expect(await fingerprint()).toBe(before)
  } finally {
    await Promise.all([founder.context.close(), p1.context.close(), p2.context.close()])
    await su.end()
  }
})
