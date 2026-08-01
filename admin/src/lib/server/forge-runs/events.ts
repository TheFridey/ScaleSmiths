import "server-only"
import { db } from "@/lib/db"
import { forgeRunEvents } from "@/lib/schema"

export async function recordRunEvent(runId: number, stepId: number | null, eventType: string, actor: string, message: string, metadataJson: Record<string, unknown>) {
  await db.insert(forgeRunEvents).values({ runId, stepId, eventType, actor, message, metadataJson })
}
