import "server-only"

import { asc, desc, eq } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { publicClaimAuditLogs, publicClaimEvidence, publicClaims } from "@/lib/schema"
import type { PublicClaimReviewInput } from "@/lib/public-claims"

export class PublicClaimError extends Error {
  constructor(message: string, readonly status = 400, readonly code = "claim_error") {
    super(message)
  }
}

export async function listPublicClaims() {
  return db
    .select({
      id: publicClaims.id,
      approvedWording: publicClaims.approvedWording,
      claimType: publicClaims.claimType,
      sourceName: publicClaims.sourceName,
      attributionName: publicClaims.attributionName,
      attributionBusiness: publicClaims.attributionBusiness,
      clientApprovalStatus: publicClaims.clientApprovalStatus,
      status: publicClaims.status,
      verifiedBy: publicClaims.verifiedBy,
      verifiedAt: publicClaims.verifiedAt,
      reviewExpiresAt: publicClaims.reviewExpiresAt,
      permittedRoutes: publicClaims.permittedRoutes,
      permittedComponents: publicClaims.permittedComponents,
      evidenceDescription: publicClaimEvidence.evidenceDescription,
      evidenceReference: publicClaimEvidence.evidenceReference,
      updatedAt: publicClaims.updatedAt,
    })
    .from(publicClaims)
    .leftJoin(publicClaimEvidence, eq(publicClaimEvidence.claimId, publicClaims.id))
    .orderBy(asc(publicClaims.status), asc(publicClaims.claimType), asc(publicClaims.id))
}

export async function listPublicClaimAudit(claimId?: string) {
  if (claimId) {
    return db.select().from(publicClaimAuditLogs)
      .where(eq(publicClaimAuditLogs.claimId, claimId))
      .orderBy(desc(publicClaimAuditLogs.createdAt))
      .limit(100)
  }
  return db.select().from(publicClaimAuditLogs).orderBy(desc(publicClaimAuditLogs.createdAt)).limit(100)
}

export async function createPublicClaim(input: PublicClaimReviewInput & { id: string }, actorUserId: string) {
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: publicClaims.id }).from(publicClaims).where(eq(publicClaims.id, input.id)).limit(1)
    if (existing.length) throw new PublicClaimError("A claim with this stable ID already exists.", 409, "duplicate_claim")
    const verification = verificationFields(input, actorUserId)
    const [created] = await tx.insert(publicClaims).values({
      id: input.id,
      approvedWording: input.approvedWording,
      claimType: input.claimType,
      sourceName: input.sourceName,
      attributionName: input.attributionName,
      attributionBusiness: input.attributionBusiness,
      clientApprovalStatus: input.clientApprovalStatus,
      status: input.status,
      reviewExpiresAt: input.reviewExpiresAt,
      permittedRoutes: input.permittedRoutes,
      permittedComponents: input.permittedComponents,
      ...verification,
    }).returning()
    await upsertEvidence(tx, input.id, input)
    await tx.insert(publicClaimAuditLogs).values({
      claimId: input.id,
      actorUserId,
      action: "claim_created",
      previousStatus: null,
      newStatus: input.status,
      metadataJson: { reason: input.reason, claimType: input.claimType },
    })
    return created
  })
}

export async function updatePublicClaim(id: string, input: PublicClaimReviewInput, actorUserId: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(publicClaims).where(eq(publicClaims.id, id)).limit(1)
    if (!existing) throw new PublicClaimError("Claim not found.", 404, "claim_not_found")
    const verification = verificationFields(input, actorUserId)
    const [updated] = await tx.update(publicClaims).set({
      approvedWording: input.approvedWording,
      claimType: input.claimType,
      sourceName: input.sourceName,
      attributionName: input.attributionName,
      attributionBusiness: input.attributionBusiness,
      clientApprovalStatus: input.clientApprovalStatus,
      status: input.status,
      reviewExpiresAt: input.reviewExpiresAt,
      permittedRoutes: input.permittedRoutes,
      permittedComponents: input.permittedComponents,
      updatedAt: new Date(),
      ...verification,
    }).where(eq(publicClaims.id, id)).returning()
    await upsertEvidence(tx, id, input)
    await tx.insert(publicClaimAuditLogs).values({
      claimId: id,
      actorUserId,
      action: existing.status === input.status ? "claim_review_updated" : "claim_status_changed",
      previousStatus: existing.status,
      newStatus: input.status,
      metadataJson: { reason: input.reason, clientApprovalStatus: input.clientApprovalStatus },
    })
    return updated
  })
}

function verificationFields(input: PublicClaimReviewInput, actorUserId: string) {
  if (input.status !== "verified") return { verifiedBy: null, verifiedAt: null }
  return { verifiedBy: actorUserId, verifiedAt: new Date() }
}

async function upsertEvidence(tx: AdminDatabaseTransaction, claimId: string, input: PublicClaimReviewInput) {
  if (!input.evidenceDescription || !input.evidenceReference) {
    await tx.delete(publicClaimEvidence).where(eq(publicClaimEvidence.claimId, claimId))
    return
  }
  await tx.insert(publicClaimEvidence).values({
    claimId,
    evidenceDescription: input.evidenceDescription,
    evidenceReference: input.evidenceReference,
  }).onConflictDoUpdate({
    target: publicClaimEvidence.claimId,
    set: {
      evidenceDescription: input.evidenceDescription,
      evidenceReference: input.evidenceReference,
      updatedAt: new Date(),
    },
  })
}
