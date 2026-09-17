import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

describe("portal tenant RLS wiring", () => {
  it("requires withPortalTenant before request, report and timeline queries", () => {
    const requests = readFileSync(new URL("./portal-client-requests.ts", import.meta.url), "utf8")
    const reports = readFileSync(new URL("./portal-reports.ts", import.meta.url), "utf8")
    const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8")
    const requestRoute = readFileSync(new URL("../app/portal/api/requests/route.ts", import.meta.url), "utf8")
    const timelineRoute = readFileSync(new URL("../app/portal/api/timeline/route.ts", import.meta.url), "utf8")
    expect(db).toContain("set_config('app.access_mode', 'tenant', true)")
    expect(db).toContain("Portal tenant mapping is missing.")
    for (const source of [requests, reports, requestRoute, timelineRoute]) {
      expect(source).toContain("withPortalTenant")
    }
  })
})
