import "server-only"

import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { ExpansionError } from "@/lib/expansion"
import { agreementState, parseAcceptance, type AgreementState } from "@/lib/partner-agreements"
import { partnerGuard } from "./empower-partner"
import { agreementColumns, recordAcceptance, rows, shape, type IssuedAgreement } from "./partner-agreements-core"
import { requireCapability } from "./rbac"

/* Operation Launch Ready: the session-bound partner and founder entry points over ./partner-agreements-core. */

export type PartnerAgreementOverview = {
  state: AgreementState
  issued: IssuedAgreement | null
  issuedCurrent: boolean
  accepted: { acceptanceId: string; versionId: string; version: number; title: string; sha256: string; acceptedAt: string; signatoryName: string } | null
  pending: boolean
  history: { acceptanceId: string; version: number; title: string; acceptedAt: string; method: string }[]
}

const partnerActor = () => requireCapability("expansion.partner")

export async function partnerAgreementOverview(): Promise<PartnerAgreementOverview> {
  const actor = await partnerActor()
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const [issuedRow] = await rows(tx, sql`select ${agreementColumns}, partner_agreement_current(cv.id) current from expansion_partners p
      join empower_content_versions cv on cv.id = p.agreement_content_version_id join empower_content_items ci on ci.id = cv.item_id where p.id = ${partnerId}`)
    const history = await rows(tx, sql`select a.id, a.content_version_id, a.agreement_version, a.agreement_title, a.content_sha256, a.accepted_at, a.signatory_name, a.method,
      a.id = p.agreement_acceptance_id latest from partner_agreement_acceptances a join expansion_partners p on p.id = a.partner_id where a.partner_id = ${partnerId} order by a.accepted_at desc`)
    const latest = history.find((h) => h.latest === true)
    const issued = issuedRow ? shape(issuedRow) : null
    return {
      state: agreementState({ issuedVersionId: issued?.versionId ?? null, issuedCurrent: issuedRow?.current === true, acceptedVersionId: latest ? String(latest.content_version_id) : null }),
      issued,
      issuedCurrent: issuedRow?.current === true,
      accepted: latest ? { acceptanceId: String(latest.id), versionId: String(latest.content_version_id), version: Number(latest.agreement_version), title: String(latest.agreement_title),
        sha256: String(latest.content_sha256), acceptedAt: new Date(String(latest.accepted_at)).toISOString(), signatoryName: String(latest.signatory_name) } : null,
      pending: Boolean(issued && issuedRow?.current === true && (!latest || String(latest.content_version_id) !== issued.versionId)),
      history: history.map((h) => ({ acceptanceId: String(h.id), version: Number(h.agreement_version), title: String(h.agreement_title), acceptedAt: new Date(String(h.accepted_at)).toISOString(), method: String(h.method) })),
    }
  })
}

/** An active partner accepts a version a founder reissued to them. */
export async function acceptReissuedAgreement(input: unknown) {
  const actor = await partnerActor()
  const acceptance = parseAcceptance(input)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const result = await recordAcceptance(tx, { partnerId, userId: actor.id, method: "reissue", acceptance })
    await tx.execute(sql`insert into admin_security_audit (actor_user_id, target_user_id, action, success, metadata_json)
      values (${actor.id}, ${actor.id}, 'partner_agreement_accepted', true, ${JSON.stringify({ partnerId, acceptanceId: result.acceptanceId, versionId: result.agreement.versionId, version: result.agreement.version, sha256: result.agreement.sha256, method: "reissue" })}::jsonb)`)
    return { acceptanceId: result.acceptanceId }
  })
}

/** Plain-text copy of an accepted agreement, for the partner who accepted it or a founder. The digest is recomputed and must match. */
export async function acceptedAgreementDocument(acceptanceId: unknown, viewer: "partner" | "founder"): Promise<{ filename: string; text: string }> {
  if (typeof acceptanceId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(acceptanceId)) throw new ExpansionError("Agreement not found.", 404)
  const actor = await requireCapability(viewer === "partner" ? "expansion.partner" : "expansion.manage")
  return db.transaction(async (tx) => {
    // A partner only ever reaches their own acceptance; a founder may read any.
    const partnerId = viewer === "partner" ? await partnerGuard(tx, actor) : null
    const [row] = await rows(tx, sql`select a.*, cv.title, cv.body, partner_agreement_digest(cv.title, cv.body) digest
      from partner_agreement_acceptances a join empower_content_versions cv on cv.id = a.content_version_id
      where a.id = ${acceptanceId} ${partnerId ? sql`and a.partner_id = ${partnerId}` : sql``}`)
    if (!row) throw new ExpansionError("Agreement not found.", 404)
    if (row.digest !== row.content_sha256) throw new ExpansionError("This agreement record failed its integrity check. Contact ScaleSmiths.", 409)
    const acceptedAt = new Date(String(row.accepted_at)).toISOString()
    const text = [
      String(row.title),
      "",
      `Agreement: ${String(row.agreement_slug)}, version ${Number(row.agreement_version)}`,
      `SHA-256 of the agreement text: ${String(row.content_sha256)}`,
      `Accepted by: ${String(row.signatory_name)} (ScaleSmiths partner account ${String(row.user_id)})`,
      `Accepted at: ${acceptedAt} (recorded by the ScaleSmiths database clock)`,
      `Acceptance statement: ${String(row.statement)}`,
      "",
      "This is a record of acceptance made in the ScaleSmiths partner portal. It is not a qualified electronic signature.",
      "",
      "--------------------------------------------------------------------------------",
      "",
      String(row.body),
      "",
    ].join("\n")
    return { filename: `scalesmiths-${String(row.agreement_slug)}-v${Number(row.agreement_version)}.txt`, text }
  })
}
