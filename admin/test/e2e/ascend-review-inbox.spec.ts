import { expect, test, type Browser } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { randomUUID } from "node:crypto"
import { mkdir } from "node:fs/promises"
import pg from "pg"
import { generateTotp } from "../../src/lib/server/mfa"

const { Pool } = pg
const base = process.env.EMPOWER_ADMIN_BASE_URL
const db = process.env.EMPOWER_BROWSER_DATABASE_URL
const superUrl = process.env.EMPOWER_BROWSER_SUPERUSER_URL
test.skip(!base || !db || !superUrl, "Requires the dedicated disposable Empower browser PostgreSQL stack.")
const password = "Empower-Demo-Only-2026"
function origin() {
  const app = new URL(base!), connection = new URL(db!), superDb = new URL(superUrl!)
  if (!["127.0.0.1", "localhost"].includes(app.hostname) || app.port !== "3103" ||
      !["127.0.0.1", "localhost"].includes(connection.hostname) ||
      !["127.0.0.1", "localhost"].includes(superDb.hostname) ||
      connection.pathname !== "/ss_empower_browser_e2e" || superDb.pathname !== connection.pathname)
    throw Error("Refusing B2.7 review testing outside the disposable local acceptance database.")
  return app.origin
}
async function login(browser: Browser, email: string, founder = false) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(origin() + "/login")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  if (founder) await page.getByLabel(/^Authenticator code/).fill(generateTotp("JBSWY3DPEHPK3PXP"))
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/(partner|dashboard|command-centre)/)
  return { context, page }
}

test("B2.7 founder reviews a real queued advisory through the enabled UI without commercial writes", async ({ browser }) => {
  origin()
  const pool = new Pool({ connectionString: superUrl, max: 1 })
  const id = randomUUID(), key = "b27:browser:" + id
  const title = "TEST ONLY B2.7 internal review " + id.slice(0, 8)
  const payload = {
    id: key, source: "sales_command", kind: "meeting", severity: "attention", title,
    explanation: "Synthetic founder review, no client action",
    href: "/expansion", observedAt: "2026-11-22T12:00:00.000Z",
    recommendedAction: "Review the source without contacting a client",
  }
  const before = await pool.query("select count(*)::int AS n from expansion_delivery_handoffs")
  await pool.query(
    `insert into ascend_review_jobs
      (id,signal_key,source,kind,payload,observed_at,available_at)
      values ($1,$2,'sales_command','meeting',$3::jsonb,'2026-11-22T12:00:00Z','2026-01-01T00:00:00Z')`,
    [id, key, JSON.stringify(payload)],
  )
  await pool.query("insert into ascend_review_job_events(job_id,event) values ($1,'observed')", [id])
  const founder = await login(browser, "empower-founder-a@example.invalid", true)
  const partner = await login(browser, "empower-partner-one@example.invalid")
  const anonymous = await browser.newContext()
  try {
    for (const context of [partner.context, anonymous]) {
      expect((await context.request.get(origin() + "/api/expansion/automation/review", { maxRedirects: 0 })).status()).not.toBe(200)
      expect((await context.request.post(origin() + "/api/expansion/automation/review",
        { headers: { origin: origin() }, data: { action: "prepare" }, maxRedirects: 0 })).status()).not.toBe(200)
    }
    const apiResponse = await founder.context.request.get(origin() + "/api/expansion/automation/review")
    expect(apiResponse.status()).toBe(200)
    expect((await apiResponse.json()).mode).toBe("founder_review_only")
    await founder.page.goto(origin() + "/expansion/automation/review")
    await expect(founder.page.getByRole("heading", { name: "Durable founder review tasks" })).toBeVisible()
    const row = founder.page.locator("li").filter({ hasText: title })
    await expect(row).toBeVisible()
    await expect(row).toContainText("PENDING")
    await founder.page.getByRole("button", { name: "Prepare next due review" }).click()
    await expect(row).toContainText("READY")
    const ready = await pool.query("select status,attempts from ascend_review_jobs where id=$1", [id])
    expect(ready.rows[0]).toMatchObject({ status: "ready", attempts: 1 })
    const evidence = "../docs/expansion/ascend/evidence/b2-7-review"
    await mkdir(evidence, { recursive: true })
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await founder.page.setViewportSize({ width, height: 900 })
      expect(await founder.page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      await founder.page.screenshot({ path: evidence + "/review-" + width + ".png", fullPage: true })
    }
    const accessibility = await new AxeBuilder({ page: founder.page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
    expect(accessibility.violations.filter(x => ["critical", "serious"].includes(String(x.impact)))).toEqual([])
    await row.getByRole("button", { name: "Acknowledge review" }).click()
    await expect(row).toContainText("RESOLVED")
    const states = await pool.query(
      "select event from ascend_review_job_events where job_id=$1 order by id", [id],
    )
    expect(states.rows.map(r => r.event)).toEqual(["observed", "claimed", "ready", "resolved"])
    expect((await pool.query("select count(*)::int AS n from expansion_delivery_handoffs")).rows[0].n).toBe(before.rows[0].n)
  } finally {
    await Promise.all([founder.context.close(), partner.context.close(), anonymous.close()])
    await pool.end()
  }
})
