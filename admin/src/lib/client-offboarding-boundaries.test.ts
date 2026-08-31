import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("offboarding destructive boundaries", () => {
  const service = readFileSync(new URL("./server/client-offboarding.ts", import.meta.url), "utf8")
  const genericClientRoute = readFileSync(new URL("../app/api/clients/[id]/route.ts", import.meta.url), "utf8")
  it("archives operations without deleting financial, production or historical records", () => {
    expect(service).not.toMatch(/delete\(invoices\)|DELETE FROM invoices/i)
    expect(service).not.toMatch(/delete\(clientOffboarding|delete\(clientDocuments/i)
    expect(service).not.toMatch(/deleteForgeWorkspace|DELETE FROM forge|DELETE FROM delivery/i)
    expect(service).toContain('productionAction: "left_untouched"')
    expect(service).toContain("financialRecordsDeleted: false")
  })
  it("reactivation does not silently restore access or recurring work", () => {
    expect(service).toContain("portalRemainsDisabled: true")
    expect(service).toContain("servicesRemainInactive: true")
    expect(service).toContain("projectsRemainClosed: true")
  })
  it("prevents generic client edits from bypassing archive lifecycle audit", () => {
    expect(genericClientRoute).toContain("Use the controlled offboarding workflow to archive or reactivate a client.")
  })
})
