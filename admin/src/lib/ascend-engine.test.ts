import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  ACTION_REGISTRY, AscendFailure, EXECUTION_STATES, PROHIBITED_ACTION_PATTERN, RETRYABLE, STATE_LABEL, TRANSITIONS, approvalBinding, canTransition, canonicalJson,
  classifyFailure, retryDelaySeconds, sanitiseError, validatePayload, validateScope,
} from "./ascend-engine"

describe("ASCEND B2.8 engine rules", () => {
  it("matches the database trigger's transition table exactly", () => {
    const migration = readFileSync(new URL("../../drizzle/0104_ascend_execution_engine.sql", import.meta.url), "utf8")
    for (const state of EXECUTION_STATES) {
      const match = new RegExp(`WHEN '${state}' THEN ARRAY\\[([^\\]]*)\\]`).exec(migration)
      const dbTargets = match ? [...match[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort() : []
      expect(dbTargets, state).toEqual([...TRANSITIONS[state]].sort())
    }
  })

  it("keeps terminal states terminal and every state labelled", () => {
    for (const s of ["completed", "cancelled", "expired", "superseded"] as const) expect(TRANSITIONS[s]).toEqual([])
    expect(canTransition("queued", "completed")).toBe(false)
    expect(canTransition("pending_approval", "queued")).toBe(false)
    expect(canTransition("running", "ambiguous")).toBe(true)
    for (const s of EXECUTION_STATES) expect(STATE_LABEL[s]).toMatch(/^[A-Z]/)
  })

  it("registers only read-only or internal actions, none in a prohibited family", () => {
    for (const spec of Object.values(ACTION_REGISTRY)) {
      expect(PROHIBITED_ACTION_PATTERN.test(spec.type), spec.type).toBe(false)
      expect(spec.idempotent, spec.type).toBe(true)
      expect(["analysis", "review_preparation"]).toContain(spec.category)
    }
    const migration = readFileSync(new URL("../../drizzle/0104_ascend_execution_engine.sql", import.meta.url), "utf8")
    const dbPattern = /action_type !~ '([^']+)'/.exec(migration)![1]
    expect(dbPattern).toBe(PROHIBITED_ACTION_PATTERN.source)
  })

  it("refuses prohibited, unknown and malformed requests with explicit classes", () => {
    for (const t of ["finance.payout_run", "partner.commission_rate_update", "agreement.publish", "partner.activate", "applicant.retention_purge", "prospect.email_send", "founder.permission_grant"])
      expect(() => validatePayload(t, {})).toThrow(expect.objectContaining({ failureClass: "policy_rejection" }))
    expect(() => validatePayload("ops.unknown_thing", {})).toThrow(expect.objectContaining({ failureClass: "invalid_payload" }))
    expect(() => validatePayload("DROP TABLE x", {})).toThrow(AscendFailure)
    expect(() => validatePayload("pipeline.inactivity_scan", { inactiveDays: 2 })).toThrow(/3 to 180/)
    expect(() => validatePayload("pipeline.inactivity_scan", { inactiveDays: "14" })).toThrow(/whole number/)
    expect(() => validatePayload("pipeline.inactivity_scan", { inactiveDays: 14, url: "https://evil.example" })).toThrow(/Unsupported payload field/)
    expect(() => validatePayload("pipeline.inactivity_scan", [])).toThrow(/object/)
    expect(validatePayload("pipeline.inactivity_scan", undefined).payload).toEqual({ inactiveDays: 14 })
  })

  it("restricts market scope to the definition's approved markets", () => {
    expect(validateScope(undefined, ["GB"])).toEqual({ markets: ["GB"] })
    expect(validateScope({ markets: ["GB", "GB"] }, ["GB", "IE"])).toEqual({ markets: ["GB"] })
    expect(() => validateScope({ markets: ["US"] }, ["GB"])).toThrow(expect.objectContaining({ failureClass: "policy_rejection" }))
    expect(() => validateScope({ markets: ["gb"] }, ["GB"])).toThrow(/two-letter/)
    expect(() => validateScope({ partnerId: "x" }, ["GB"])).toThrow(/Only a market scope/)
  })

  it("classifies failures and only retries the retryable ones", () => {
    expect(classifyFailure(Object.assign(new Error("x"), { code: "57P01" })).failureClass).toBe("database_unavailable")
    expect(classifyFailure(Object.assign(new Error("x"), { code: "ECONNREFUSED" })).failureClass).toBe("database_unavailable")
    expect(classifyFailure(Object.assign(new Error("x"), { code: "40001" })).failureClass).toBe("transient")
    expect(classifyFailure(Object.assign(new Error("x"), { code: "23505" })).failureClass).toBe("duplicate")
    expect(classifyFailure(Object.assign(new Error("x"), { code: "23514" })).failureClass).toBe("business_rule")
    expect(classifyFailure(Object.assign(new Error("x"), { name: "AbortError" })).failureClass).toBe("deadline_exceeded")
    expect(classifyFailure(new AscendFailure("permission", "No")).failureClass).toBe("permission")
    for (const c of ["invalid_payload", "permission", "approval_expired", "policy_rejection", "business_rule", "ambiguous", "duplicate"] as const) expect(RETRYABLE.has(c)).toBe(false)
    // Driver messages never leak through classification.
    expect(classifyFailure(Object.assign(new Error("password authentication failed for user admin"), { code: "28P01" })).message).not.toMatch(/password|admin/)
  })

  it("redacts secrets, tokens, connection strings and email addresses from diagnostics", () => {
    const out = sanitiseError("token Bearer abc.def-123 for postgresql://u:p@h/db sent to someone@example.com with asc_" + "A".repeat(43) + "\nnext")
    expect(out).not.toMatch(/abc\.def|u:p@|someone@|AAAA/)
    expect(out).not.toContain("\n")
    expect(sanitiseError("x".repeat(2000)).length).toBeLessThanOrEqual(480)
  })

  it("uses bounded exponential backoff with jitter", () => {
    expect(retryDelaySeconds(1, () => 0)).toBe(15)
    expect(retryDelaySeconds(1, () => 1)).toBe(30)
    expect(retryDelaySeconds(4, () => 0)).toBe(120)
    expect(retryDelaySeconds(4, () => 1)).toBe(240)
    expect(retryDelaySeconds(40, () => 1)).toBe(3600)
    const spread = new Set(Array.from({ length: 50 }, (_, i) => retryDelaySeconds(3, () => i / 50)))
    expect(spread.size).toBeGreaterThan(10)
  })

  it("binds an approval to action, payload, scope and policy version independent of key order", () => {
    const base = { executionId: "e", actionType: "ops.queue_health", payloadSha256: "a".repeat(64), scope: { markets: ["GB"] }, policyVersion: 1 }
    expect(canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}')
    const reference = approvalBinding(base)
    for (const change of [{ policyVersion: 2 }, { payloadSha256: "b".repeat(64) }, { scope: { markets: ["IE"] } }, { actionType: "pipeline.inactivity_scan" }, { executionId: "f" }])
      expect(approvalBinding({ ...base, ...change })).not.toBe(reference)
  })
})
