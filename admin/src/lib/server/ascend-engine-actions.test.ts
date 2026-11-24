import type { SQL } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

/*
 * Operation ASCEND B2.9: action handlers run read-only analysis inside a READ ONLY transaction with an enforceable
 * statement_timeout, and partner-programme aggregates are restricted to the execution's market scope.
 */
const state = vi.hoisted(() => ({ log: [] as { tx: boolean; text: string; params: unknown[] }[], prepare: null as unknown as (...a: unknown[]) => Promise<{ prepared: number; rejected: number }>, fail: null as null | { code: string } }))
vi.mock("@/lib/db", async () => {
  const { PgDialect } = await import("drizzle-orm/pg-core")
  const dialect = new PgDialect()
  const record = (tx: boolean) => async (q: SQL) => {
    const { sql: text, params } = dialect.sqlToQuery(q)
    state.log.push({ tx, text, params })
    if (state.fail && /from /.test(text)) throw state.fail
    return { rows: [] }
  }
  return { db: { execute: record(false), transaction: async (op: (tx: unknown) => unknown) => op({ execute: record(true) }) } }
})
vi.mock("./ascend-review-queue", () => ({ prepareDueReviewJobs: (...a: unknown[]) => state.prepare(...a) }))

import { handlerMode, registeredHandlerTypes, runAscendAction } from "./ascend-engine-actions"
import { ACTION_REGISTRY, AscendFailure } from "@/lib/ascend-engine"

const live = () => new AbortController().signal
beforeEach(() => { state.log = []; state.fail = null; state.prepare = vi.fn().mockResolvedValue({ prepared: 0, rejected: 0 }) })

describe("ASCEND B2.9 action handlers", () => {
  it("registers exactly the registry's actions, and the registry's write classification matches each handler", () => {
    expect(registeredHandlerTypes().sort()).toEqual(Object.keys(ACTION_REGISTRY).sort())
    for (const spec of Object.values(ACTION_REGISTRY)) expect(handlerMode(spec.type)).toBe(spec.writes === "none" ? "read_only" : "internal_write")
    expect(ACTION_REGISTRY["review.queue_preparation"].writes).toBe("internal_review_state")
    expect(ACTION_REGISTRY["review.queue_preparation"].effects).toMatch(/Not read-only/)
    expect(ACTION_REGISTRY["ops.queue_health"].writes).toBe("none")
  })

  it.each(Object.values(ACTION_REGISTRY).filter((s) => s.writes === "none").map((s) => s.type))("%s runs only inside a READ ONLY transaction with a statement timeout", async (type) => {
    await runAscendAction(type, {}, { markets: ["GB"] }, live(), new Date(), { timeoutMs: 20_000 })
    expect(state.log.length).toBeGreaterThanOrEqual(3)
    expect(state.log.every((e) => e.tx)).toBe(true)
    expect(state.log[0].text).toBe("set transaction read only")
    expect(state.log[1]).toMatchObject({ text: expect.stringContaining("set_config('statement_timeout'"), params: ["20000"] })
    expect(state.log.slice(2).every((e) => /^\s*select /i.test(e.text))).toBe(true)
  })

  it.each(["pipeline.inactivity_scan", "onboarding.progress_check", "delivery.handoff_readiness"])("%s aggregates only partners operating in the execution's markets", async (type) => {
    await runAscendAction(type, {}, { markets: ["GB", "IE"] }, live())
    const data = state.log.slice(2)
    expect(data.length).toBe(1)
    expect(data[0].text).toMatch(/operating_country in \(\$\d+, \$\d+\)/)
    expect(data[0].params).toEqual(expect.arrayContaining(["GB", "IE"]))
  })

  it("refuses an empty or malformed market scope rather than aggregating everything", async () => {
    await expect(runAscendAction("pipeline.inactivity_scan", {}, { markets: [] }, live())).rejects.toMatchObject({ failureClass: "policy_rejection" })
    await expect(runAscendAction("onboarding.progress_check", {}, { markets: ["gb'; --"] }, live())).rejects.toMatchObject({ failureClass: "policy_rejection" })
  })

  it("maps a database statement timeout to a retryable deadline failure", async () => {
    state.fail = { code: "57014" }
    const error = await runAscendAction("ops.queue_health", {}, { markets: ["GB"] }, live()).catch((e) => e)
    expect(error).toBeInstanceOf(AscendFailure)
    expect(error).toMatchObject({ failureClass: "deadline_exceeded" })
  })

  it("clamps the database timeout to the action limits", async () => {
    await runAscendAction("ops.queue_health", {}, { markets: ["GB"] }, live(), new Date(), { timeoutMs: 10 * 60_000 })
    expect(state.log[1].params).toEqual(["50000"])
  })

  it("review preparation is the only internal-write handler and never touches the read-only path", async () => {
    await runAscendAction("review.queue_preparation", { batch: 3 }, { markets: ["GB"] }, live())
    expect(state.prepare).toHaveBeenCalledWith(3, expect.any(Date))
    expect(state.log).toEqual([])
  })
})
