import { describe, expect, it } from "vitest"
import {
  FORGE_JOB_KINDS,
  FORGE_JOB_STATUSES,
  isForgeJobInlineOnly,
  isForgeJobKind,
  isForgeJobStatus,
  isTerminalForgeJobStatus,
  resolveForgeJobMode,
  resolveForgeJobModeForKind,
  toForgeJobView,
} from "./forge-jobs"

describe("forge job primitives", () => {
  it("registers every long-running target action as a job kind", () => {
    expect(FORGE_JOB_KINDS).toEqual([
      "research",
      "sitemap",
      "copy",
      "design",
      "component_spec",
      "generate_site",
      "visual_critique",
      "qa",
      "repair",
      "preview_start",
      "proposal",
      "export",
    ])
    expect(isForgeJobKind("qa")).toBe(true)
    expect(isForgeJobKind("nope")).toBe(false)
  })

  it("allows command-routed export jobs to queue without streaming response bodies", () => {
    expect(isForgeJobInlineOnly("export")).toBe(false)
    expect(isForgeJobInlineOnly("qa")).toBe(false)
    expect(isForgeJobInlineOnly("preview_start")).toBe(false)
  })

  it("resolves execution mode from env with prod=background, dev=inline defaults", () => {
    expect(resolveForgeJobMode({ FORGE_JOBS_MODE: "inline" })).toBe("inline")
    expect(resolveForgeJobMode({ FORGE_JOBS_MODE: "background" })).toBe("background")
    expect(resolveForgeJobMode({ FORGE_JOBS_MODE: "BACKGROUND" })).toBe("background")
    expect(resolveForgeJobMode({ NODE_ENV: "production" })).toBe("background")
    expect(resolveForgeJobMode({ NODE_ENV: "development" })).toBe("inline")
    expect(resolveForgeJobMode({})).toBe("inline")
    // Garbage value falls back to the NODE_ENV default rather than throwing.
    expect(resolveForgeJobMode({ FORGE_JOBS_MODE: "weird", NODE_ENV: "production" })).toBe("background")
  })

  it("resolves per-kind mode without special-casing command-routed exports", () => {
    expect(resolveForgeJobModeForKind("export", { NODE_ENV: "production" })).toBe("background")
    expect(resolveForgeJobModeForKind("qa", { NODE_ENV: "production" })).toBe("background")
    expect(resolveForgeJobModeForKind("qa", { FORGE_JOBS_MODE: "inline" })).toBe("inline")
  })

  it("classifies statuses and terminal states", () => {
    expect(FORGE_JOB_STATUSES).toContain("queued")
    expect(isForgeJobStatus("running")).toBe(true)
    expect(isForgeJobStatus("bogus")).toBe(false)
    expect(isTerminalForgeJobStatus("completed")).toBe(true)
    expect(isTerminalForgeJobStatus("failed")).toBe(true)
    expect(isTerminalForgeJobStatus("cancelled")).toBe(true)
    expect(isTerminalForgeJobStatus("queued")).toBe(false)
    expect(isTerminalForgeJobStatus("running")).toBe(false)
  })

  it("normalises a raw job row into a client-safe view", () => {
    const view = toForgeJobView({
      id: 7,
      projectId: 42,
      kind: "qa",
      status: "completed",
      error: null,
      resultJson: { ok: true, report: { status: "passed" } },
      attempts: 1,
      createdAt: new Date("2026-06-21T10:00:00.000Z"),
      startedAt: "2026-06-21T10:00:01.000Z",
      completedAt: new Date("2026-06-21T10:00:30.000Z"),
    })

    expect(view).toMatchObject({ id: 7, projectId: 42, kind: "qa", status: "completed", attempts: 1 })
    expect(view.createdAt).toBe("2026-06-21T10:00:00.000Z")
    expect(view.startedAt).toBe("2026-06-21T10:00:01.000Z")
    expect(view.result).toEqual({ ok: true, report: { status: "passed" } })

    // Unknown status falls back to "queued"; null timestamps stay null.
    const fallback = toForgeJobView({
      id: 8, projectId: 1, kind: "research", status: "weird", error: "boom",
      resultJson: null, attempts: 0, createdAt: null, startedAt: null, completedAt: null,
    })
    expect(fallback.status).toBe("queued")
    expect(fallback.result).toBeNull()
    expect(fallback.completedAt).toBeNull()
  })
})
