import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("monthly report lifecycle boundaries", () => {
  const route = readFileSync(new URL("../app/api/monthly-reports/[id]/route.ts", import.meta.url), "utf8")
  const migration = readFileSync(new URL("../../../web/drizzle/0020_monthly_report_evidence.sql", import.meta.url), "utf8")

  it("requires review before the deliberate publish action", () => {
    expect(route).toContain('action === "review"')
    expect(route).toContain("Review and approve the draft before publication")
    expect(route).toContain('action === "publish"')
  })

  it("clears review when a draft changes and records publication audit", () => {
    expect(route).toContain("reviewedAt: null")
    expect(route).toContain('action: "published"')
    expect(route).toContain("monthlyReportAuditLogs")
  })

  it("enforces published immutability in PostgreSQL", () => {
    expect(migration).toContain("IF OLD.status = 'published'")
    expect(migration).toContain("monthly_reports_published_immutable_update")
    expect(migration).toContain("monthly_reports_published_immutable_delete")
  })
})
