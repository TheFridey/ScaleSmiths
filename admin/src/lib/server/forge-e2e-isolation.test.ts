import { describe, expect, it } from "vitest"
import { isForgeE2EManualWorkerRequest } from "./forge-e2e-isolation"

describe("Forge E2E worker isolation", () => {
  it("requires the explicit mode, Forge E2E environment, and isolated database", () => {
    expect(isForgeE2EManualWorkerRequest({
      FORGE_E2E_MANUAL_WORKER: "enabled",
      SCALESMITHS_TEST_ENVIRONMENT: "forge-v2-e2e",
      ADMIN_DATABASE_URL: "postgresql://test:test@127.0.0.1/scalesmiths_admin_e2e",
    })).toBe(true)
  })

  it.each([
    [{ SCALESMITHS_TEST_ENVIRONMENT: "forge-v2-e2e", ADMIN_DATABASE_URL: "postgresql://test:test@127.0.0.1/scalesmiths_admin_e2e" }],
    [{ FORGE_E2E_MANUAL_WORKER: "enabled", SCALESMITHS_TEST_ENVIRONMENT: "production", ADMIN_DATABASE_URL: "postgresql://app:secret@db/scalesmiths_admin_e2e" }],
    [{ FORGE_E2E_MANUAL_WORKER: "enabled", SCALESMITHS_TEST_ENVIRONMENT: "forge-v2-e2e", ADMIN_DATABASE_URL: "postgresql://app:secret@db/scalesmiths_admin_prod" }],
  ])("refuses incomplete or production-like configuration", (environment) => {
    expect(isForgeE2EManualWorkerRequest(environment)).toBe(false)
  })
})
