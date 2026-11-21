import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/*
 * Operation Launch Ready: partner onboarding, agreements and founder approval gates against real PostgreSQL, as the restricted
 * admin runtime role in CI. Synthetic, visibly labelled fixtures only; no email is sent and nothing reaches a real applicant.
 */
type Actor = { id: string; role: "owner" | "independent_partner" | "viewer"; active: boolean; sessionVersion: number; displayName: string }
const state = vi.hoisted(() => ({ database: null as NodePgDatabase<typeof schema> | null, actors: null as AsyncLocalStorage<Actor> | null }))
vi.mock("@/lib/db", () => ({ db: {
  execute: (...args: Parameters<NodePgDatabase<typeof schema>["execute"]>) => state.database!.execute(...args),
  transaction: (operation: Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]) => state.database!.transaction(operation),
} }))
vi.mock("../../src/lib/server/rbac", () => ({ requireCapability: async (capability: Capability) => {
  const actor = state.actors?.getStore()
  if (!actor || !hasCapability(actor.role, capability)) throw new Error("Forbidden capability")
  return { ...actor }
} }))

import { founderMutation, founderSnapshot } from "../../src/lib/server/expansion"
import { activatePartnerInvitation, previewInvitationAgreement } from "../../src/lib/server/partner-invitations"
import { acceptReissuedAgreement, acceptedAgreementDocument, partnerAgreementOverview } from "../../src/lib/server/partner-agreements"
import { archiveContentVersion, createContentItem, decideContentVersion, publishContentVersion, saveContentDraft, startContentRevision, submitContentVersion } from "../../src/lib/server/empower-content"

function safeUrl(value: string | undefined): string {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required.")
  const url = new URL(value)
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || !["55440", "55444"].includes(url.port) || url.pathname !== "/ss_expansion_test") throw new Error("Onboarding tests require the designated disposable database.")
  return value
}

const suffix = randomUUID().slice(0, 8)
const MARKET = "QL"
const founderA: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: `TEST ONLY Onboarding founder A ${suffix}` }
const founderB: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: `TEST ONLY Onboarding founder B ${suffix}` }
const viewer: Actor = { id: randomUUID(), role: "viewer", active: true, sessionVersion: 1, displayName: `TEST ONLY Onboarding viewer ${suffix}` }
let pool: Pool
const runAs = <T>(actor: Actor, operation: () => Promise<T>) => state.actors!.run(actor, operation)
const reviewBy = () => { const d = new Date(); d.setUTCMonth(d.getUTCMonth() + 2); return d.toISOString().slice(0, 10) }
const BODY = `TEST ONLY partner agreement text for automated onboarding tests (${suffix}). It is not a real agreement and binds nobody. `.repeat(3)
const ALL_CONFIRMED = { legal: true, agreement: true, independentStatus: true, operations: true }

async function publishAgreement(slug: string) {
  const c = await runAs(founderA, () => createContentItem({ kind: "agreement", slug, audience: "partner_only", cadence: "commercial", title: `TEST ONLY Partner Agreement ${slug}`, body: BODY, fields: {}, sourceRefs: ["legal:test-only-review"] }))
  await runAs(founderA, () => submitContentVersion({ versionId: c.versionId }))
  await runAs(founderB, () => decideContentVersion({ versionId: c.versionId, decision: "approved", reference: "TEST ONLY FD-AGR", notes: "TEST ONLY agreement approval", reviewBy: reviewBy() }))
  await runAs(founderB, () => publishContentVersion({ versionId: c.versionId }))
  return c
}
async function digest(versionId: string) {
  return (await pool.query<{ d: string }>("select partner_agreement_digest(title, body) d from empower_content_versions where id=$1", [versionId])).rows[0].d
}
async function acceptance(versionId: string, name = "TEST ONLY Partner") {
  return { accepted: true, signatoryName: name, versionId, sha256: await digest(versionId) }
}
async function applicant(label: string, status = "submitted") {
  const r = await pool.query<{ id: number }>(`insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until)
    values($1,$2,'TEST ONLY','Demonstration experience for tests','Isolated onboarding test only','test-reviewed-v1',$3,now()+interval '30 days') returning id`, [`TEST ONLY ${label} ${suffix}`, `${label}-${suffix}@example.invalid`, status])
  return r.rows[0].id
}
const review = (id: number, status: string, confirmations: Record<string, boolean> = {}) =>
  runAs(founderA, () => founderMutation({ action: "review_application", id, status, notes: `TEST ONLY review to ${status}`, ...confirmations }))
async function toOnboarding(id: number) {
  for (const s of ["under_review", "assessment_in_progress", "approved_in_principle", "agreement_pending"]) await review(id, s)
  await review(id, "onboarding", ALL_CONFIRMED)
}
async function partnerActor(applicationId: number): Promise<Actor & { partnerId: string }> {
  const r = (await pool.query("select u.id,u.session_version,u.display_name,p.id partner_id from expansion_partners p join admin_users u on u.id=p.user_id where p.application_id=$1", [applicationId])).rows[0]
  return { id: r.id, role: "independent_partner", active: true, sessionVersion: r.session_version, displayName: r.display_name, partnerId: r.partner_id }
}

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Operation Launch Ready onboarding, agreements and approval gates on real PostgreSQL", () => {
  let v1: { itemId: string; versionId: string }
  beforeAll(async () => {
    pool = new Pool({ connectionString: safeUrl(process.env.EXPANSION_TEST_DATABASE_URL), max: 6 })
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const f of [founderA, founderB, viewer]) await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [f.id, `onboarding-${f.id}@example.invalid`, f.displayName, f.role])
    vi.stubEnv("EMPOWER_FOUNDER_CONTENT_ENABLED", "true"); vi.stubEnv("PARTNER_ACTIVATION_ENABLED", "true")
    v1 = await publishAgreement(`agreement-${suffix}`)
    // A synthetic operating market, approved through the real founder command, so invitations exercise the market gate too.
    await runAs(founderA, () => founderMutation({ action: "set_market", countryCode: MARKET, countryName: `Testland ${MARKET}`, status: "approved", planKeys: ["standard-v2"], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: `TEST ONLY ${suffix}` }))
  })
  afterAll(async () => { vi.unstubAllEnvs(); await pool?.end() })

  it("enforces the application lifecycle in the service and in the database", async () => {
    const id = await applicant("lifecycle")
    await expect(review(id, "onboarding", ALL_CONFIRMED)).rejects.toMatchObject({ status: 409 })
    await expect(review(id, "approved_in_principle")).rejects.toMatchObject({ status: 409 })
    await expect(review(id, "activated")).rejects.toThrow(/Invalid recruitment state/)
    await review(id, "under_review"); await review(id, "information_requested"); await review(id, "assessment_in_progress")
    // A direct write as the runtime role cannot skip steps either.
    await expect(pool.query("update partner_applications set status='onboarding' where id=$1", [id])).rejects.toThrow(/cannot move from assessment_in_progress to onboarding/)
    await review(id, "approved_in_principle"); await review(id, "agreement_pending")
    await expect(pool.query("update partner_applications set status='onboarding' where id=$1", [id])).rejects.toThrow(/founder onboarding confirmation/)
    await expect(pool.query("update partner_applications set status='activated' where id=$1", [id])).rejects.toThrow(/cannot move from agreement_pending to activated/)
    await review(id, "onboarding", ALL_CONFIRMED)
    await expect(pool.query("update partner_applications set status='activated' where id=$1", [id])).rejects.toThrow(/accepts the issued agreement/)
    const audit = (await pool.query("select details->>'from' f, details->>'status' t from expansion_audit where entity_id=$1 and action='application_reviewed' order by id", [String(id)])).rows
    expect(audit.at(-1)).toEqual({ f: "agreement_pending", t: "onboarding" })
  })

  it("denies founder commands to non-founders and to partners", async () => {
    const id = await applicant("denied")
    await expect(runAs(viewer, () => founderMutation({ action: "review_application", id, status: "under_review", notes: "x" }))).rejects.toThrow(/Forbidden/)
    await expect(runAs(viewer, () => founderSnapshot())).rejects.toThrow(/Forbidden/)
  })

  it("runs the whole journey: invitation with a published agreement, preview, acceptance, activation and the partner's own record", async () => {
    const id = await applicant("journey")
    await toOnboarding(id)
    await expect(runAs(founderA, () => founderMutation({ action: "invite", operatingCountry: MARKET, id, agreementVersion: "free-text-v1" }))).rejects.toMatchObject({ status: 400 })
    const invitation = await runAs(founderA, () => founderMutation({ action: "invite", operatingCountry: MARKET, id, agreementVersionId: v1.versionId })) as { invitationToken: string }
    const shown = await previewInvitationAgreement(invitation.invitationToken)
    expect(shown).toMatchObject({ versionId: v1.versionId, version: 1, sha256: await digest(v1.versionId) })
    await expect(activatePartnerInvitation(invitation.invitationToken, "TestOnly!Onboarding-123")).rejects.toMatchObject({ status: 400 })
    await activatePartnerInvitation(invitation.invitationToken, "TestOnly!Onboarding-123", await acceptance(v1.versionId))
    await expect(activatePartnerInvitation(invitation.invitationToken, "TestOnly!Onboarding-123", await acceptance(v1.versionId))).rejects.toMatchObject({ status: 400 })
    expect((await pool.query("select status from partner_applications where id=$1", [id])).rows).toEqual([{ status: "activated" }])
    const partner = await partnerActor(id)
    const overview = await runAs(partner, () => partnerAgreementOverview())
    expect(overview).toMatchObject({ pending: false, issuedCurrent: true, accepted: { versionId: v1.versionId, version: 1, signatoryName: "TEST ONLY Partner" } })
    expect(overview.history).toHaveLength(1)
    const copy = await runAs(partner, () => acceptedAgreementDocument(overview.accepted!.acceptanceId, "partner"))
    expect(copy.text).toContain(`SHA-256 of the agreement text: ${await digest(v1.versionId)}`)
    expect(copy.text).toContain("It is not a qualified electronic signature.")
    const register = (await runAs(founderA, () => founderSnapshot())).agreementRegister
    expect(register.partners.find((p) => p.partner_id === partner.partnerId)).toMatchObject({ accepted_issued: true, accepted_version: 1 })
  })

  it("reissues a superseding version: the partner keeps access, must accept it, and earlier evidence stays", async () => {
    const id = await applicant("reissue")
    await toOnboarding(id)
    const inv = await runAs(founderA, () => founderMutation({ action: "invite", operatingCountry: MARKET, id, agreementVersionId: v1.versionId })) as { invitationToken: string }
    await activatePartnerInvitation(inv.invitationToken, "TestOnly!Onboarding-123", await acceptance(v1.versionId))
    const partner = await partnerActor(id)
    // Founders revise and publish version 2 through the normal two-founder path; version 1 becomes superseded.
    const rev = await runAs(founderA, () => startContentRevision({ itemId: v1.itemId, changeSummary: "TEST ONLY clause update" }))
    await runAs(founderA, () => saveContentDraft({ versionId: rev.versionId, title: `TEST ONLY Partner Agreement v2 ${suffix}`, body: `${BODY} Revised clause.`, fields: {}, sourceRefs: ["legal:test-only-review-2"] }))
    await runAs(founderA, () => submitContentVersion({ versionId: rev.versionId }))
    await runAs(founderB, () => decideContentVersion({ versionId: rev.versionId, decision: "approved", reference: "TEST ONLY FD-AGR2", notes: "TEST ONLY v2 approval", reviewBy: reviewBy() }))
    await runAs(founderB, () => publishContentVersion({ versionId: rev.versionId }))
    expect(await runAs(partner, () => partnerAgreementOverview())).toMatchObject({ issuedCurrent: false, pending: false })
    const old = await acceptance(v1.versionId)
    await expect(runAs(partner, () => acceptReissuedAgreement(old))).rejects.toMatchObject({ status: 409 })
    await runAs(founderA, () => founderMutation({ action: "reissue_agreement", id: partner.partnerId, agreementVersionId: rev.versionId }))
    await expect(runAs(founderA, () => founderMutation({ action: "reissue_agreement", id: partner.partnerId, agreementVersionId: rev.versionId }))).rejects.toMatchObject({ status: 409 })
    expect(await runAs(partner, () => partnerAgreementOverview())).toMatchObject({ pending: true, issued: { versionId: rev.versionId, version: 2 } })
    // A stale page (old digest) cannot accept the new version.
    const stale = { ...(await acceptance(rev.versionId)), sha256: "f".repeat(64) }
    await expect(runAs(partner, () => acceptReissuedAgreement(stale))).rejects.toThrow(/has changed/)
    // Two concurrent acceptances of the same version: exactly one is recorded.
    const body = await acceptance(rev.versionId)
    const results = await Promise.allSettled([runAs(partner, () => acceptReissuedAgreement(body)), runAs(partner, () => acceptReissuedAgreement(body))])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const after = await runAs(partner, () => partnerAgreementOverview())
    expect(after).toMatchObject({ pending: false, accepted: { version: 2 } })
    expect(after.history.map((h) => [h.version, h.method])).toEqual([[2, "reissue"], [1, "activation"]])
  })

  it("never lets one partner read or accept another partner's agreement", async () => {
    const [a, b] = [await applicant("cross-a"), await applicant("cross-b")]
    for (const id of [a, b]) {
      await toOnboarding(id)
      const current = await currentVersion(v1.itemId)
      const inv = await runAs(founderA, () => founderMutation({ action: "invite", operatingCountry: MARKET, id, agreementVersionId: current })) as { invitationToken: string }
      await activatePartnerInvitation(inv.invitationToken, "TestOnly!Onboarding-123", await acceptance(await currentVersion(v1.itemId)))
    }
    const [pa, pb] = [await partnerActor(a), await partnerActor(b)]
    const aOverview = await runAs(pa, () => partnerAgreementOverview())
    await expect(runAs(pb, () => acceptedAgreementDocument(aOverview.accepted!.acceptanceId, "partner"))).rejects.toMatchObject({ status: 404 })
    await expect(runAs(pb, () => acceptedAgreementDocument(aOverview.accepted!.acceptanceId, "founder"))).rejects.toThrow(/Forbidden/)
    expect((await runAs(founderA, () => acceptedAgreementDocument(aOverview.accepted!.acceptanceId, "founder"))).text).toContain(String(aOverview.accepted!.sha256))
    // A forged direct insert naming partner A by partner B's identity is refused by the database.
    await expect(pool.query(`insert into partner_agreement_acceptances (id,partner_id,user_id,content_version_id,agreement_slug,agreement_version,agreement_title,content_sha256,signatory_name,statement,method)
      values ($1,$2,$3,$4,'x',1,'x',$5,'Forger','I accept this agreement in full for testing.','reissue')`, [randomUUID(), pa.partnerId, pb.id, aOverview.accepted!.versionId, "0".repeat(64)])).rejects.toThrow(/partner it was issued to/)
  })

  it("fails closed when the issued agreement is withdrawn before activation, and revocation removes access", async () => {
    const draft = await publishAgreement(`agreement-withdrawn-${suffix}`)
    const id = await applicant("withdrawn")
    await toOnboarding(id)
    const inv = await runAs(founderA, () => founderMutation({ action: "invite", operatingCountry: MARKET, id, agreementVersionId: draft.versionId })) as { invitationToken: string }
    await runAs(founderB, () => archiveContentVersion({ versionId: draft.versionId, reason: "TEST ONLY withdrawn agreement" }))
    await expect(previewInvitationAgreement(inv.invitationToken)).rejects.toMatchObject({ status: 409 })
    await expect(activatePartnerInvitation(inv.invitationToken, "TestOnly!Onboarding-123", await acceptance(draft.versionId))).rejects.toMatchObject({ status: 409 })
    expect((await pool.query("select u.active, p.invitation_hash is not null pending from expansion_partners p join admin_users u on u.id=p.user_id where p.application_id=$1", [id])).rows).toEqual([{ active: false, pending: true }])
    const other = await applicant("withdrawn-2")
    await toOnboarding(other)
    await expect(runAs(founderA, () => founderMutation({ action: "invite", operatingCountry: MARKET, id: other, agreementVersionId: draft.versionId }))).rejects.toMatchObject({ status: 409 })
    // Revocation of an active partner: sessions end and the agreement page refuses them.
    const active = await applicant("revoked")
    await toOnboarding(active)
    const currentV = await currentVersion(v1.itemId)
    const inv2 = await runAs(founderA, () => founderMutation({ action: "invite", operatingCountry: MARKET, id: active, agreementVersionId: currentV })) as { invitationToken: string }
    await activatePartnerInvitation(inv2.invitationToken, "TestOnly!Onboarding-123", await acceptance(await currentVersion(v1.itemId)))
    const partner = await partnerActor(active)
    await runAs(founderA, () => founderMutation({ action: "revoke_partner", id: partner.partnerId }))
    await expect(runAs(partner, () => partnerAgreementOverview())).rejects.toMatchObject({ status: 403 })
  })
})

async function currentVersion(itemId: string) {
  return String((await pool.query("select id from empower_content_versions where item_id=$1 and status='published'", [itemId])).rows[0].id)
}
