import "server-only"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeRunSteps } from "@/lib/schema"

/**
 * Resolves the run and step a job belongs to from the database, not from the job payload.
 * `forge_run_steps.job_id` is unique and is written only by the run orchestrator, so it is
 * the authoritative server-side linkage.
 *
 * The orchestrator inserts the job and then sets `forge_run_steps.job_id` in a following
 * transaction, so a worker that claims the job in between sees no linkage yet. In that
 * window only, the orchestrator-written payload hint is used to locate the step — and the
 * step is still re-read from the database and checked to belong to the claimed job's
 * project, so a stale or malformed payload can never attribute spend to another project's
 * run. Client input never reaches this path.
 */
export async function resolveForgeJobAttribution(
  jobId: number,
  projectId: number,
  payload: Record<string, unknown>,
): Promise<{ runId: number | null; runStepId: number | null }> {
  const [linked] = await db
    .select({ id: forgeRunSteps.id, runId: forgeRunSteps.runId })
    .from(forgeRunSteps)
    .where(eq(forgeRunSteps.jobId, jobId))
    .limit(1)
  if (linked) return { runId: linked.runId, runStepId: linked.id }

  const hintedStepId = typeof payload.forgeRunStepId === "number" && Number.isInteger(payload.forgeRunStepId) && payload.forgeRunStepId > 0
    ? payload.forgeRunStepId
    : null
  if (!hintedStepId) return { runId: null, runStepId: null }

  const [hinted] = await db
    .select({ id: forgeRunSteps.id, runId: forgeRunSteps.runId })
    .from(forgeRunSteps)
    .where(and(eq(forgeRunSteps.id, hintedStepId), eq(forgeRunSteps.projectId, projectId)))
    .limit(1)
  return { runId: hinted?.runId ?? null, runStepId: hinted?.id ?? null }
}
