import "server-only"

import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import type { AdminDatabaseTransaction } from "@/lib/db"
import { AdminIdentityError } from "@/lib/admin-users"
import { ExpansionError } from "@/lib/expansion"
import { acceptanceStatement, parseAcceptance, type AgreementAcceptanceInput } from "@/lib/partner-agreements"

/*
 * Operation Launch Ready: partner agreement records, independent of any session. Callers own the transaction and the authority
 * check: the invitation and activation services, founder commands, and the partner entry points in ./partner-agreements.
 *
 * An agreement is governed content of kind 'agreement' (migration 0095), drafted, approved and published by founders in the
 * Content studio. A founder issues one published version with the invitation; the partner reads it in full and accepts it
 * when activating. The database takes the version, title, SHA-256 of the exact text and the time; this module only checks that
 * the text the partner saw is the text being accepted. Nothing here is a qualified electronic signature.
 */
export type Row = Record<string, unknown>
export type Executor = Pick<AdminDatabaseTransaction, "execute">
export const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]

export type IssuedAgreement = { versionId: string; slug: string; version: number; title: string; body: string; sha256: string; publishedAt: string; reviewBy: string }

export const agreementColumns = sql`cv.id version_id, ci.slug, cv.version, cv.title, cv.body, partner_agreement_digest(cv.title, cv.body) sha256, cv.published_at, cv.review_by`
export const shape = (r: Row): IssuedAgreement => ({
  versionId: String(r.version_id), slug: String(r.slug), version: Number(r.version), title: String(r.title), body: String(r.body), sha256: String(r.sha256),
  publishedAt: new Date(String(r.published_at)).toISOString(), reviewBy: String(r.review_by).slice(0, 10),
})

/** Published, in-date agreement versions a founder can issue. */
export async function currentAgreements(tx: Executor): Promise<IssuedAgreement[]> {
  return (await rows(tx, sql`select ${agreementColumns} from empower_content_versions cv join empower_content_items ci on ci.id = cv.item_id
    where ci.kind = 'agreement' and partner_agreement_current(cv.id) order by ci.slug`)).map(shape)
}

/** The label stored on expansion_partners.agreement_version for older readers: "<slug>@v<version>". */
export async function assertIssuableAgreement(tx: Executor, versionId: unknown): Promise<{ versionId: string; label: string }> {
  if (typeof versionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(versionId)) throw new AdminIdentityError("Choose a published agreement version.", 400, "agreement_required")
  const [row] = await rows(tx, sql`select ci.slug, cv.version from empower_content_versions cv join empower_content_items ci on ci.id = cv.item_id
    where cv.id = ${versionId} and partner_agreement_current(cv.id) for share of cv`)
  if (!row) throw new AdminIdentityError("Only a published agreement within its review date can be issued.", 409, "agreement_not_current")
  return { versionId, label: `${String(row.slug)}@v${Number(row.version)}` }
}

/** Accept inside the caller's transaction. Fails closed if the text changed since the partner was shown it. */
export async function recordAcceptance(tx: Executor, input: { partnerId: string; userId: string; method: "activation" | "reissue"; acceptance: AgreementAcceptanceInput }) {
  const [issued] = await rows(tx, sql`select ${agreementColumns} from expansion_partners p join empower_content_versions cv on cv.id = p.agreement_content_version_id
    join empower_content_items ci on ci.id = cv.item_id where p.id = ${input.partnerId} and partner_agreement_current(cv.id) for update of p`)
  if (!issued) throw new AdminIdentityError("The agreement issued to you is no longer current. ScaleSmiths will contact you with the updated agreement.", 409, "agreement_not_current")
  const agreement = shape(issued)
  if (agreement.versionId !== input.acceptance.versionId || agreement.sha256 !== input.acceptance.sha256) throw new AdminIdentityError("The agreement has changed since you opened it. Reload the page and read the current version before accepting.", 409, "agreement_changed")
  const id = randomUUID()
  // Slug, version, title, digest and time are overwritten by the database trigger; the values here only satisfy column types.
  await tx.execute(sql`insert into partner_agreement_acceptances (id, partner_id, user_id, content_version_id, agreement_slug, agreement_version, agreement_title, content_sha256, signatory_name, statement, method)
    values (${id}, ${input.partnerId}, ${input.userId}, ${agreement.versionId}, ${agreement.slug}, ${agreement.version}, ${agreement.title}, ${agreement.sha256}, ${input.acceptance.signatoryName},
    ${acceptanceStatement(input.acceptance.signatoryName, agreement.title, agreement.version)}, ${input.method})`)
  await tx.execute(sql`update expansion_partners set agreement_acceptance_id = ${id} where id = ${input.partnerId}`)
  return { acceptanceId: id, agreement }
}

/** Activation path: the invitation's own transaction calls this before activating. */
export async function acceptOnActivation(tx: Executor, partnerId: string, userId: string, acceptanceInput: unknown) {
  return recordAcceptance(tx, { partnerId, userId, method: "activation", acceptance: parseAcceptance(acceptanceInput) })
}

/** The agreement an invitation holder must read before activating. Does not consume the invitation. */
export async function agreementForInvitation(tx: Executor, tokenHash: string): Promise<IssuedAgreement> {
  const [row] = await rows(tx, sql`select ${agreementColumns}, partner_agreement_current(cv.id) current from expansion_partners p
    join admin_users u on u.id = p.user_id left join empower_content_versions cv on cv.id = p.agreement_content_version_id left join empower_content_items ci on ci.id = cv.item_id
    where p.invitation_hash = ${tokenHash} and p.invitation_expires_at > now() and p.activated_at is null and u.active = false and u.role = 'independent_partner'`)
  if (!row) throw new AdminIdentityError("Invitation is invalid or unavailable.", 400, "invitation_invalid")
  if (!row.version_id || row.current !== true) throw new AdminIdentityError("The agreement issued with this invitation is no longer current. ScaleSmiths will send you a new invitation.", 409, "agreement_not_current")
  return shape(row)
}

/** Founder register: who holds which version, and whether they have accepted it. */
export async function founderAgreementRegister(tx: Executor) {
  const partners = await rows(tx, sql`select p.id partner_id, u.display_name, u.active, p.activated_at, ci.slug issued_slug, cv.version issued_version, partner_agreement_current(cv.id) issued_current,
    a.id acceptance_id, a.agreement_version accepted_version, a.accepted_at, a.content_sha256, a.content_version_id = p.agreement_content_version_id accepted_issued
    from expansion_partners p join admin_users u on u.id = p.user_id left join empower_content_versions cv on cv.id = p.agreement_content_version_id
    left join empower_content_items ci on ci.id = cv.item_id left join partner_agreement_acceptances a on a.id = p.agreement_acceptance_id order by u.display_name limit 500`)
  return { agreements: await currentAgreements(tx), partners }
}

/** Founder issues a newer published version to an active partner, who must then accept it. Caller supplies the founder transaction. */
export async function reissueAgreement(tx: Executor, partnerId: string, versionInput: unknown) {
  const { versionId, label } = await assertIssuableAgreement(tx, versionInput)
  const [partner] = await rows(tx, sql`select p.id, p.agreement_content_version_id, p.activated_at from expansion_partners p where p.id = ${partnerId} for update`)
  if (!partner) throw new ExpansionError("Partner not found.", 404)
  if (!partner.activated_at) throw new ExpansionError("Issue the agreement with a new invitation until the partner has activated.", 409)
  if (String(partner.agreement_content_version_id) === versionId) throw new ExpansionError("This partner already holds that agreement version.", 409)
  await tx.execute(sql`update expansion_partners set agreement_content_version_id = ${versionId}, agreement_version = ${label} where id = ${partnerId}`)
  return { partnerId, versionId, label }
}
