import { createHash, randomBytes } from "node:crypto"
import { expect, test } from "@playwright/test"
import { Client } from "pg"

const enabled = process.env.SCALESMITHS_TEST_ENVIRONMENT === "forge-v2-e2e" && Boolean(process.env.WEB_DATABASE_URL)
test.skip(!enabled, "Requires the guarded isolated PostgreSQL E2E environment.")

test("a client completes one-time activation and first login into the linked workspace", async ({ page }) => {
  const db = new Client({ connectionString: process.env.WEB_DATABASE_URL })
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`
  const email = `portal-activation-${suffix}@example.test`
  const portalClientId = `portal-e2e-${suffix}`
  const rawToken = randomBytes(32).toString("base64url")
  const tokenHash = createHash("sha256").update(rawToken).digest("hex")
  const password = "E2e-first-login!739"
  await db.connect()
  try {
    const marker = await db.query("select 1 from public.scalesmiths_test_environment where marker = 'scalesmiths-forge-v2-isolated-test-v1'")
    expect(marker.rowCount).toBe(1)
    const account = await db.query<{ id: number }>("insert into portal_client_accounts (client_id,email,password_hash,active,status,invited_at) values ($1,$2,$3,false,'invited',now()) returning id", [portalClientId, email, "unusable-placeholder"])
    await db.query("insert into portal_account_tokens (account_id,purpose,token_hash,expires_at,created_by) values ($1,'activation',$2,now() + interval '48 hours','e2e')", [account.rows[0].id, tokenHash])

    await page.goto(`/portal/activate?token=${encodeURIComponent(rawToken)}`)
    await page.getByLabel("New password").fill(password)
    await page.getByLabel("Confirm password").fill(password)
    await page.getByRole("button", { name: "Activate portal" }).click()
    await expect(page.getByRole("heading", { name: "Portal access ready" })).toBeVisible()

    const replay = await page.request.post("/portal/api/activate", { data: { token: rawToken, password: "Different-pass!739" } })
    expect(replay.status()).toBe(400)

    await page.getByRole("link", { name: "Continue to sign in" }).click()
    await page.getByLabel("Email", { exact: true }).fill(email)
    await page.getByLabel("Password", { exact: true }).fill(password)
    await page.getByRole("button", { name: /enter portal/i }).click()
    await expect(page).toHaveURL(new RegExp(`/portal/${portalClientId}$`))
  } finally {
    await db.query("delete from portal_client_accounts where email = $1", [email]).catch(() => undefined)
    await db.end()
  }
})
