import { describe, expect, it } from "vitest"
import { ANALYTICS_PROVIDER_ADAPTERS } from "./client-analytics-adapters"
import { decryptAnalyticsCredentials, encryptAnalyticsCredentials } from "./client-analytics-credentials"

describe("client analytics server helpers", () => {
  it("encrypts provider credentials without exposing plaintext", () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: "test", ANALYTICS_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") }
    const encrypted = encryptAnalyticsCredentials({ token: "secret-token", propertyId: "site-1" }, env)
    expect(encrypted).not.toContain("secret-token")
    expect(decryptAnalyticsCredentials(encrypted, env)).toEqual({ token: "secret-token", propertyId: "site-1" })
  })

  it("keeps every provider behind an adapter and forbids unknown beacon requirements", () => {
    for (const adapter of Object.values(ANALYTICS_PROVIDER_ADAPTERS)) {
      expect(adapter.unknownBeaconRequired).toBe(false)
      expect(adapter.supports.length).toBeGreaterThan(0)
      expect(typeof adapter.ingest).toBe("function")
    }
  })

  it("manual adapter imports only minimised aggregate rows", async () => {
    const rows = await ANALYTICS_PROVIDER_ADAPTERS.manual.ingest({
      clientId: 1,
      configId: 2,
      propertyId: null,
      sourceAttribution: "Manual report",
      credentials: { metrics: [{ metricDate: "2026-07-13T00:00:00.000Z", sessions: 4, rawSummary: { provider: "manual", email: "x@y.test" } }] },
      from: new Date("2026-07-12T00:00:00.000Z"),
      to: new Date("2026-07-13T00:00:00.000Z"),
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ clientId: 1, configId: 2, sessions: 4, sourceAttribution: "Manual report" })
    expect(rows[0].rawSummary).toEqual({ provider: "manual" })
  })
})
