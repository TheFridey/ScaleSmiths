import { describe, expect, it } from "vitest"
import { assertIsolatedAdminTestDatabase } from "./test-database-guard.mjs"

describe("isolated admin test database guard", () => {
  it("accepts the named local Forge V2 admin fixture", () => {
    expect(assertIsolatedAdminTestDatabase(
      "postgresql://tester:secret@127.0.0.1:5432/scalesmiths_admin_e2e",
      "forge-v2-e2e",
    )).toMatchObject({ host: "127.0.0.1", databaseName: "scalesmiths_admin_e2e" })
  })

  it("rejects production-like names before connecting", () => {
    expect(() => assertIsolatedAdminTestDatabase(
      "postgresql://tester:secret@127.0.0.1:5432/scalesmiths",
      "forge-v2-e2e",
    )).toThrow(/without an isolated test name/)
  })

  it("rejects remote hosts and missing environment confirmation", () => {
    expect(() => assertIsolatedAdminTestDatabase(
      "postgresql://tester:secret@db.example.test:5432/scalesmiths_admin_e2e",
      "forge-v2-e2e",
    )).toThrow(/non-local test database host/)
    expect(() => assertIsolatedAdminTestDatabase(
      "postgresql://tester:secret@127.0.0.1:5432/scalesmiths_admin_e2e",
      undefined,
    )).toThrow(/SCALESMITHS_TEST_ENVIRONMENT/)
  })
})
