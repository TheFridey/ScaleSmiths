import "server-only"

import { db } from "./db"
import { publicVerifiedClaims } from "./schema"
import { selectVerifiedPublicClaims, type PublicClaim } from "./public-claims"

export async function getVerifiedPublicClaims(placement: { route: string; component?: string }): Promise<PublicClaim[]> {
  try {
    const rows = await db.select().from(publicVerifiedClaims)
    return selectVerifiedPublicClaims(rows, placement)
  } catch {
    // Claims fail closed when the database or restricted public view is unavailable.
    return []
  }
}
