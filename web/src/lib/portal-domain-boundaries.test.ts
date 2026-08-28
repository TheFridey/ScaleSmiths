import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const reports = readFileSync(new URL("./portal-reports.ts", import.meta.url), "utf8")
const requests = readFileSync(new URL("./portal-client-requests.ts", import.meta.url), "utf8")
const portalPage = readFileSync(new URL("../app/portal/[clientId]/page.tsx", import.meta.url), "utf8")
const reportPage = readFileSync(new URL("../app/portal/[clientId]/reports/[reportId]/page.tsx", import.meta.url), "utf8")
const requestPage = readFileSync(new URL("../app/portal/[clientId]/requests/[requestId]/page.tsx", import.meta.url), "utf8")

describe("portal domain database boundaries", () => {
  it("keeps published-report lifecycle and client scope in the reporting API", () => {
    expect(reports.match(/eq\(monthlyReports\.clientId, portalClientId\)/g)?.length).toBe(3)
    expect(reports.match(/eq\(monthlyReports\.status, "published"\)/g)?.length).toBe(3)
    expect(reportPage).toContain("getPublishedPortalReport(session.clientId, id)")
  })

  it("scopes every request-thread relation to the authenticated client", () => {
    expect(requests.match(/eq\(clientRequests\.clientId, portalClientId\)/g)?.length).toBeGreaterThanOrEqual(4)
    expect(requests.match(/"client_visible"/g)?.length).toBeGreaterThanOrEqual(3)
    expect(requests).toContain("Promise.all")
  })

  it("keeps portal pages free of direct database table knowledge", () => {
    for (const source of [portalPage, reportPage, requestPage]) {
      expect(source).not.toMatch(/@\/lib\/(?:db|schema)/)
    }
  })
})
