import "server-only"
import { connection } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "./db"
import { isValidProfileSlug, publicProfilesEnabled, toPublicProfile, type PublicPartnerProfile } from "./partner-profile-public"

/** Read at request time so a removal is visible on the very next request. Any failure hides the page (fail closed). */
export async function getPublicPartnerProfile(slug: string): Promise<PublicPartnerProfile | null> {
  await connection()
  if (!publicProfilesEnabled() || !isValidProfileSlug(slug)) return null
  try {
    const result = await db.execute(sql`select slug,display_name,biography,operating_area,enquiry_mode,achievements,referral_code,founding_recognition_date from expansion_public_partner_profiles where slug=${slug} limit 1`)
    return toPublicProfile(result.rows[0] as Record<string, unknown> | undefined)
  } catch { return null }
}
