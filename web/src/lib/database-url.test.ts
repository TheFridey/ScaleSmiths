import { describe, expect, it } from "vitest"
import { resolveMigrationDatabaseUrl, resolveWebDatabaseUrl } from "./database-url"

describe("web database URL resolution", () => {
  it("requires the dedicated runtime URL in production", () => {
    expect(() => resolveWebDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: "postgres://legacy" })).toThrow(/WEB_DATABASE_URL/)
    expect(resolveWebDatabaseUrl({ NODE_ENV: "production", WEB_DATABASE_URL: "postgres://web" })).toBe("postgres://web")
  })

  it("keeps DATABASE_URL as a local and test fallback", () => {
    expect(resolveWebDatabaseUrl({ NODE_ENV: "development", DATABASE_URL: "postgres://local" })).toBe("postgres://local")
    expect(resolveWebDatabaseUrl({ NODE_ENV: "test", DATABASE_URL: "postgres://test" })).toBe("postgres://test")
  })

  it("does not require a database while Next compiles production assets", () => {
    expect(resolveWebDatabaseUrl({ NODE_ENV: "production", npm_lifecycle_event: "build" })).toBeUndefined()
  })

  it("requires migration credentials for production migration commands", () => {
    expect(() => resolveMigrationDatabaseUrl({ NODE_ENV: "production", DATABASE_URL: "postgres://legacy" })).toThrow(/MIGRATION_DATABASE_URL/)
    expect(resolveMigrationDatabaseUrl({ NODE_ENV: "production", MIGRATION_DATABASE_URL: "postgres://migration" })).toBe("postgres://migration")
  })
})
