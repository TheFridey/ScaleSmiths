import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
import { deliverPartnerEmail, notifyPartner, recipientSha256 } from "./partner-notifications"

/* Operation Launch Ready: partner email log against the real 0096 DDL. No email leaves the process: the transport is a stub. */
let postgres: PGlite
let database: ReturnType<typeof drizzle>
const ENABLED = { PARTNER_EMAIL_ENABLED: "true", RESEND_API_KEY: "re_test_only", RESEND_FROM: "partners@example.invalid" } as unknown as NodeJS.ProcessEnv
const message = (key = "application-1-declined-test") => ({ to: "Applicant@Example.invalid", applicationId: 1, idempotencyKey: key, email: { kind: "application_declined" as const, name: "Applicant" } })

beforeEach(async () => {
  postgres = new PGlite()
  database = drizzle(postgres)
  await postgres.exec(`create table admin_users(id uuid primary key); create table partner_applications(id integer primary key); create table expansion_partners(id uuid primary key);
    insert into partner_applications values (1);`)
  await postgres.exec(readFileSync("drizzle/0096_partner_notifications.sql", "utf8"))
}, 30000)
afterEach(async () => { vi.restoreAllMocks(); await postgres?.close() })

describe("partner notification log", () => {
  it("records why nothing was sent when email is switched off or not configured, without storing the address", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const transport = vi.fn()
    expect(await database.transaction((tx) => notifyPartner(tx as never, message("k-disabled-1"), { env: {} as NodeJS.ProcessEnv, transport }))).toMatchObject({ status: "disabled" })
    expect(await database.transaction((tx) => notifyPartner(tx as never, message("k-unconfigured-1"), { env: { PARTNER_EMAIL_ENABLED: "true" } as unknown as NodeJS.ProcessEnv, transport }))).toMatchObject({ status: "not_configured" })
    expect(transport).not.toHaveBeenCalled()
    const rows = (await postgres.query<{ status: string; recipient_sha256: string }>("select status, recipient_sha256 from partner_notifications order by created_at")).rows
    expect(rows.map((r) => r.status)).toEqual(["disabled", "not_configured"])
    expect(rows[0].recipient_sha256).toBe(recipientSha256("applicant@example.invalid"))
    expect(JSON.stringify((await postgres.query("select * from partner_notifications")).rows)).not.toMatch(/example\.invalid/i)
  })

  it("is idempotent: a sent message is never sent twice, and a failed one can be retried under the same key", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const transport = vi.fn().mockResolvedValueOnce({ ok: false, reason: "provider_unreachable" }).mockResolvedValue({ ok: true })
    expect(await database.transaction((tx) => notifyPartner(tx as never, message(), { env: ENABLED, transport }))).toMatchObject({ status: "failed" })
    expect(await database.transaction((tx) => notifyPartner(tx as never, message(), { env: ENABLED, transport }))).toMatchObject({ status: "sent", duplicate: false })
    expect(await database.transaction((tx) => notifyPartner(tx as never, message(), { env: ENABLED, transport }))).toMatchObject({ status: "sent", duplicate: true })
    expect(transport).toHaveBeenCalledTimes(2)
    expect(transport.mock.calls[1][1]).toBe("application-1-declined-test")
    expect((await postgres.query("select status, attempts, failure_reason from partner_notifications")).rows).toEqual([{ status: "sent", attempts: 2, failure_reason: null }])
  })

  it("keeps history: rows cannot be deleted, rewritten or moved back from sent", async () => {
    await database.transaction((tx) => notifyPartner(tx as never, message(), { env: ENABLED, transport: async () => ({ ok: true }) }))
    await expect(postgres.query("delete from partner_notifications")).rejects.toThrow("retained")
    await expect(postgres.query("update partner_notifications set kind='invitation'")).rejects.toThrow("cannot be rewritten")
    await expect(postgres.query("update partner_notifications set status='failed'")).rejects.toThrow("cannot be marked unsent")
    // The applicant retention purge may still delete the application; the log keeps the row without the link.
    await postgres.query("delete from partner_applications where id=1")
    expect((await postgres.query("select application_id from partner_notifications")).rows).toEqual([{ application_id: null }])
  })

  it("fails safe on an invalid message and never throws to the caller", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const transport = vi.fn()
    const result = await deliverPartnerEmail({ to: "a@example.invalid", idempotencyKey: "k-invalid-link", email: { kind: "activated", name: "A", signInUrl: "https://evil.example/login" } }, { env: ENABLED, transport })
    expect(result).toEqual({ status: "failed", reason: "message_invalid" })
    expect(transport).not.toHaveBeenCalled()
  })
})
