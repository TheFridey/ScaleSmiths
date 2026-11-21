import "server-only"
import { sql, type SQL } from "drizzle-orm"
import type { AdminDatabaseTransaction } from "@/lib/db"
import { ContentError } from "@/lib/empower-content"
import type { requireCapability } from "./rbac"

/** Operation Empower partner surfaces: their switches and the shared partner guard. Each switch defaults off and is independent. */
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Actor = Awaited<ReturnType<typeof requireCapability>>
export const partnerAcademyEnabled = () => process.env.PARTNER_ACADEMY_ENABLED === "true"
export const partnerResourcesEnabled = () => process.env.PARTNER_RESOURCE_CENTRE_ENABLED === "true"
export const partnerKnowledgeEnabled = () => process.env.PARTNER_KNOWLEDGE_BASE_ENABLED === "true"
const rows = async (tx: Executor, query: SQL) => (await tx.execute(query)).rows as Record<string, unknown>[]
/** Same rule as the rest of the Partner Portal: an activated partner profile, an active user, the partner role and the current session. */
export async function partnerGuard(tx: Executor, actor: Actor) {
  await tx.execute(sql`select id from admin_users where id=${actor.id} for share`)
  const [row] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null
    and u.active=true and u.session_version=${actor.sessionVersion} and u.role::text='independent_partner'`)
  if (!row) throw new ContentError("Active partner profile required.", 403)
  return String(row.id)
}
