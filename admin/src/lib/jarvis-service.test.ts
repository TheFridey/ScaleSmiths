import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { JARVIS_COMMUNICATIONS_ACTIONS, authenticateJarvisService, authorizeJarvisRead, decodeCursor, encodeCursor, jarvisReadAction, jarvisReadQuery } from "./jarvis-service"
const token = "a".repeat(64)
const env = {JARVIS_SERVICE_TOKEN_SHA256: createHash("sha256").update(token).digest("hex"), JARVIS_SERVICE_ADMIN_ID: "operator", JARVIS_SERVICE_SESSION_VERSION: "3", JARVIS_SERVICE_SCOPES: "clients.read,invoices.read"}
const commsEnv = {...env, JARVIS_SERVICE_SCOPES: "messages.read,enquiries.read,partner-applications.read,partner-requests.read"}
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
    for (const action of ["clients.update", "leads.update", "tasks.update", "infrastructure.read", "caseStudies.read", "__proto__", "messages.update", "enquiries.delete"]) expect(() => jarvisReadAction(action)).toThrow("unsupported_action")
  })
  it("exposes communications reads but only with an explicit scope", () => {
    for (const action of JARVIS_COMMUNICATIONS_ACTIONS) expect(jarvisReadAction(action)).toBe(action)
    const identity = authenticateJarvisService(headers, env)
    const owner = {active: true, sessionVersion: 3, role: "owner" as const}
    // Not in JARVIS_SERVICE_SCOPES yet, so denied even for an owner.
    expect(() => authorizeJarvisRead(identity, owner, "messages.read")).toThrow("scope_denied")
    const commsIdentity = authenticateJarvisService(headers, commsEnv)
    expect(() => authorizeJarvisRead(commsIdentity, owner, "messages.read")).not.toThrow()
    expect(() => authorizeJarvisRead(commsIdentity, owner, "enquiries.read")).not.toThrow()
    expect(() => authorizeJarvisRead(commsIdentity, owner, "partner-applications.read")).not.toThrow()
    expect(() => authorizeJarvisRead(commsIdentity, owner, "partner-requests.read")).not.toThrow()
  })
  it("bounds pagination and rejects unknown, duplicate and conflicting input", () => {
    expect(jarvisReadQuery(new URLSearchParams("limit=100&clientId=2&cursor=10"))).toEqual({id: null, clientId: "2", cursor: "10", limit: 100})
    // Partner-request rows are keyed `mr:<uuid>` / `tk:<uuid>`; their cursors and
    // id lookups must survive validation or the source breaks on page two.
    expect(jarvisReadQuery(new URLSearchParams("cursor=mr:11111111-1111-1111-1111-111111111111")).cursor).toBe("mr:11111111-1111-1111-1111-111111111111")
    expect(jarvisReadQuery(new URLSearchParams("cursor=tk:22222222-2222-2222-2222-222222222222")).cursor).toBe("tk:22222222-2222-2222-2222-222222222222")
    // Communications sources page newest-first on a compound `<micros>|<id>`
    // keyset cursor. Both halves are required for the tuple comparison.
    expect(jarvisReadQuery(new URLSearchParams("cursor=1794000131123456|42")).cursor).toBe("1794000131123456|42")
    expect(jarvisReadQuery(new URLSearchParams("cursor=1794000131123456|mr:11111111-1111-1111-1111-111111111111")).cursor).toBe("1794000131123456|mr:11111111-1111-1111-1111-111111111111")
    // Pre-1970 timestamps have a negative epoch; year-2300 needs 17 digits.
    expect(jarvisReadQuery(new URLSearchParams("cursor=-1|42")).cursor).toBe("-1|42")
    expect(jarvisReadQuery(new URLSearchParams("cursor=-1|tk:22222222-2222-2222-2222-222222222222")).cursor).toBe("-1|tk:22222222-2222-2222-2222-222222222222")
    expect(jarvisReadQuery(new URLSearchParams("cursor=10413792000000000|42")).cursor).toBe("10413792000000000|42")
    // The non-finite sentinels are 20 digits including the sign. A client can send
    // them, and the server itself emits them for infinity rows, so they must
    // validate rather than being rejected as out of range.
    expect(jarvisReadQuery(new URLSearchParams("cursor=10000000000000000000|42")).cursor).toBe("10000000000000000000|42")
    expect(jarvisReadQuery(new URLSearchParams("cursor=-10000000000000000000|42")).cursor).toBe("-10000000000000000000|42")
    expect(jarvisReadQuery(new URLSearchParams("cursor=-10000000000000000000|tk:22222222-2222-2222-2222-222222222222")).cursor).toBe("-10000000000000000000|tk:22222222-2222-2222-2222-222222222222")
    for (const query of ["limit=101", "limit=0", "limit=-1", "limit=1&limit=2", "token=secret", "id=1&id=2", "id=bad", "cursor=DROP", "cursor=mr:not-a-uuid", "cursor=0", "id=2&cursor=3",
      // Microsecond half must be a plain integer of bounded width.
      "cursor=1794000131123456|", "cursor=|42", "cursor=123456789012345678901|42", "cursor=17e9|42", "cursor=DROP|42",
      // A bare numeric cast of extract(epoch) renders with scale 6. That form
      // reached a page boundary once and the server rejected its own cursor.
      "cursor=1795168800000000.000000|42", "cursor=-1.000000|42",
      // A leading plus is not an integer literal here.
      "cursor=+1|42",
      // A timestamp-shaped cursor is no longer accepted; it was the form whose
      // `+00` offset broke page two once placed in a URL.
      "cursor=2026-11-25 18:02:11.123456+00|42", "cursor=2026-11-25T18:02:11Z|42"]) expect(() => jarvisReadQuery(new URLSearchParams(query))).toThrow("invalid_query")
  })
  it("round-trips an emitted cursor back through validation", () => {
    // The defect this guards against: the cursor the server emitted was not the
    // cursor validation accepted, so page two failed with invalid_query. Drive
    // the whole path - emit, encode into a URL, validate, split - for both a
    // numeric id and a prefixed partner-request id.
    for (const [ts, id] of [["1794000131123456", "42"], ["1794000131123456", "mr:11111111-1111-1111-1111-111111111111"], ["1794000131123456", "tk:22222222-2222-2222-2222-222222222222"], ["0", "1"]] as const) {
      const emitted = encodeCursor(ts, id)
      const params = new URLSearchParams(); params.set("cursor", emitted)
      const accepted = jarvisReadQuery(new URLSearchParams(params.toString()))
      expect(accepted.cursor).toBe(emitted)
      expect(decodeCursor(accepted.cursor)).toEqual({ts, id})
    }
    // Two rows on the same microsecond must produce distinct cursors that each
    // decode to their own id, or a page boundary repeats or skips a row.
    const a = encodeCursor("1794000131123456", "42"), b = encodeCursor("1794000131123456", "43")
    expect(a).not.toBe(b)
    expect(decodeCursor(a)).toEqual({ts: "1794000131123456", id: "42"})
    expect(decodeCursor(b)).toEqual({ts: "1794000131123456", id: "43"})
    // A plain id cursor carries no timestamp, which the keyset reader rejects.
    expect(decodeCursor("42")).toEqual({ts: null, id: "42"})
    expect(decodeCursor(null)).toEqual({ts: null, id: null})
    // Refusing to emit an unvalidatable cursor is the guard itself.
    expect(() => encodeCursor("2026-11-25 18:02:11.123456+00", "42")).toThrow("cursor_encoding_failed")
    expect(() => encodeCursor("1794000131123456", "DROP")).toThrow("cursor_encoding_failed")
  })
  it("issues cursors that survive a URL round trip", () => {
    // The cursor is opaque to the caller and travels in a query string, so it
    // must contain nothing that URL parsing rewrites. `+` becomes a space and a
    // space is dropped on re-encode, which is exactly how page two broke before.
    const cursors = ["1794000131123456|42", "1|mr:11111111-1111-1111-1111-111111111111", "1|tk:22222222-2222-2222-2222-222222222222"]
    for (const cursor of cursors) {
      expect(cursor).not.toMatch(/[\s+]/)
      const params = new URLSearchParams(); params.set("cursor", cursor)
      expect(jarvisReadQuery(params).cursor).toBe(cursor)
      expect(jarvisReadQuery(new URLSearchParams(params.toString())).cursor).toBe(cursor)
    }
    // Two rows sharing a timestamp still page: the id breaks the tie.
    const shared = "1794000131123456"
    expect(jarvisReadQuery(new URLSearchParams(`cursor=${shared}|42`)).cursor).toBe(`${shared}|42`)
    expect(jarvisReadQuery(new URLSearchParams(`cursor=${shared}|43`)).cursor).toBe(`${shared}|43`)
  })
})
