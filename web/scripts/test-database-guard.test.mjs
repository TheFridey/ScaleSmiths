import { describe, expect, it } from "vitest"
import { assertIsolatedTestDatabase } from "./test-database-guard.mjs"

describe("isolated web test database guard", () => {
  it("accepts the named local Forge V2 fixture", () => {
    expect(assertIsolatedTestDatabase(
      "postgresql://tester:secret@127.0.0.1:5432/scalesmiths_web_e2e",
      "forge-v2-e2e",
    )).toMatchObject({ host: "127.0.0.1", databaseName: "scalesmiths_web_e2e" })
  })

  it("rejects a production-like database name before connecting", () => {
    expect(() => assertIsolatedTestDatabase(
      "postgresql://tester:secret@127.0.0.1:5432/scalesmiths",
      "forge-v2-e2e",
    )).toThrow(/without an isolated test name/)
  })

  it("rejects remote hosts and missing environment confirmation", () => {
    expect(() => assertIsolatedTestDatabase(
      "postgresql://tester:secret@db.example.test:5432/scalesmiths_web_e2e",
      "forge-v2-e2e",
    )).toThrow(/non-local test database host/)
    expect(() => assertIsolatedTestDatabase(
      "postgresql://tester:secret@127.0.0.1:5432/scalesmiths_web_e2e",
      undefined,
    )).toThrow(/SCALESMITHS_TEST_ENVIRONMENT/)
  })
})
