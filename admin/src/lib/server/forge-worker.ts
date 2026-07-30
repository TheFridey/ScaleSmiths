import "server-only"
import { hostname } from "node:os"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeJobs, forgeWorkerHeartbeats } from "@/lib/schema"
import { buildForgeJobOwner, cleanupTerminalForgeJobs } from "./forge-job-queue"
import { reapExpiredForgeJobLeases, runDueForgeJobs } from "./forge-job-runner"
import { reconcileForgePreviews } from "./forge-preview"
import { cleanupExpiredRateLimitCounters } from "./rate-limit-store"
import { requestLogger } from "./request-context"
import { captureMonitoringException } from "./monitoring"

// The in-process durable worker. On every tick it recovers jobs whose worker
// died (reaper), then claims and runs due jobs under a lease. Periodically it
// reconciles abandoned previews and prunes expired rows. Multiple instances are
// safe because claiming uses FOR UPDATE SKIP LOCKED; the single-instance path is
// unchanged (one worker, one owner). Started from instrumentation.ts at boot.

const TICK_MS = readPositiveInt(process.env.FORGE_WORKER_TICK_MS, 5_000)
const BATCH = readPositiveInt(process.env.FORGE_WORKER_BATCH, 3)
const PREVIEW_RECONCILE_EVERY_TICKS = 6
const CLEANUP_EVERY_TICKS = 60

interface ForgeWorkerState {
  owner: string
  timer: ReturnType<typeof setInterval> | null
  running: boolean
  stopping: boolean
  ticks: number
  recoveredLeases: number
}

const globalForWorker = globalThis as unknown as {
  __forgeWorker?: ForgeWorkerState
  __forgeWorkerSignals?: boolean
}

export function isForgeWorkerEnabled(): boolean {
  if (process.env.FORGE_WORKER_DISABLED === "true") return false
  if (process.env.NEXT_PHASE === "phase-production-build") return false
  if (process.env.VITEST || process.env.NODE_ENV === "test") return false
  return true
}

export function getRunningForgeWorker(): ForgeWorkerState | undefined {
  return globalForWorker.__forgeWorker
}

/** Starts the worker loop once per process. Idempotent (safe under hot reload). */
export function startForgeWorker(): ForgeWorkerState | null {
  if (!isForgeWorkerEnabled()) return null
  if (globalForWorker.__forgeWorker?.timer) return globalForWorker.__forgeWorker

  const state: ForgeWorkerState = { owner: buildForgeJobOwner("worker"), timer: null, running: false, stopping: false, ticks: 0, recoveredLeases: 0 }
  globalForWorker.__forgeWorker = state
  const log = requestLogger({ component: "forge-worker" })
  log.info("Forge worker started", { owner: state.owner, tickMs: TICK_MS, batch: BATCH })

  const tick = async () => {
    if (state.running || state.stopping) return
    state.running = true
    try {
      const recovered = await reapExpiredForgeJobLeases()
      state.recoveredLeases += recovered.requeued + recovered.deadLettered
      if (state.ticks === 0 || state.ticks % PREVIEW_RECONCILE_EVERY_TICKS === 0) {
        await (await import("./forge-run-orchestrator")).recoverForgeRuns()
      }
      await runDueForgeJobs(BATCH, state.owner)
      state.ticks += 1
      await recordWorkerHeartbeat(state)
      if (state.ticks % PREVIEW_RECONCILE_EVERY_TICKS === 0) await reconcileForgePreviews()
      if (state.ticks % CLEANUP_EVERY_TICKS === 0) {
        await cleanupExpiredRateLimitCounters()
        await cleanupTerminalForgeJobs()
      }
    } catch (error) {
      captureMonitoringException(error, { component: "forge-worker", errorCategory: "worker_tick" })
    } finally {
      state.running = false
    }
  }

  state.timer = setInterval(() => void tick(), TICK_MS)
  state.timer.unref?.()
  // Recover promptly after a restart without waiting a full tick.
  setTimeout(() => void tick(), 1_000).unref?.()

  registerShutdownHandlers()
  return state
}

async function recordWorkerHeartbeat(state: ForgeWorkerState) {
  const [active] = await db.select({ count: sql<number>`count(*)::int` }).from(forgeJobs).where(eq(forgeJobs.leaseOwner, state.owner))
  await db.insert(forgeWorkerHeartbeats).values({
    workerId: state.owner,
    processId: process.pid,
    hostname: hostname(),
    lastHeartbeatAt: new Date(),
    activeJobCount: Number(active?.count ?? 0),
    metadataJson: { ticks: state.ticks, stopping: state.stopping, recoveredLeases: state.recoveredLeases },
  }).onConflictDoUpdate({
    target: forgeWorkerHeartbeats.workerId,
    set: { lastHeartbeatAt: new Date(), activeJobCount: Number(active?.count ?? 0), metadataJson: { ticks: state.ticks, stopping: state.stopping, recoveredLeases: state.recoveredLeases } },
  })
}

/**
 * Stops claiming new work. In-flight jobs are allowed to finish; if the process
 * is killed mid-job, that job's lease expires and the reaper recovers it, so no
 * work is lost or double-run.
 */
export function stopForgeWorker(): void {
  const state = globalForWorker.__forgeWorker
  if (!state) return
  state.stopping = true
  if (state.timer) clearInterval(state.timer)
  state.timer = null
  globalForWorker.__forgeWorker = undefined
  requestLogger({ component: "forge-worker" }).info("Forge worker stopped", { owner: state.owner })
}

function registerShutdownHandlers() {
  if (globalForWorker.__forgeWorkerSignals) return
  globalForWorker.__forgeWorkerSignals = true
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => stopForgeWorker())
  }
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
