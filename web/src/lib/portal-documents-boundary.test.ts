import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const service = readFileSync(new URL("./portal-documents.ts", import.meta.url), "utf8")
const route = readFileSync(new URL("../app/portal/api/documents/[documentId]/route.ts", import.meta.url), "utf8")

describe("portal document boundary", () => {
  it("binds documents through the authenticated portal client and published project", () => {
    expect(service).toContain("eq(invoicePortalClients.portalClientId, portalClientId)")
    expect(service).toContain("eq(portalDeliveryProjects.clientVisible, true)")
    expect(service).toContain('eq(portalClientDocuments.visibility, "client_visible")')
    expect(service).toContain("isNull(portalClientDocuments.archivedAt)")
  })
  it("does not accept client identity from query or route parameters", () => {
    expect(route).toContain("getClientSessionFromRequest(request)")
    expect(route).toContain("getPortalDocument(session.clientId, id)")
    expect(route).toContain('"X-Content-Type-Options": "nosniff"')
  })
})
