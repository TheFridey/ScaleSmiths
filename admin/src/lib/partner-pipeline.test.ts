import { describe, expect, it } from "vitest"
import { PARTNER_TRANSITIONS } from "./expansion"
import { attentionFor, columnFor, filterPipeline, meetingState, missingScopeFields, PIPELINE_COLUMNS, timelineEntry, transitionBlockedReason, transitionOptions, type PipelineCard } from "./partner-pipeline"

const NOW = new Date("2026-11-22T12:00:00Z")
const STATUSES = ["registered", "contacted", "discovery", "qualified", "scope_submitted", "more_information", "bespoke_required", "deferred", "approved", "contract_accepted", "closed_lost", "withdrawn"]
const meeting = (status: string, confirmedStart: string | null = null) => ({ id: "m", status, meetingType: "joint_sales", confirmedStart, proposedStart: null, createdAt: NOW.toISOString() })

describe("pipeline columns", () => {
  it("place every authoritative status in exactly one column", () => {
    for (const s of STATUSES) expect(PIPELINE_COLUMNS.filter((c) => (c.statuses as readonly string[]).includes(s))).toHaveLength(1)
    expect(columnFor("scope_submitted")).toBe("review")
    expect(columnFor("not-a-status")).toBeNull()
  })
})

describe("transitions", () => {
  it("offer exactly the server's partner transitions and nothing a founder decides", () => {
    for (const s of STATUSES) expect(transitionOptions(s).map((t) => t.to)).toEqual(PARTNER_TRANSITIONS[s] ?? [])
    for (const s of STATUSES) for (const t of transitionOptions(s)) expect(["approved", "contract_accepted", "scope_submitted"]).not.toContain(t.to)
  })
  it("explain every forbidden move and never explain a permitted one", () => {
    expect(transitionBlockedReason("registered", "contacted")).toBeNull()
    expect(transitionBlockedReason("scope_submitted", "withdrawn")).toMatch(/founder decision/)
    expect(transitionBlockedReason("registered", "approved")).toMatch(/Only ScaleSmiths/)
    expect(transitionBlockedReason("closed_lost", "discovery")).toMatch(/closed/)
    expect(transitionBlockedReason("discovery", "scope_submitted")).toMatch(/discovery form/)
  })
})

describe("meetings and attention", () => {
  it("rank a meeting waiting for the partner above confirmed and pending ones", () => {
    expect(meetingState([], NOW)).toBe("none")
    expect(meetingState([meeting("requested")], NOW)).toBe("pending")
    expect(meetingState([meeting("requested"), meeting("confirmed", "2026-12-01T10:00:00Z")], NOW)).toBe("confirmed")
    expect(meetingState([meeting("confirmed", "2026-11-01T10:00:00Z")], NOW)).toBe("none")
    expect(meetingState([meeting("confirmed", "2026-12-01T10:00:00Z"), meeting("alternative_proposed")], NOW)).toBe("awaiting_you")
  })
  it("derive reasons only from recorded facts", () => {
    const keys = (o: Parameters<typeof attentionFor>[0]) => attentionFor(o, NOW).map((a) => a.key)
    expect(keys({ status: "registered", discovery: {}, followUp: null, meetings: [] })).toEqual(["discovery"])
    expect(keys({ status: "more_information", discovery: {}, followUp: "2026-11-20T00:00:00Z", meetings: [meeting("info_required")] })).toEqual(["information", "meeting", "follow_up"])
    expect(keys({ status: "withdrawn", discovery: {}, followUp: "2026-11-20T00:00:00Z", meetings: [] })).toEqual([])
    const complete = { objectives: "a", pages: "b", functionality: "c", budget: "d", timescale: "e", decisionProcess: "f" }
    expect(missingScopeFields(complete)).toEqual([])
    expect(keys({ status: "discovery", discovery: complete, followUp: "2026-12-20T00:00:00Z", meetings: [] })).toEqual(["scope_ready"])
    expect(missingScopeFields({ objectives: "  " })).toContain("objectives")
  })
})

describe("timeline privacy", () => {
  const at = NOW.toISOString()
  it("never exposes founder notes, pricing, classification or market decisions", () => {
    const reviewed = timelineEntry({ action: "scope_reviewed", details: { decision: "approved", notes: "internal margin 40%" }, createdAt: at, byPartner: false })
    expect(reviewed).toEqual({ at, label: "ScaleSmiths approved the scope", actor: "scalesmiths", kind: "opportunity" })
    expect(JSON.stringify(timelineEntry({ action: "contract_accepted", details: { terms: { websitePence: 100000 } }, createdAt: at, byPartner: false }))).not.toMatch(/100000|terms/)
    for (const action of ["opportunity_sector_classified", "opportunity_market_set", "exclusivity_decided", "discount_reserved", "business_suppressed", "made_up"]) expect(timelineEntry({ action, details: {}, createdAt: at, byPartner: false })).toBeNull()
    expect(timelineEntry({ action: "scope_reviewed", details: { decision: "constructor" }, createdAt: at, byPartner: false })).toBeNull()
    expect(timelineEntry({ action: "toString", details: {}, createdAt: at, byPartner: false })).toBeNull()
  })
  it("labels stage changes and meeting events with who acted", () => {
    expect(timelineEntry({ action: "stage_changed", details: { from: "registered", to: "contacted" }, createdAt: at, byPartner: true })?.label).toBe("Stage changed from Registered to Contacted")
    expect(timelineEntry({ action: "meeting_confirm", details: { note: "private" }, createdAt: at, byPartner: false })).toMatchObject({ label: "Meeting confirmed", actor: "scalesmiths" })
    expect(timelineEntry({ action: "meeting_cancel", details: {}, createdAt: at, byPartner: true })?.actor).toBe("you")
  })
})

describe("filtering", () => {
  const card = (over: Partial<PipelineCard>): PipelineCard => ({ id: "x", businessName: "Acme", status: "registered", statusLabel: "Registered", column: "new", createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
    lastActivity: "2026-11-01T00:00:00Z", followUp: null, meeting: "none", meetingLabel: null, attention: [], industry: null, transitions: [], ...over })
  const cards = [card({ id: "1", businessName: "Bravo Bakery", industry: "Food", lastActivity: "2026-11-10T00:00:00Z" }), card({ id: "2", businessName: "Alpha Plumbing", column: "review", attention: [{ key: "follow_up", label: "" }], followUp: "2026-11-05T00:00:00Z" }), card({ id: "3", businessName: "Charlie Cafe", meeting: "confirmed", createdAt: "2026-11-20T00:00:00Z" })]
  it("searches, filters and sorts without mutating the input", () => {
    expect(filterPipeline(cards, { q: "food" }).map((c) => c.id)).toEqual(["1"])
    expect(filterPipeline(cards, { column: "review" }).map((c) => c.id)).toEqual(["2"])
    expect(filterPipeline(cards, { meeting: "confirmed" }).map((c) => c.id)).toEqual(["3"])
    expect(filterPipeline(cards, { attention: true }).map((c) => c.id)).toEqual(["2"])
    expect(filterPipeline(cards, { sort: "name" }).map((c) => c.id)).toEqual(["2", "1", "3"])
    expect(filterPipeline(cards, { sort: "created" })[0].id).toBe("3")
    expect(filterPipeline(cards, { sort: "follow_up" })[0].id).toBe("2")
    expect(filterPipeline(cards, {})[0].id).toBe("1")
    expect(cards.map((c) => c.id)).toEqual(["1", "2", "3"])
  })
})
