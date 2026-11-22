import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { ExpansionError } from "@/lib/expansion"
import { hasCapability } from "@/lib/rbac"
import type { AdminRole } from "@/lib/admin-users"
import { explain, OPPORTUNITY_STATUS } from "@/lib/partner-guidance"
import { qualificationFor } from "@/lib/partner-qualification"
import { requireCapability } from "./rbac"

/*
 * Operation Ascend B2.2: qualification readiness. Display only: nothing here writes, and no rule elsewhere reads it, so it can
 * never override ownership, scope review or commission. OFF unless PARTNER_QUALIFICATION_ENABLED=true.
 * Partners see it for their own opportunities inside the pipeline (partner-pipeline.ts); founders inspect the same factors here.
 */
export const partnerQualificationEnabled = () => process.env.PARTNER_QUALIFICATION_ENABLED === "true"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function founderQualification(id: unknown) {
  if (!partnerQualificationEnabled()) throw new ExpansionError("Qualification is not available yet.", 404)
  const actor = await requireCapability("expansion.manage")
  if (typeof id !== "string" || !UUID.test(id)) throw new ExpansionError("Opportunity not found.", 404)
  return db.transaction(async (tx) => {
    const [user] = (await tx.execute(sql`select role,active,session_version from admin_users where id=${actor.id} for share`)).rows as Record<string, unknown>[]
    if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new ExpansionError("Workspace authority was revoked.", 403)
    const [o] = (await tx.execute(sql`select o.id,o.status,o.discovery,o.scope_version,p.business_name,p.website_url,u.display_name partner_name
      from expansion_opportunities o join prospects p on p.id=o.prospect_id join expansion_partners ep on ep.id=o.partner_id join admin_users u on u.id=ep.user_id where o.id=${id}`)).rows as Record<string, unknown>[]
    if (!o) throw new ExpansionError("Opportunity not found.", 404)
    return {
      opportunity: { id: String(o.id), businessName: String(o.business_name), partnerName: String(o.partner_name), status: String(o.status), statusLabel: explain(OPPORTUNITY_STATUS, o.status).label, scopeVersion: Number(o.scope_version) },
      qualification: qualificationFor(o.discovery, { website: o.website_url }),
    }
  })
}
