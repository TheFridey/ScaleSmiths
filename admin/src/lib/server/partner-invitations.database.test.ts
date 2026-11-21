import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite"
import { sql } from "drizzle-orm"
import type { AdminDatabaseTransaction } from "@/lib/db"

const runtime = vi.hoisted(() => ({ transaction: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: { transaction: runtime.transaction } }))
import { activatePartnerInvitation, invitationHash, issueInvitation, previewInvitationAgreement } from "./partner-invitations"
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
  // Operation Launch Ready: minimal governed-content fixtures plus the real agreement DDL (functions, columns, acceptance table, triggers) from migration 0095.
  await postgres.exec(`
    create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'Commercial history is append-only'; end $$;
    create table empower_content_items(id uuid primary key, kind text not null, slug text not null);
    create table empower_content_versions(id uuid primary key, item_id uuid not null references empower_content_items(id), version integer not null, title text not null, body text not null, status text not null, review_by date, published_at timestamptz);
  `)
  const agreementSql = readFileSync("drizzle/0095_partner_agreements.sql", "utf8")
  await postgres.exec(agreementSql.slice(agreementSql.indexOf("CREATE FUNCTION partner_agreement_digest"), agreementSql.indexOf("-- 'information_requested'")))
  await postgres.exec(`insert into empower_content_items values('${AGREEMENT_ITEM}','agreement','independent-partner-agreement');
    insert into empower_content_versions values('${AGREEMENT_VERSION}','${AGREEMENT_ITEM}',1,'TEST ONLY Independent Partner Agreement','TEST ONLY agreement text for automated tests. Not a real agreement.','published',current_date + 30, now())`)
  await database.execute(sql`insert into admin_users (id,email,display_name,password_hash,role) values (${founderId},'founder@example.test','Founder','unused','owner')`)
  await database.execute(sql`insert into partner_applications (name,email,status,onboarding_confirmations) values ('Partner','partner@example.test','onboarding','{"agreement":true,"legal":true,"independentStatus":true,"operations":true}'::jsonb)`)
}, 30000)
afterEach(async () => { vi.unstubAllEnvs(); await postgres?.close() }, 30000)

const AGREEMENT_ITEM = "30000000-0000-4000-8000-000000000001"
const AGREEMENT_VERSION = "30000000-0000-4000-8000-000000000002"
async function acceptance(overrides: Record<string, unknown> = {}) {
  const digest = (await postgres.query<{ d: string }>("select partner_agreement_digest(title, body) d from empower_content_versions where id=$1", [AGREEMENT_VERSION])).rows[0].d
  return { accepted: true, signatoryName: "Test Partner", versionId: AGREEMENT_VERSION, sha256: digest, ...overrides }
}
function invite() {
  return database.transaction((tx) => issueInvitation(tx as unknown as AdminDatabaseTransaction, 1, founderId, AGREEMENT_VERSION))
}

describe("partner invitations against PostgreSQL", () => {
  it("fails closed on the operating market: unknown and unapproved markets cannot be invited, and activation re-checks without consuming the token", async () => {
    const issue = (country?: string) => database.transaction((tx) => issueInvitation(tx as unknown as AdminDatabaseTransaction, 1, founderId, AGREEMENT_VERSION, country))
    await expect(issue("FR")).rejects.toThrow("operating market is not approved")          // never configured: international applicants are reviewed, not invited
    await expect(issue("France")).rejects.toThrow("two-letter")
    expect((await postgres.query("select id from expansion_partners")).rows).toEqual([])
    const invitation = await issue("GB")
    expect((await postgres.query("select operating_country from expansion_partners")).rows).toEqual([{ operating_country: "GB" }])
    await postgres.query("update expansion_markets set status='suspended' where country_code='GB'")
    await expect(issue("GB")).rejects.toThrow()
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())).rejects.toThrow("Activation is not available for this market")
    expect((await postgres.query("select u.active,p.invitation_hash is not null pending,p.activated_at from admin_users u join expansion_partners p on p.user_id=u.id where u.role='independent_partner'")).rows).toEqual([{ active: false, pending: true, activated_at: null }])
    await postgres.query("update expansion_markets set status='approved' where country_code='GB'")
    await activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())
    expect((await postgres.query("select active from admin_users where role='independent_partner'")).rows).toEqual([{ active: true }])
  })
  it("blocks issuance by default and leaves an already-issued invitation unconsumed while closed", async () => {
    vi.stubEnv("PARTNER_ACTIVATION_ENABLED", undefined)
    await expect(invite()).rejects.toThrow("activation is currently closed")
    expect((await postgres.query("select id from expansion_partners")).rows).toEqual([])
    vi.stubEnv("PARTNER_ACTIVATION_ENABLED", "true")
    const invitation = await invite()
    vi.stubEnv("PARTNER_ACTIVATION_ENABLED", "false")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())).rejects.toThrow("activation is currently closed")
    expect((await postgres.query("select u.active, p.invitation_hash from admin_users u join expansion_partners p on p.user_id=u.id")).rows)
      .toEqual([{ active: false, invitation_hash: invitationHash(invitation.invitationToken) }])
  })
  it("stores a hash, consumes once, activates only the external identity and audits both events", async () => {
    const invitation = await invite()
    const before = await postgres.query<{ active: boolean; role: string; invitation_hash: string }>("select u.active,u.role,p.invitation_hash from expansion_partners p join admin_users u on u.id=p.user_id")
    expect(before.rows).toEqual([{ active: false, role: "independent_partner", invitation_hash: invitationHash(invitation.invitationToken) }])
    await activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())
    await expect(activatePartnerInvitation(invitation.invitationToken, "different-secure-password", await acceptance())).rejects.toThrow("invalid or unavailable")
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
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())).rejects.toThrow("invalid or unavailable")
    await postgres.exec("update expansion_partners set invitation_expires_at=now()+interval '1 hour'; update partner_applications set status='withdrawn'")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())).rejects.toThrow("invalid or unavailable")
    expect((await postgres.query("select active from admin_users where role='independent_partner'")).rows).toEqual([{ active: false }])
  })

  it("admits exactly one of two concurrent activation attempts", async () => {
    const invitation = await invite()
    const results = await Promise.allSettled([activatePartnerInvitation(invitation.invitationToken, "first-secure-password", await acceptance()), activatePartnerInvitation(invitation.invitationToken, "second-secure-password", await acceptance())])
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
    await expect(activatePartnerInvitation(original.invitationToken, "secure-example-password", await acceptance())).rejects.toThrow("invalid or unavailable")
    await activatePartnerInvitation(renewal.invitationToken, "secure-example-password", await acceptance())
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
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())).rejects.toThrow("invalid or unavailable")
    await expect(invite()).rejects.toThrow("requires explicit founder review")
  })

  it("activates only with an explicit acceptance of the exact issued text, and never consumes the token otherwise", async () => {
    const invitation = await invite()
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password")).rejects.toThrow("tick the box")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance({ accepted: "yes" }))).rejects.toThrow("tick the box")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance({ sha256: "0".repeat(64) }))).rejects.toThrow("has changed")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance({ signatoryName: " " }))).rejects.toThrow("full legal name")
    expect((await postgres.query("select count(*)::int n from partner_agreement_acceptances")).rows).toEqual([{ n: 0 }])
    expect((await postgres.query("select u.active, p.invitation_hash is not null pending from admin_users u join expansion_partners p on p.user_id=u.id")).rows).toEqual([{ active: false, pending: true }])
    await activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())
    const [row] = (await postgres.query<{ version: number; sha: string; method: string; recent: boolean; linked: boolean }>(`select a.agreement_version version, a.content_sha256 sha, a.method, a.accepted_at > now() - interval '1 minute' recent,
      p.agreement_acceptance_id = a.id linked from partner_agreement_acceptances a join expansion_partners p on p.id = a.partner_id`)).rows
    expect(row).toEqual({ version: 1, sha: (await acceptance()).sha256, method: "activation", recent: true, linked: true })
  })

  it("fails closed when the issued agreement is withdrawn or superseded after the invitation", async () => {
    const invitation = await invite()
    await postgres.exec(`update empower_content_versions set status='archived' where id='${AGREEMENT_VERSION}'`)
    await expect(previewInvitationAgreement(invitation.invitationToken)).rejects.toThrow("no longer current")
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())).rejects.toThrow("no longer current")
    await postgres.exec(`update empower_content_versions set status='published', review_by=current_date - 1 where id='${AGREEMENT_VERSION}'`)
    await expect(activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())).rejects.toThrow("no longer current")
    expect((await postgres.query("select active from admin_users where role='independent_partner'")).rows).toEqual([{ active: false }])
  })

  it("refuses an invitation for an unpublished agreement and shows the published one to the invitation holder", async () => {
    await expect(database.transaction((tx) => issueInvitation(tx as unknown as AdminDatabaseTransaction, 1, founderId, "30000000-0000-4000-8000-0000000000ff"))).rejects.toThrow("published agreement")
    await expect(database.transaction((tx) => issueInvitation(tx as unknown as AdminDatabaseTransaction, 1, founderId, "free-text-v1"))).rejects.toThrow("published agreement")
    const invitation = await invite()
    const shown = await previewInvitationAgreement(invitation.invitationToken)
    expect(shown).toMatchObject({ versionId: AGREEMENT_VERSION, version: 1, title: "TEST ONLY Independent Partner Agreement", sha256: (await acceptance()).sha256 })
    await expect(previewInvitationAgreement("x".repeat(43))).rejects.toThrow("invalid or unavailable")
  })

  it("keeps acceptance evidence append-only, server-timed and bound to the issued partner", async () => {
    const invitation = await invite()
    await activatePartnerInvitation(invitation.invitationToken, "secure-example-password", await acceptance())
    await expect(postgres.query("update partner_agreement_acceptances set signatory_name='Someone Else'")).rejects.toThrow("append-only")
    await expect(postgres.query("delete from partner_agreement_acceptances")).rejects.toThrow("append-only")
    const partner = (await postgres.query<{ id: string; user_id: string }>("select id, user_id from expansion_partners")).rows[0]
    // A direct insert for another identity, or with a forged digest and backdated time, is refused or corrected by the database.
    await expect(postgres.query(`insert into partner_agreement_acceptances (id,partner_id,user_id,content_version_id,agreement_slug,agreement_version,agreement_title,content_sha256,signatory_name,statement,method)
      values (gen_random_uuid(), $1, $2, $3, 'x', 1, 'x', $4, 'Forger', 'I accept this agreement in full for testing.', 'reissue')`, [partner.id, founderId, AGREEMENT_VERSION, "0".repeat(64)])).rejects.toThrow("partner it was issued to")
    // Activation time and the issued agreement cannot be rewritten.
    await expect(postgres.query("update expansion_partners set activated_at = now() - interval '30 days'")).rejects.toThrow("cannot be changed")
    await expect(postgres.query("update expansion_partners set agreement_content_version_id = null")).rejects.toThrow("cannot be removed")
  })

  it("refuses to activate any partner whose acceptance is missing, even by direct update", async () => {
    await invite()
    await expect(postgres.query("update expansion_partners set activated_at = now()")).rejects.toThrow("only after accepting")
    await expect(postgres.query(`insert into expansion_partners (id,user_id,application_id,agreement_version,agreement_content_version_id,confirmed_at,activated_at)
      select gen_random_uuid(), id, 1, 'x', '${AGREEMENT_VERSION}', now(), now() from admin_users where role='owner'`)).rejects.toThrow()
  })

})
