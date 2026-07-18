import { describe, expect, it } from "vitest"
import { resolveAdminDatabaseUrl, resolveMigrationDatabaseUrl } from "./database-url"

describe("admin database URL resolution", () => {
  it("requires the dedicated runtime URL in production", () => {
    expect(() => resolveAdminDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: "postgres://legacy" })).toThrow(/ADMIN_DATABASE_URL/)
    expect(resolveAdminDatabaseUrl({ NODE_ENV: "production", ADMIN_DATABASE_URL: "postgres://admin" })).toBe("postgres://admin")
  })

  it("retains the local and test fallback", () => {
    expect(resolveAdminDatabaseUrl({ NODE_ENV: "development", DATABASE_URL: "postgres://local" })).toBe("postgres://local")
    expect(resolveAdminDatabaseUrl({ NODE_ENV: "test", DATABASE_URL: "postgres://test" })).toBe("postgres://test")
  })

  it("permits database-free production compilation", () => {
    expect(resolveAdminDatabaseUrl({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBeUndefined()
  })

  it("requires the migration URL for production migration commands", () => {
    expect(() => resolveMigrationDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: "postgres://legacy" })).toThrow(/MIGRATION_DATABASE_URL/)
    expect(resolveMigrationDatabaseUrl({ NODE_ENV: "production", MIGRATION_DATABASE_URL: "postgres://migration" })).toBe("postgres://migration")
  })
})
