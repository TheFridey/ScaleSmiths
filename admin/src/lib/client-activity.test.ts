import { describe, expect, it } from "vitest"
import { clientVisibleActivity, normaliseClientActivity, orderActivityNewestFirst } from "./client-activity"

const base = { clientRecordId: 7, sourceDomain: "project" as const, sourceReference: "project:4", type: "project_created", title: "Project created", description: "Delivery started.", visibility: "client_visible" as const, actor: { type: "admin" as const, id: "user-1", label: "Alex" }, idempotencyKey: "project:4:created" }

describe("client activity timeline", () => {
  it("orders equal timestamps deterministically by id", () => { const time = new Date("2026-08-29T10:00:00Z"); expect(orderActivityNewestFirst([{ id: 1, occurredAt: time }, { id: 2, occurredAt: time }, { id: 3, occurredAt: new Date("2026-08-28") }]).map(x => x.id)).toEqual([2, 1, 3]) })
  it("filters internal activity from client projections", () => expect(clientVisibleActivity([{ id: 1, visibility: "internal" as const }, { id: 2, visibility: "client_visible" as const }]).map(x => x.id)).toEqual([2]))
  it("requires explicit tenancy and idempotency", () => { expect(() => normaliseClientActivity({ ...base, clientRecordId: 0 })).toThrow("valid client"); expect(() => normaliseClientActivity({ ...base, idempotencyKey: "" })).toThrow("idempotency") })
  it("drops nested metadata that could accidentally serialize domain objects", () => expect(normaliseClientActivity({ ...base, metadata: { status: "ready", nested: { secret: true } } }).metadata).toEqual({ status: "ready" }))
})
