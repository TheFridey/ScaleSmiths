import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { ADMIN_ROLES } from "./admin-users"
import { AUTHORIZATION_POLICY, authorizationExpectation, type HttpMethod } from "./authorization-policy"
import { authorizeRequest, hasCapability } from "./rbac"

interface DiscoveredOperation { file: string; pathname: string; method: HttpMethod }

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)])
}

function discoverOperations(): DiscoveredOperation[] {
  const appRoot = path.resolve("src", "app")
  return walk(path.join(appRoot, "api")).filter((file) => file.endsWith(`${path.sep}route.ts`)).flatMap((file) => {
    const source = readFileSync(file, "utf8")
    const pathname = `/${path.relative(appRoot, path.dirname(file)).replaceAll("\\", "/").replace(/\[[^/]+\]/g, "policy-test-id")}`
    return [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)]
      .map((match) => ({ file, pathname, method: match[1] as HttpMethod }))
  })
}

const operations = discoverOperations()

describe("authoritative authorization policy", () => {
  it("covers every exported admin API operation with complete review metadata", () => {
    expect(operations.filter(({ pathname, method }) => !authorizationExpectation(pathname, method))).toEqual([])
    for (const operation of operations) {
      const expectation = authorizationExpectation(operation.pathname, operation.method)
      expect(expectation).toMatchObject({ route: operation.pathname, method: operation.method, authenticated: expect.any(Boolean), domain: expect.any(String), scopeRule: expect.any(String), allow: expect.any(String), deny: expect.any(String) })
      if (expectation?.authenticated) expect(expectation.capability ?? expectation.id).toBeTruthy()
    }
  })

  it("has no dead policy rule", () => {
    for (const policy of AUTHORIZATION_POLICY) {
      if (policy.id === "auth.protocol") continue // Auth.js exports handlers through destructuring, not function declarations.
      expect(operations.some(({ pathname, method }) => policy.route.test(pathname) && policy.methods.includes(method)), policy.id).toBe(true)
    }
  })

  it("allows capable roles and denies every insufficient role", () => {
    for (const operation of operations) {
      const expectation = authorizationExpectation(operation.pathname, operation.method)!
      if (!expectation.capability) continue
      const allowed = ADMIN_ROLES.filter((role) => hasCapability(role, expectation.capability!))
      const denied = ADMIN_ROLES.filter((role) => !hasCapability(role, expectation.capability!))
      expect(allowed.length).toBeGreaterThan(0)
      for (const role of allowed) expect(authorizeRequest(role, operation)).toMatchObject({ allowed: true, capability: expectation.capability })
      for (const role of denied) expect(authorizeRequest(role, operation)).toMatchObject({ allowed: false, capability: expectation.capability })
    }
  })

  it("keeps read and write permissions separate", () => {
    const pairs = [["/api/clients/policy-test-id", "clients.read", "clients.write"], ["/api/prospects/policy-test-id", "leads.read", "leads.write"], ["/api/invoices/policy-test-id", "finance.read", "finance.write"], ["/api/forge/projects/policy-test-id", "projects.read", "projects.write"]] as const
    for (const [pathname, read, write] of pairs) {
      expect(authorizationExpectation(pathname, "GET")?.capability).toBe(read)
      expect(authorizationExpectation(pathname, "PATCH")?.capability).toBe(write)
    }
  })

  it("fails closed for an unregistered API operation", () => {
    expect(authorizeRequest("owner", { pathname: "/api/unregistered-sensitive-route", method: "POST" })).toMatchObject({ allowed: false, capability: null, reason: "unmapped_api_operation" })
  })
})
