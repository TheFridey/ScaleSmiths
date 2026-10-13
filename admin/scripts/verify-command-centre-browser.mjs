import { chromium } from "playwright"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import { mkdir } from "node:fs/promises"
import assert from "node:assert/strict"

const base = new URL(
  process.env.COMMAND_CENTRE_TEST_ORIGIN || "http://localhost:3005",
)
const database = new URL(process.env.TEST_DATABASE_URL || "")
if (
  !["localhost", "127.0.0.1"].includes(base.hostname) ||
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  database.pathname !== "/ss_command_centre_test"
)
  throw new Error(
    "Browser verification only supports the isolated local Command Centre test database.",
  )
const pool = new Pool({
  connectionString: database.href,
  connectionTimeoutMillis: 10000,
})
const password = "CommandCentreTest!2026"
const accounts = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Trev (test)",
    email: "trev-command-centre@example.test",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    name: "Rhys (test)",
    email: "rhys-command-centre@example.test",
  },
]
let browser
try {
  const hash = await bcrypt.hash(password, 12)
  for (const account of process.env.COMMAND_CENTRE_SKIP_FIXTURE_SEED === "true"
    ? []
    : accounts)
    await pool.query(
      "insert into admin_users(id,display_name,email,password_hash,role) values($1,$2,$3,$4,'owner') on conflict(id) do update set password_hash=excluded.password_hash,active=true",
      [account.id, account.name, account.email, hash],
    )
  browser = await chromium.launch({
    headless: true,
    ...(process.env.COMMAND_CENTRE_BROWSER_PATH
      ? { executablePath: process.env.COMMAND_CENTRE_BROWSER_PATH }
      : { channel: "msedge" }),
  })
  const contexts = await Promise.all(
    accounts.map(() =>
      browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    ),
  )
  const pages = await Promise.all(contexts.map((context) => context.newPage()))
  const consoleErrors = []
  for (const page of pages)
    page.on("pageerror", (e) => {
      consoleErrors.push(e.message)
      console.log("Browser error:", e.message)
    })
  for (const page of pages)
    page.on("requestfailed", (request) =>
      console.log(
        "Browser request failed:",
        new URL(request.url()).pathname,
        request.failure()?.errorText,
      ),
    )
  for (let index = 0; index < pages.length; index++) {
    console.log(`Signing in fixture ${index + 1}`)
    await pages[index].goto(`${base.origin}/login`, {
      timeout: 600000,
      waitUntil: "load",
    })
    await pages[index].waitForFunction(
      () =>
        !("serviceWorker" in navigator) ||
        Boolean(navigator.serviceWorker.controller),
      null,
      { timeout: 60000 },
    )
    await pages[index].waitForLoadState("networkidle", { timeout: 60000 })
    console.log(`Login ready for fixture ${index + 1}`)
    await pages[index]
      .getByLabel("Email", { exact: true })
      .fill(accounts[index].email)
    await pages[index].getByLabel("Password", { exact: true }).fill(password)
    await pages[index].getByRole("button", { name: /sign in/i }).click()
    console.log(`Login submitted for fixture ${index + 1}`)
    await pages[index].waitForURL("**/command-centre", { timeout: 600000 })
    await pages[index]
      .getByRole("button", { name: "Pipeline", exact: true })
      .waitFor({ timeout: 600000 })
    console.log(`Shared workspace ready for fixture ${index + 1}`)
  }
  const name = `Browser shared prospect ${Date.now()}`
  const first = pages[0],
    second = pages[1]
  await first
    .getByRole("button", { name: "Capture prospect", exact: true })
    .click()
  await first.getByLabel("Business name", { exact: true }).fill(name)
  await first.getByRole("button", { name: "Save record", exact: true }).click()
  await first
    .getByRole("status")
    .filter({ hasText: "Saved to the shared record" })
    .waitFor({ timeout: 60000 })
  await second
    .getByRole("button", { name: "Refresh records", exact: true })
    .click()
  await second.getByRole("button", { name: "Pipeline", exact: true }).click()
  await second
    .getByRole("button", { name, exact: true })
    .waitFor({ timeout: 60000 })
  await second.getByRole("button", { name, exact: true }).click()
  await second
    .getByRole("button", { name: "Edit opportunity", exact: true })
    .click()
  await second
    .getByLabel("Next action / handover note", { exact: true })
    .fill("Rhys browser follow-up")
  await second.getByRole("button", { name: "Save record", exact: true }).click()
  await second
    .getByRole("status")
    .filter({ hasText: "Saved to the shared record" })
    .waitFor({ timeout: 60000 })
  await first
    .getByRole("button", { name: "Refresh records", exact: true })
    .click()
  await first.getByRole("button", { name: "Pipeline", exact: true }).click()
  await first
    .getByText("Rhys browser follow-up", { exact: true })
    .waitFor({ timeout: 60000 })
  const lead = await first.evaluate(async (businessName) => {
    const response = await fetch("/api/command-centre", { cache: "no-store" })
    if (!response.ok) throw new Error("Shared snapshot unavailable")
    return (await response.json()).leads.find(
      (lead) => lead.businessName === businessName,
    )
  }, name)
  const activity = await first.evaluate(async ({ id }) => {
    const response = await fetch("/api/command-centre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "activity",
        prospectId: id,
        type: "phone_call",
        direction: "outbound",
        outcome: "Interested",
        confirmed: true,
        requestKey: crypto.randomUUID(),
        createdBy: "Spoofed",
        followUpAt: "2026-12-03T09:00:00Z",
        nextAction: "Browser follow-up",
      }),
    })
    return { status: response.status, data: await response.json() }
  }, lead)
  assert.equal(activity.status, 200)
  assert.equal(activity.data.record.actorUserId, accounts[0].id)
  const anon = await browser.newContext()
  const denied = await anon.request.get(`${base.origin}/api/command-centre`)
  assert.equal(denied.status(), 401)
  const manifest = await anon.request.get(`${base.origin}/manifest.webmanifest`)
  assert.equal(manifest.status(), 200)
  assert.equal((await manifest.json()).start_url, "/")
  const worker = await anon.request.get(`${base.origin}/command-centre-sw.js`)
  assert.equal(worker.status(), 200)
  const caches = await first.evaluate(async () => ({
    keys: await window.caches.keys(),
    registrations: (await navigator.serviceWorker.getRegistrations()).map(
      (r) => r.scope,
    ),
  }))
  assert.deepEqual(caches.keys, [])
  assert.ok(
    caches.registrations.every((scope) => scope.startsWith(base.origin)),
  )
  await mkdir("test-results/command-centre", { recursive: true })
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await first.setViewportSize(viewport)
    await first.getByRole("button", { name: "Today", exact: true }).click()
    await first.screenshot({
      path: `test-results/command-centre/${viewport.name}.png`,
      fullPage: true,
    })
    const overflow = await first.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    )
    assert.equal(overflow, false, `${viewport.name} page overflow`)
    await first
      .getByRole("button", { name: "Capture prospect", exact: true })
      .click()
    assert.ok(await first.locator("dialog[open]").isVisible())
    await first.screenshot({
      path: `test-results/command-centre/${viewport.name}-capture.png`,
      fullPage: true,
    })
    await first.getByRole("button", { name: "Close", exact: true }).click()
  }
  await first.reload({ timeout: 180000 })
  await first.getByRole("button", { name: "Pipeline", exact: true }).click()
  await first
    .getByRole("button", { name, exact: true })
    .waitFor({ timeout: 60000 })
  assert.deepEqual(consoleErrors, [])
  console.log(
    "Command Centre browser verification passed: two real login sessions, shared creation/update, trusted attribution, durable activity, unauthorized denial, manifest, network-only worker, refresh persistence and desktop/mobile screenshots.",
  )
} finally {
  await browser?.close()
  await pool.end()
}
