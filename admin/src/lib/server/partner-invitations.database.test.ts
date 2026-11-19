import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite"
import { sql } from "drizzle-orm"
import type { AdminDatabaseTransaction } from "@/lib/db"

const runtime = vi.hoisted(() => ({ transaction: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: { transaction: runtime.transaction } }))
import { activatePartnerInvitation, invitationHash, issueInvitation } from "./partner-invitations"
import { updateAdminUser } from "./admin-users"

let postgres: PGlite
let database: PgliteDatabase
const founderId = "00000000-0000-4000-8000-000000000001"

beforeEach(async () => {
  vi.stubEnv("PARTNER_ACTIVATION_ENABLED", "true")
  postgres = new PGlite()
  database = drizzle(postgres)
  runtime.transaction.mockImplementation((operation) => database.transaction(operation))
  // Minimal real PostgreSQL fixtures for the existing identity domain. Partner
  // profile DDL below is taken from the new production migration at runtime.
  await postgres.exec(`
    create type admin_user_role as enum ('owner','administrator','viewer','independent_partner');
    create table admin_users (
      id uuid primary key default gen_random_uuid(), email text not null,
      display_name text not null, password_hash text not null, role admin_user_role not null,
      active boolean not null default true, mfa_enabled boolean not null default false,
      mfa_state jsonb, session_version integer not null default 1, last_login_at timestamptz,
      password_changed_at timestamptz not null default now(), created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create unique index admin_users_email_lower_idx on admin_users(lower(email));
    create table admin_security_audit (
      id serial primary key, actor_user_id uuid references admin_users(id), target_user_id uuid references admin_users(id),
      action text not null, success boolean not null, metadata_json jsonb, created_at timestamptz default now()
    );
    create table partner_applications (
      id serial primary key, name text not null, email text not null, status text not null,
      onboarding_confirmations jsonb not null default '{}'
    );
  `)
  const { readFileSync } = await import("node:fs")
  const migration = readFileSync("drizzle/0068_expansion_foundation.sql", "utf8")
  const profileDdl = migration.match(/CREATE TABLE expansion_partners\s*\([\s\S]*?\n\);/)?.[0]
  if (!profileDdl) throw new Error("Production partner profile migration was not found.")
  await postgres.exec(profileDdl)
  // The real market-enforcement migration, over a minimal markets fixture (the launch market starts approved so existing cases are unchanged).
  await postgres.exec(readFileSync("drizzle/0085_expansion_market_enforcement.sql", "utf8"))
  await postgres.exec(`create table expansion_markets(country_code text primary key, status text not null, plan_keys text[] not null default '{}'); insert into expansion_markets values('GB','approved','{standard-v2}')`)
  await database.execute(sql`insert into admin_users (id,email,display_name,password_hash,role) values (${founderId},'founder@example.test','Founder','unused','owner')`)
  await database.execute(sql`insert into partner_applications (name,email,status,onboarding_confirmations) values ('Partner','partner@example.test','onboarding','{"agreement":true,"legal":true,"independentStatus":true,"operations":true}'::jsonb)`)
}, 30000)
afterEach(async () => { vi.unstubAllEnvs(); await postgres?.close() }, 30000)

function invite() {
  return database.transaction((tx) => issueInvitation(tx as unknown as AdminDatabaseTransaction, 1, founderId, "agreement-test-v1"))
}

describe("partner invitations against PostgreSQL", () => {
  it("fails closed on the operating market: unknown and unapproved markets cannot be invited, and activation re-checks without consuming the token", async () => {
    const issue = (country?: string) => database.transaction((tx) => issueInvitation(tx as unknown as AdminDatabaseTransaction, 1, founderId, "agreement-test-v1", country))
    await expect(issue("FR")).rejects.toThrow("operating market is not approved")          // never configured: international applicants are reviewed, not invited
    await expect(issue("France")).rejects.toThrow("two-letter")
    expect((await postgres.query("select id from expansion_partners")).rows).toEqual([])
    const invitation = await issue("GB")
    expect((await postgres.query("select operating_country from expansion_partners")).rows).toEqual([{ operating_country: "GB" }])
    await postgres.query("update expansion_markets set status='suspended' where country_code='GB'")
    await expect(issue("GB")).rejects.toThrow()
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password")).rejects.toThrow("Activation is not available for this market")
    expect((await postgres.query("select u.active,p.invitation_hash is not null pending,p.activated_at from admin_users u join expansion_partners p on p.user_id=u.id where u.role='independent_partner'")).rows).toEqual([{ active: false, pending: true, activated_at: null }])
    await postgres.query("update expansion_markets set status='approved' where country_code='GB'")
    await activatePartnerInvitation(invitation.invitationToken, "secure-example-password")
    expect((await postgres.query("select active from admin_users where role='independent_partner'")).rows).toEqual([{ active: true }])
  })
  it("blocks issuance by default and leaves an already-issued invitation unconsumed while closed", async () => {
    vi.stubEnv("PARTNER_ACTIVATION_ENABLED", undefined)
    await expect(invite()).rejects.toThrow("activation is currently closed")
    expect((await postgres.query("select id from expansion_partners")).rows).toEqual([])
    vi.stubEnv("PARTNER_ACTIVATION_ENABLED", "true")
    const invitation = await invite()
    vi.stubEnv("PARTNER_ACTIVATION_ENABLED", "false")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password")).rejects.toThrow("activation is currently closed")
    expect((await postgres.query("select u.active, p.invitation_hash from admin_users u join expansion_partners p on p.user_id=u.id")).rows)
      .toEqual([{ active: false, invitation_hash: invitationHash(invitation.invitationToken) }])
  })
  it("stores a hash, consumes once, activates only the external identity and audits both events", async () => {
    const invitation = await invite()
    const before = await postgres.query<{ active: boolean; role: string; invitation_hash: string }>("select u.active,u.role,p.invitation_hash from expansion_partners p join admin_users u on u.id=p.user_id")
    expect(before.rows).toEqual([{ active: false, role: "independent_partner", invitation_hash: invitationHash(invitation.invitationToken) }])
    await activatePartnerInvitation(invitation.invitationToken, "secure-example-password")
    await expect(activatePartnerInvitation(invitation.invitationToken, "different-secure-password")).rejects.toThrow("invalid or unavailable")
    const after = await postgres.query<{ active: boolean; role: string; session_version: number; invitation_hash: string | null; status: string }>("select u.active,u.role,u.session_version,p.invitation_hash,a.status from expansion_partners p join admin_users u on u.id=p.user_id join partner_applications a on a.id=p.application_id")
    expect(after.rows).toEqual([{ active: true, role: "independent_partner", session_version: 2, invitation_hash: null, status: "activated" }])
    expect((await postgres.query("select action from admin_security_audit order by id")).rows).toEqual([{ action: "partner_invitation_issued" }, { action: "partner_activated" }])
  })

  it("rechecks every founder prerequisite and rejects non-founder issuance", async () => {
    await postgres.exec("update partner_applications set onboarding_confirmations='{}'")
    await expect(invite()).rejects.toThrow("every onboarding confirmation")
    expect((await postgres.query("select id from expansion_partners")).rows).toHaveLength(0)
    await postgres.exec("update admin_users set role='viewer'")
    await expect(invite()).rejects.toThrow("Founder authority")
  })

  it("rejects duplicate invitations and existing internal identity collisions", async () => {
    await database.execute(sql`insert into admin_users (email,display_name,password_hash,role) values ('PARTNER@example.test','Existing','unused','owner')`)
    await expect(invite()).rejects.toThrow("identity already exists")
    await postgres.exec("delete from admin_users where email='PARTNER@example.test'")
    await invite()
    await expect(invite()).rejects.toThrow("invitation already exists")
    expect((await postgres.query("select id from expansion_partners")).rows).toHaveLength(1)
  })

  it("rejects expiry and withdrawal after an invitation was issued", async () => {
    const invitation = await invite()
    await postgres.exec("update expansion_partners set invitation_expires_at=now()-interval '1 second'")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password")).rejects.toThrow("invalid or unavailable")
    await postgres.exec("update expansion_partners set invitation_expires_at=now()+interval '1 hour'; update partner_applications set status='withdrawn'")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password")).rejects.toThrow("invalid or unavailable")
    expect((await postgres.query("select active from admin_users where role='independent_partner'")).rows).toEqual([{ active: false }])
  })

  it("admits exactly one of two concurrent activation attempts", async () => {
    const invitation = await invite()
    const results = await Promise.allSettled([activatePartnerInvitation(invitation.invitationToken, "first-secure-password"), activatePartnerInvitation(invitation.invitationToken, "second-secure-password")])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    expect((await postgres.query("select action from admin_security_audit where action='partner_activated'")).rows).toHaveLength(1)
  })

  it("renews an expired invitation on the same inactive identity and invalidates its old token", async () => {
    const original = await invite()
    await postgres.exec("update expansion_partners set invitation_expires_at=now()-interval '1 second'")
    const renewal = await invite()
    expect(renewal.partnerId).toBe(original.partnerId)
    expect(renewal.invitationToken).not.toBe(original.invitationToken)
    expect((await postgres.query("select id from admin_users where role='independent_partner'")).rows).toHaveLength(1)
    await expect(activatePartnerInvitation(original.invitationToken, "secure-example-password")).rejects.toThrow("invalid or unavailable")
    await activatePartnerInvitation(renewal.invitationToken, "secure-example-password")
    expect((await postgres.query("select action from admin_security_audit where action='partner_invitation_reissued'")).rows).toHaveLength(1)
  })

  it("does not revive a revoked pending invitation through the renewal path", async () => {
    await invite()
    await postgres.exec("update expansion_partners set invitation_hash=null,invitation_expires_at=null")
    await expect(invite()).rejects.toThrow("requires explicit founder review")
    expect((await postgres.query("select active from admin_users where role='independent_partner'")).rows).toEqual([{ active: false }])
  })

  it("generic founder emergency revocation also invalidates a pending invitation", async () => {
    const invitation = await invite()
    const identity = (await postgres.query<{ id: string }>("select id from admin_users where role='independent_partner'")).rows[0]
    await updateAdminUser(identity.id, { active: false, revokeSessions: true }, { id: founderId, role: "owner" })
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password")).rejects.toThrow("invalid or unavailable")
    await expect(invite()).rejects.toThrow("requires explicit founder review")
  })
})
