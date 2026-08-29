import { describe, expect, it } from "vitest"
import { assertDeliverableTransition, assertMilestoneTransition, assertProjectTransition, calculateProjectProgress, DeliveryProjectError } from "./delivery-projects"

describe("delivery project lifecycle", () => {
  it("derives progress from weighted completed milestones and excludes skipped work", () => {
    expect(calculateProjectProgress([
      { status: "completed", weight: 2 },
      { status: "active", weight: 3 },
      { status: "skipped", weight: 20 },
    ])).toBe(40)
  })

  it("keeps completed and cancelled projects terminal", () => {
    expect(() => assertProjectTransition("active", "paused")).not.toThrow()
    expect(() => assertProjectTransition("completed", "active")).toThrow(DeliveryProjectError)
    expect(() => assertProjectTransition("cancelled", "active")).toThrow(DeliveryProjectError)
  })

  it("protects completed milestones from being reopened implicitly", () => {
    expect(() => assertMilestoneTransition("blocked", "active")).not.toThrow()
    expect(() => assertMilestoneTransition("completed", "active")).toThrow(DeliveryProjectError)
  })

  it("keeps deliverables on the explicit review and delivery path", () => {
    expect(() => assertDeliverableTransition("in_review", "approved")).not.toThrow()
    expect(() => assertDeliverableTransition("planned", "delivered")).toThrow(DeliveryProjectError)
    expect(() => assertDeliverableTransition("delivered", "in_progress")).toThrow(DeliveryProjectError)
  })
})
