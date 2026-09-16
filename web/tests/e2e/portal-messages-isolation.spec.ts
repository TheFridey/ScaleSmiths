import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { expect, test } from "@playwright/test"
import { Client } from "pg"
import { rejectNonEssentialStorage } from "./helpers"

const enabled = process.env.SCALESMITHS_TEST_ENVIRONMENT === "forge-v2-e2e" && Boolean(process.env.WEB_DATABASE_URL)
test.skip(!enabled, "Requires the guarded isolated PostgreSQL E2E environment.")

test("unauthenticated visitors cannot open the messages tab", async ({ page }) => {
  await page.goto("/portal/any-client?tab=messages")
  await expect(page).toHaveURL(/\/portal\/login/)
})

test("messages shows owned client-visible request-thread history and hides other clients and internal notes", async ({ browser }) => {
  const db = new Client({ connectionString: process.env.WEB_DATABASE_URL })
  const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`
  const password = "E2e-messages!739"
  const passwordHash = await bcrypt.hash(password, 4)
  const clientA = {
    id: `portal-msg-a-${suffix}`,
    email: `portal-msg-a-${suffix}@example.test`,
    visible: `A-visible-${suffix}`,
    internal: `A-internal-secret-${suffix}`,
    unread: `A-staff-reply-${suffix}`,
  }
  const clientB = {
    id: `portal-msg-b-${suffix}`,
    email: `portal-msg-b-${suffix}@example.test`,
    visible: `B-visible-secret-${suffix}`,
  }

  await db.connect()
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  await rejectNonEssentialStorage(page)

  try {
    const marker = await db.query("select 1 from public.scalesmiths_test_environment where marker = 'scalesmiths-forge-v2-isolated-test-v1'")
    expect(marker.rowCount).toBe(1)

    await seedPortalClient(db, { ...clientA, name: "North Workshop", passwordHash })
    await seedPortalClient(db, { ...clientB, name: "South Workshop", passwordHash })

    const requestARead = await insertRequest(db, {
      clientId: clientA.id,
      title: "Homepage copy",
      description: "Please update the hero.",
      category: "website_update",
    })
    const requestAUnread = await insertRequest(db, {
      clientId: clientA.id,
      title: "Contact form",
      description: "The form is failing.",
      category: "form_issue",
    })
    const requestB = await insertRequest(db, {
      clientId: clientB.id,
      title: "Private B thread",
      description: "Do not leak this request.",
      category: "website_issue",
    })
    const generalA = await insertRequest(db, {
      clientId: clientA.id,
      title: "Portal messages",
      description: "Direct messages between this client and ScaleSmiths.",
      category: "general_support",
    })

    await insertMessage(db, { requestId: requestARead, sender: "client", body: "Please update the hero.", createdAt: "2026-09-14T10:00:00Z" })
    await insertMessage(db, { requestId: requestARead, sender: "admin", body: clientA.visible, visibility: "client_visible", createdAt: "2026-09-14T11:00:00Z" })
    await insertMessage(db, { requestId: requestARead, sender: "admin", body: clientA.internal, visibility: "internal", createdAt: "2026-09-14T11:05:00Z" })
    await db.query("update client_requests set client_last_read_at = timestamptz '2026-09-14 12:00:00+00' where id = $1", [requestARead])

    await insertMessage(db, { requestId: requestAUnread, sender: "client", body: "The form is failing.", createdAt: "2026-09-15T09:00:00Z" })
    await insertMessage(db, { requestId: requestAUnread, sender: "admin", body: clientA.unread, visibility: "client_visible", createdAt: "2026-09-16T09:00:00Z" })

    await insertMessage(db, { requestId: requestB, sender: "admin", body: clientB.visible, visibility: "client_visible", createdAt: "2026-09-16T10:00:00Z" })
    await insertMessage(db, { requestId: generalA, sender: "client", body: "Hello from the portal.", createdAt: "2026-09-16T12:00:00Z" })

    await login(page, clientA.email, password)
    await expect(page).toHaveURL(new RegExp(`/portal/${clientA.id}$`))

    await page.goto(`/portal/${clientB.id}?tab=messages`)
    await expect(page).toHaveURL(new RegExp(`/portal/${clientA.id}`))

    await page.goto(`/portal/${clientA.id}?tab=messages&thread=${requestB}`)
    await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible()
    await expect(page.getByText(clientA.unread)).toBeVisible()
    await expect(page.getByText(clientA.visible)).toBeVisible()
    await expect(page.getByText(clientB.visible)).toHaveCount(0)
    await expect(page.getByText(clientA.internal)).toHaveCount(0)
    await expect(page.getByText("Private B thread")).toHaveCount(0)
    await expect(page.getByRole("link", { name: /contact form/i }).getByText("Unread", { exact: true })).toBeVisible()

    await page.getByRole("link", { name: /homepage copy/i }).click()
    await expect(page).toHaveURL(new RegExp(`[?&]thread=${requestARead}(?:&|$)`))
    await expect(page.getByRole("heading", { name: "Homepage copy", exact: true })).toBeVisible()
    await expect(page.getByText(clientA.visible)).toBeVisible()
    await expect(page.getByText(clientA.internal)).toHaveCount(0)
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)

    const reply = `A-reply-${suffix}`
    await page.getByLabel("Message", { exact: true }).fill(reply)
    await page.getByRole("button", { name: /send message/i }).click()
    await expect(page.getByText(reply)).toBeVisible()
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)
  } finally {
    await context.close()
    await db.query("delete from client_requests where client_id = any($1::text[])", [[clientA.id, clientB.id]]).catch(() => undefined)
    await db.query("delete from portal_client_accounts where email = any($1::text[])", [[clientA.email, clientB.email]]).catch(() => undefined)
    await db.query("delete from clients where portal_client_id = any($1::text[])", [[clientA.id, clientB.id]]).catch(() => undefined)
    await db.end().catch(() => undefined)
  }
})

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/portal/login")
  await page.getByLabel("Email", { exact: true }).fill(email)
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("button", { name: /enter portal/i }).click()
}

async function seedPortalClient(
  db: Client,
  input: { id: string; email: string; name: string; passwordHash: string },
) {
  await db.query(
    "insert into clients (name, contact_name, status, portal_client_id) values ($1, $2, 'active', $3)",
    [input.name, "Alex Client", input.id],
  )
  await db.query(
    "insert into portal_client_accounts (client_id, email, password_hash, active, status, activated_at) values ($1, $2, $3, true, 'active', now())",
    [input.id, input.email, input.passwordHash],
  )
}

async function insertRequest(
  db: Client,
  input: { clientId: string; title: string; description: string; category: string },
) {
  const result = await db.query<{ id: number }>(
    "insert into client_requests (client_id, title, description, category, priority, status) values ($1, $2, $3, $4, 'medium', 'in_progress') returning id",
    [input.clientId, input.title, input.description, input.category],
  )
  return result.rows[0].id
}

async function insertMessage(
  db: Client,
  input: {
    requestId: number
    sender: "client" | "admin"
    body: string
    visibility?: "client_visible" | "internal"
    createdAt: string
  },
) {
  await db.query(
    "insert into client_request_messages (request_id, sender_type, sender_name, body, visibility, created_at) values ($1, $2, $3, $4, $5, $6::timestamptz)",
    [
      input.requestId,
      input.sender,
      input.sender === "admin" ? "ScaleSmiths" : "Client",
      input.body,
      input.visibility ?? "client_visible",
      input.createdAt,
    ],
  )
}
