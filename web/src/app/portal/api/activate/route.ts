import bcrypt from "bcryptjs"
import { and, eq, gt, isNull, ne } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { portalAccountTokens, portalClientAccounts } from "@/lib/schema"
import { hashPortalActivationToken, isAcceptablePortalPassword } from "@/lib/portal-activation"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const rawToken = body && typeof body.token === "string" ? body.token : ""
  const password = body && typeof body.password === "string" ? body.password : ""
  if (rawToken.length < 32 || !isAcceptablePortalPassword(password)) return NextResponse.json({ error: "This activation request is invalid." }, { status: 400 })
  const now = new Date(), tokenHash = hashPortalActivationToken(rawToken)
  try {
    const clientId = await db.transaction(async (tx) => {
      const [token] = await tx.select().from(portalAccountTokens).where(and(eq(portalAccountTokens.tokenHash, tokenHash), gt(portalAccountTokens.expiresAt, now), isNull(portalAccountTokens.usedAt), isNull(portalAccountTokens.revokedAt))).for("update").limit(1)
      if (!token) return null
      const [account] = await tx.select().from(portalClientAccounts).where(and(eq(portalClientAccounts.id, token.accountId), ne(portalClientAccounts.status, "disabled"))).for("update").limit(1)
      if (!account) return null
      const passwordHash = await bcrypt.hash(password, 12)
      await tx.update(portalClientAccounts).set({ passwordHash, active: true, status: "active", activatedAt: account.activatedAt ?? now, disabledAt: null, updatedAt: now }).where(eq(portalClientAccounts.id, account.id))
      await tx.update(portalAccountTokens).set({ usedAt: now }).where(eq(portalAccountTokens.id, token.id))
      await tx.update(portalAccountTokens).set({ revokedAt: now }).where(and(eq(portalAccountTokens.accountId, account.id), isNull(portalAccountTokens.usedAt), isNull(portalAccountTokens.revokedAt)))
      return account.clientId
    })
    if (!clientId) return NextResponse.json({ error: "This activation link is invalid, expired or revoked." }, { status: 400 })
    return NextResponse.json({ ok: true, clientId })
  } catch { return NextResponse.json({ error: "Unable to activate portal access right now." }, { status: 500 }) }
}
