import "server-only"

import { connection } from "next/server"
import { db } from "./db"
import { publicVerifiedClaims } from "./schema"
import { selectVerifiedPublicClaims, type PublicClaim } from "./public-claims"

export async function getVerifiedPublicClaims(placement: { route: string; component?: string }): Promise<PublicClaim[]> {
  // Claims must be read at request time so demoting/revoking verified wording
  // fails closed immediately — never bake them into a static production shell.
  await connection()
  try {
    const rows = await db.select().from(publicVerifiedClaims)
    return selectVerifiedPublicClaims(rows, placement)
  } catch {
    // Claims fail closed when the database or restricted public view is unavailable.
    return []
  }
}
