import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { APPLICATION_STATUSES, APPLICATION_TRANSITIONS, canTransition, founderNextStatuses, FOUNDER_REVIEW_STATUSES } from "./partner-lifecycle"

describe("partner application lifecycle", () => {
  it("never lets a founder jump an applicant straight to onboarding or activation", () => {
    expect(canTransition("submitted", "onboarding")).toBe(false)
    expect(canTransition("under_review", "agreement_pending")).toBe(false)
    expect(canTransition("approved_in_principle", "onboarding")).toBe(false)
    expect(founderNextStatuses("onboarding")).not.toContain("activated")
    expect(FOUNDER_REVIEW_STATUSES).not.toContain("activated")
    expect(FOUNDER_REVIEW_STATUSES).not.toContain("submitted")
  })

  it("follows the approved path and treats activated and archived as terminal", () => {
    const path = ["submitted", "under_review", "information_requested", "assessment_in_progress", "approved_in_principle", "agreement_pending", "onboarding", "activated"]
    for (let i = 1; i < path.length; i++) expect(canTransition(path[i - 1], path[i])).toBe(true)
    expect(APPLICATION_TRANSITIONS.activated).toEqual([])
    expect(APPLICATION_TRANSITIONS.archived).toEqual([])
    expect(canTransition("declined", "under_review")).toBe(true)
    expect(canTransition("nonsense", "under_review")).toBe(false)
  })

  it("matches the public site's status list and the database constraint", () => {
    const web = readFileSync(path.join(__dirname, "../../../web/src/lib/partner-applications.ts"), "utf8")
    const list = web.slice(web.indexOf("PARTNER_APPLICATION_STATUSES = ["), web.indexOf("] as const"))
    expect([...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]).sort()).toEqual([...APPLICATION_STATUSES].sort())
    const sql = readFileSync(path.join(__dirname, "../../drizzle/0095_partner_agreements.sql"), "utf8")
    const check = sql.slice(sql.indexOf("ADD CONSTRAINT partner_applications_status_check"), sql.indexOf("CREATE FUNCTION partner_application_transition_allowed"))
    expect([...check.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual([...APPLICATION_STATUSES].sort())
  })

  it("matches the database transition map in migration 0095 exactly", () => {
    const sql = readFileSync(path.join(__dirname, "../../drizzle/0095_partner_agreements.sql"), "utf8")
    const fn = sql.slice(sql.indexOf("CREATE FUNCTION partner_application_transition_allowed"), sql.indexOf("CREATE FUNCTION partner_application_transition_guard"))
    const db: Record<string, string[]> = {}
    for (const m of fn.matchAll(/WHEN '([a-z_]+)' THEN ARRAY\[([^\]]*)\]/g)) db[m[1]] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort()
    for (const status of APPLICATION_STATUSES) expect(db[status] ?? [], status).toEqual([...APPLICATION_TRANSITIONS[status]].sort())
  })
})
