import { describe, expect, it } from "vitest"
import { CLIENT_OFFBOARDING_CHECKLIST, CLIENT_OFFBOARDING_CHECKLIST_VERSION, validateOffboardingCompletion } from "./client-offboarding"

describe("client offboarding contract", () => {
  it("uses a stable, versioned checklist covering required operational boundaries", () => {
    expect(CLIENT_OFFBOARDING_CHECKLIST_VERSION).toBe(1)
    expect(CLIENT_OFFBOARDING_CHECKLIST.map((item) => item.key)).toEqual([
      "commercial_end", "outstanding_invoices", "services_retainers", "active_requests", "future_tasks", "project_closure",
      "production_handoff", "hosted_assets", "client_credentials", "forge_staging", "portal_access", "data_retention", "archive_review",
    ])
  })

  it("requires exact confirmation and an explicit leave-production-untouched decision", () => {
    const items = CLIENT_OFFBOARDING_CHECKLIST.map((item) => ({ status: "completed" as const, destructive: item.destructive }))
    expect(validateOffboardingCompletion({ caseStatus: "ready", clientName: "Acme", confirmation: "yes", productionAction: "leave_untouched", items })).toContain("OFFBOARD Acme")
    expect(validateOffboardingCompletion({ caseStatus: "ready", clientName: "Acme", confirmation: "OFFBOARD Acme", productionAction: "delete", items })).toContain("production systems")
    expect(validateOffboardingCompletion({ caseStatus: "ready", clientName: "Acme", confirmation: "OFFBOARD Acme", productionAction: "leave_untouched", items })).toBeNull()
  })

  it("does not permit destructive access checks to be bypassed as not applicable", () => {
    expect(validateOffboardingCompletion({ caseStatus: "ready", clientName: "Acme", confirmation: "OFFBOARD Acme", productionAction: "leave_untouched", items: [{ status: "not_applicable", destructive: true }] })).toContain("cannot be marked not applicable")
  })
})
