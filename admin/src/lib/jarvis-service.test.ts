import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { authenticateJarvisService, authorizeJarvisRead, jarvisReadAction, jarvisReadQuery } from "./jarvis-service"
const token = "a".repeat(64)
const env = {JARVIS_SERVICE_TOKEN_SHA256: createHash("sha256").update(token).digest("hex"), JARVIS_SERVICE_ADMIN_ID: "operator", JARVIS_SERVICE_SESSION_VERSION: "3", JARVIS_SERVICE_SCOPES: "clients.read,invoices.read"}
const headers = new Headers({authorization: `Bearer ${token}`})
describe("JARVIS service authority", () => {
  it("rejects missing configuration and invalid credentials", () => {
    expect(() => authenticateJarvisService(headers, {})).toThrow("integration_not_configured")
    for (const authorization of ["", `Bearer ${"b".repeat(64)}`, `Basic ${token}`, `Bearer ${token},Bearer ${token}`]) expect(() => authenticateJarvisService(new Headers({authorization}), env)).toThrow("unauthorized")
    expect(authenticateJarvisService(headers, env)).toMatchObject({userId: "operator", sessionVersion: 3})
  })
  it("requires current identity, explicit action scope and role capability", () => {
    const identity = authenticateJarvisService(headers, env)
    const user = {active: true, sessionVersion: 3, role: "sales" as const}
    expect(() => authorizeJarvisRead(identity, user, "clients.read")).not.toThrow()
    expect(() => authorizeJarvisRead(identity, {...user, role: "developer"}, "invoices.read")).toThrow("scope_denied")
    expect(() => authorizeJarvisRead(identity, {...user, role: "owner"}, "tasks.read")).toThrow("scope_denied")
    for (const revoked of [null, {...user, active: false}, {...user, sessionVersion: 4}]) expect(() => authorizeJarvisRead(identity, revoked, "clients.read")).toThrow("service_identity_revoked")
  })
  it("never exposes mutation actions or unsupported domains", () => {
    for (const action of ["clients.update", "leads.update", "tasks.update", "infrastructure.read", "caseStudies.read", "__proto__"]) expect(() => jarvisReadAction(action)).toThrow("unsupported_action")
  })
  it("bounds pagination and rejects unknown, duplicate and conflicting input", () => {
    expect(jarvisReadQuery(new URLSearchParams("limit=100&clientId=2&cursor=10"))).toEqual({id: null, clientId: "2", cursor: "10", limit: 100})
    for (const query of ["limit=101", "limit=0", "limit=-1", "limit=1&limit=2", "token=secret", "id=1&id=2", "id=bad", "cursor=DROP", "id=2&cursor=3"]) expect(() => jarvisReadQuery(new URLSearchParams(query))).toThrow("invalid_query")
  })
})
