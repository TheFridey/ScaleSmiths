import { describe, expect, it } from "vitest"
import { ageInDays, assignmentProblem, hrefFor, QUEUE_KINDS, sortQueue, type QueueItem } from "./sales-command"

const item = (over: Partial<QueueItem>): QueueItem => ({ kind: "stalled", id: "x", title: "T", partnerName: null, since: "2026-11-01T00:00:00Z", detail: null, href: "/expansion", opportunityId: null, tags: [], ...over })
const ID = "30000000-0000-4000-8000-000000000001"

describe("sales command queue", () => {
  it("orders by the published kind order, then oldest first, then id", () => {
    const sorted = sortQueue([
      item({ id: "c", kind: "stalled", since: "2026-10-01T00:00:00Z" }), item({ id: "b", kind: "assistance", since: "2026-11-02T00:00:00Z" }),
      item({ id: "a", kind: "assistance", since: "2026-11-01T00:00:00Z" }), item({ id: "d", kind: "scope_review", since: "2026-09-01T00:00:00Z" }),
      item({ id: "e", kind: "assistance", since: "2026-11-01T00:00:00Z" }),
    ])
    expect(sorted.map((i) => i.id)).toEqual(["a", "e", "b", "d", "c"])
    expect(QUEUE_KINDS.every((k) => k.rule.length > 20)).toBe(true)
  })
  it("never mutates its input and computes whole-day ages", () => {
    const input = [item({ id: "z" }), item({ id: "y" })]
    sortQueue(input)
    expect(input.map((i) => i.id)).toEqual(["z", "y"])
    expect(ageInDays("2026-11-20T12:00:00Z", new Date("2026-11-22T11:00:00Z"))).toBe(1)
    expect(ageInDays("2026-12-01T00:00:00Z", new Date("2026-11-22T00:00:00Z"))).toBe(0)
  })
  it("links every item to a real founder workspace destination", () => {
    expect(hrefFor.opportunity(ID)).toBe(`/expansion?tab=pipeline&opportunity=${ID}`)
    expect(hrefFor.meetings()).toBe("/expansion?tab=operations")
    expect(hrefFor.recruitment()).toBe("/expansion?tab=recruitment")
  })
})

describe("assignment validation", () => {
  it("requires a real opportunity, a founder or release, the expected state and a reason", () => {
    expect(assignmentProblem({ opportunityId: ID, assigneeId: ID, reason: "Owns the region", expectedCurrentId: null })).toBeNull()
    expect(assignmentProblem({ opportunityId: ID, assigneeId: null, reason: "Release", expectedCurrentId: ID })).toBeNull()
    expect(assignmentProblem({ opportunityId: "x", assigneeId: null, reason: "Release", expectedCurrentId: null })).toBe("Opportunity not found.")
    expect(assignmentProblem({ opportunityId: ID, assigneeId: 5, reason: "Release", expectedCurrentId: null })).toMatch(/founder/)
    expect(assignmentProblem({ opportunityId: ID, assigneeId: ID, reason: "  ", expectedCurrentId: null })).toMatch(/reason/)
    expect(assignmentProblem({ opportunityId: ID, assigneeId: ID, reason: "ok fine", expectedCurrentId: "nope" })).toMatch(/Reload/)
  })
})
