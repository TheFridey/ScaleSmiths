import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("portal delivery boundary", () => {
  const source = readFileSync(new URL("./portal-projects.ts", import.meta.url), "utf8")
  const page = readFileSync(new URL("../app/portal/[clientId]/page.tsx", import.meta.url), "utf8")

  it("scopes projects through the explicit portal client association", () => {
    expect(source).toContain("invoicePortalClients.portalClientId")
    expect(source).toContain("portalDeliveryProjects.clientId")
    expect(source).toContain("portalDeliveryProjects.clientVisible")
  })

  it("scopes every child record to the client-visible projection", () => {
    expect(source.match(/portalDeliveryMilestones\.clientVisible/g)?.length).toBeGreaterThanOrEqual(1)
    expect(source.match(/portalDeliveryDeliverables\.clientVisible/g)?.length).toBeGreaterThanOrEqual(1)
    expect(source.match(/portalDeliveryDecisions\.clientVisible/g)?.length).toBeGreaterThanOrEqual(1)
    expect(source).toContain('portalClientDocuments.visibility, "client_visible"')
  })

  it("never selects internal-only or audit fields into the portal projection", () => {
    for (const forbidden of [
      "internalNotes",
      "ownerUserId",
      "assigneeUserId",
      "resolvedBy",
      "forgeProjectId",
      "deploymentCandidateId",
      "deliveryForgeIntegrations",
      "forgeRuns",
      "forgeArtifacts",
      "forgeAiUsage",
      "AuditLog",
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })

  it("resolves the project set from the authenticated session, not the URL client id", () => {
    expect(page).toContain("const session = await requireClientPortalAccess(clientId)")
    expect(page).toContain("const portalClientId = session.clientId")
    expect(page).toContain("<ProgressTab clientId={portalClientId}")
    expect(page).toContain("<DocumentsTab clientId={portalClientId}")
    expect(page).toContain("listPortalProjectProgress(clientId)")
  })
})
