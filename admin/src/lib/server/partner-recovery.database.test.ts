import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const PARTNER_USER = "10000000-0000-4000-8000-000000000002", FOUNDER = "10000000-0000-4000-8000-000000000001", INACTIVE_USER = "10000000-0000-4000-8000-000000000003"
const PARTNER = "20000000-0000-4000-8000-000000000001", PENDING_PARTNER = "20000000-0000-4000-8000-000000000003"
const state = vi.hoisted(() => ({ pg: null as import("@electric-sql/pglite").PGlite | null, db: null as unknown, sent: [] as { to: string; email: { kind: string; link: string } }[] }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/db", () => ({ get db() { return state.db } }))
vi.mock("./partner-notifications", () => ({
  partnerPortalOrigin: () => "https://partners.scalesmiths.co.uk",
  notifyPartner: async (_tx: unknown, input: { to: string; email: { kind: string; link: string } }) => { state.sent.push(input); return { status: "sent" } },
}))
import { confirmApplicationWithdrawal, GENERIC_RESET_REPLY, GENERIC_WITHDRAWAL_REPLY, previewApplicationWithdrawal, requestApplicationWithdrawal, requestPasswordReset, resetPartnerPassword, tokenDigest } from "./partner-recovery"

const q = <T extends object = Record<string, unknown>>(text: string, params: unknown[] = []) => state.pg!.query<T>(text, params)
const lastToken = () => new URL(state.sent.at(-1)!.email.link).hash.replace("#token=", "")

describe("Operation Empower B2.10 password recovery and applicant withdrawal (PGlite)", () => {
  beforeAll(async () => {
    state.pg = new PGlite()
    await state.pg.exec(`
      create table admin_users(id uuid primary key, email text not null, display_name text not null, password_hash text not null, role text not null, active boolean not null default true,
        password_changed_at timestamptz, session_version integer not null default 1, updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
        mfa_enabled boolean not null default false, mfa_secret text, mfa_recovery_codes jsonb, mfa_enrolled_at timestamptz, last_login_at timestamptz, invited_at timestamptz, invited_by uuid);
      create table admin_security_audit(id serial primary key, actor_user_id uuid, target_user_id uuid, action text not null, success boolean not null, metadata_json jsonb, created_at timestamptz not null default now());
      create table partner_applications(id serial primary key, name text not null, email text not null, status text not null, submitted_at timestamptz not null default now());
      create table expansion_partners(id uuid primary key, user_id uuid references admin_users(id), application_id integer references partner_applications(id), activated_at timestamptz, invitation_hash text, invitation_expires_at timestamptz);
      create table partner_notifications(id uuid primary key, kind text not null, constraint partner_notifications_kind_check check (kind in ('application_received')));
    `)
    const migration = readFileSync(new URL("../../../drizzle/0106_partner_recovery_and_withdrawal.sql", import.meta.url), "utf8")
    await state.pg.exec(migration)
    state.db = drizzle(state.pg)
  }, 30000)
  afterAll(async () => { await state.pg?.close() })
  beforeEach(async () => {
    state.sent = []
    await q("truncate partner_password_resets, partner_application_withdrawals, admin_security_audit, expansion_partners, partner_applications, admin_users restart identity cascade")
    await q(`insert into admin_users(id,email,display_name,password_hash,role,active) values
      ($1,'founder@example.test','Founder','old','owner',true), ($2,'partner@example.test','Pat Partner','old','independent_partner',true), ($3,'pending@example.test','Pending','old','independent_partner',false)`, [FOUNDER, PARTNER_USER, INACTIVE_USER])
    await q("insert into partner_applications(name,email,status) values('Pat Partner','partner@example.test','activated'),('Pending','pending@example.test','onboarding'),('Ada Applicant','Ada@Example.test','under_review'),('Done','done@example.test','declined')")
    await q("insert into expansion_partners values($1,$2,1,now(),null,null),($3,$4,2,null,'invitehash',now()+interval '1 day')", [PARTNER, PARTNER_USER, PENDING_PARTNER, INACTIVE_USER])
  })

  it("migration 0106 extends the notification kinds without dropping any and enforces short-lived digests", async () => {
    await q("insert into partner_notifications values(gen_random_uuid(),'password_reset'),(gen_random_uuid(),'withdrawal_confirmation'),(gen_random_uuid(),'application_received')")
    await expect(q("insert into partner_notifications values(gen_random_uuid(),'anything_else')")).rejects.toThrow()
    await expect(q("insert into partner_password_resets values(gen_random_uuid(),$1,$2,now(),now()+interval '2 hours',null)", [PARTNER_USER, "a".repeat(64)])).rejects.toThrow()
    await expect(q("insert into partner_password_resets values(gen_random_uuid(),$1,'plaintext-token',now(),now()+interval '10 minutes',null)", [PARTNER_USER])).rejects.toThrow()
    await expect(q("insert into partner_application_withdrawals values(gen_random_uuid(),3,$1,now(),now()+interval '2 days',null)", ["b".repeat(64)])).rejects.toThrow()
  })

  it("answers identically for unknown, inactive and staff accounts, and emails only activated partners", async () => {
    for (const email of ["nobody@example.test", "pending@example.test", "founder@example.test"]) expect(await requestPasswordReset(email)).toEqual({ message: GENERIC_RESET_REPLY })
    expect(state.sent).toHaveLength(0)
    expect(await requestPasswordReset(" Partner@Example.TEST ")).toEqual({ message: GENERIC_RESET_REPLY })
    expect(state.sent).toHaveLength(1)
    expect(state.sent[0].email.kind).toBe("password_reset")
    expect(state.sent[0].email.link).toMatch(/^https:\/\/partners\.scalesmiths\.co\.uk\/partner\/reset#token=[A-Za-z0-9_-]{43}$/)
    const stored = (await q<{ token_sha256: string }>("select token_sha256 from partner_password_resets")).rows
    expect(stored).toEqual([{ token_sha256: tokenDigest(lastToken()) }]) // only the digest is stored
    await expect(requestPasswordReset("not-an-email")).rejects.toThrow("valid email")
  })

  it("resets once, ends every session, voids other links and refuses reuse, expiry and weak passwords", async () => {
    await requestPasswordReset("partner@example.test"); const first = lastToken()
    await requestPasswordReset("partner@example.test"); const second = lastToken()
    await expect(resetPartnerPassword(second, "short")).rejects.toThrow("at least 12")
    await resetPartnerPassword(second, "a-new-secure-password")
    const [user] = (await q<{ session_version: number; password_hash: string }>("select session_version,password_hash from admin_users where id=$1", [PARTNER_USER])).rows
    expect(user.session_version).toBe(2)
    expect(user.password_hash).toMatch(/^\$2[aby]\$12\$/)
    await expect(resetPartnerPassword(second, "another-secure-password")).rejects.toThrow("invalid or has expired")
    await expect(resetPartnerPassword(first, "another-secure-password")).rejects.toThrow("invalid or has expired") // voided by the reset
    await requestPasswordReset("partner@example.test")
    const later = new Date(Date.now() + 61 * 60 * 1000)
    await expect(resetPartnerPassword(lastToken(), "another-secure-password", later)).rejects.toThrow("invalid or has expired")
    expect((await q("select action from admin_security_audit order by id")).rows.map((r) => r.action)).toContain("partner_password_reset")
  }, 30000)

  it("caps outstanding reset links per account", async () => {
    for (let i = 0; i < 5; i++) await requestPasswordReset("partner@example.test")
    expect(state.sent).toHaveLength(3)
  })

  it("withdraws an open application only through its emailed link, revokes any invitation and keeps the record for retention", async () => {
    expect(await requestApplicationWithdrawal("done@example.test")).toEqual({ message: GENERIC_WITHDRAWAL_REPLY }) // declined: nothing to withdraw
    expect(await requestApplicationWithdrawal("partner@example.test")).toEqual({ message: GENERIC_WITHDRAWAL_REPLY }) // activated: not an applicant
    expect(state.sent).toHaveLength(0)
    await requestApplicationWithdrawal("ada@example.test")
    expect(state.sent[0].email.kind).toBe("withdrawal_confirmation")
    const token = lastToken()
    expect((await previewApplicationWithdrawal(token)).submittedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await confirmApplicationWithdrawal(token)
    expect((await q("select status from partner_applications where id=3")).rows[0]).toEqual({ status: "withdrawn" })
    await expect(confirmApplicationWithdrawal(token)).rejects.toThrow("invalid or has expired")
    await expect(previewApplicationWithdrawal(token)).rejects.toThrow("invalid or has expired")
    // An invited applicant who withdraws can no longer activate.
    await requestApplicationWithdrawal("pending@example.test"); await confirmApplicationWithdrawal(lastToken())
    expect((await q("select invitation_hash from expansion_partners where id=$1", [PENDING_PARTNER])).rows[0]).toEqual({ invitation_hash: null })
    expect((await q("select count(*)::int n from partner_applications")).rows[0]).toEqual({ n: 4 }) // nothing deleted; retention decides later
    const audit = (await q<{ metadata_json: { from: string; by: string } }>("select metadata_json from admin_security_audit where action='partner_application_withdrawn' order by id")).rows
    expect(audit.map((a) => [a.metadata_json.from, a.metadata_json.by])).toEqual([["under_review", "applicant"], ["onboarding", "applicant"]])
  })

  it("refuses malformed and expired withdrawal links", async () => {
    await expect(confirmApplicationWithdrawal("x")).rejects.toThrow("invalid or has expired")
    await requestApplicationWithdrawal("ada@example.test")
    await expect(confirmApplicationWithdrawal(lastToken(), new Date(Date.now() + 25 * 60 * 60 * 1000))).rejects.toThrow("invalid or has expired")
    expect((await q("select status from partner_applications where id=3")).rows[0]).toEqual({ status: "under_review" })
  })
})
