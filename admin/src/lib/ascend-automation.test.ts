import { describe, expect, it } from "vitest"
import { operationalSignals } from "./ascend-automation"

const now = new Date("2026-11-23T12:00:00Z")
describe("B2.7 read-only operating signals", () => {
  it("only surfaces recorded, already-eligible command queue events", () => {
    const r = operationalSignals([
      { id:"notification:a", kind:"notification_failed", title:"Email failed", since:"2026-11-22T00:00:00Z", href:"/expansion", ageDays:1 },
      { id:"meeting:b", kind:"meeting", title:"Client meeting", since:"2026-11-22T01:00:00Z", href:"/expansion", ageDays:1 },
      { id:"unknown:c", kind:"guessed", title:"Made up", since:"2026-11-22T01:00:00Z", href:"/expansion", ageDays:1 },
      { id:"scope:d", kind:"scope_review", title:"Future", since:"2026-11-24T01:00:00Z", href:"/expansion", ageDays:-1 },
    ], [], now)
    expect(r.map(x=>x.kind)).toEqual(["notification_failed","meeting"])
    expect(r[0].severity).toBe("urgent")
    expect(r.every(x=>x.recommendedAction.length>10)).toBe(true)
  })
  it("does not re-create a completed handoff or approve a blocked one", () => {
    const r = operationalSignals([], [
      { opportunityId:"a", businessName:"Ready", acceptedAt:"2026-11-22T00:00:00Z", readiness:{ready:true,blockers:[],alreadyHandedOff:false} },
      { opportunityId:"b", businessName:"Blocked", acceptedAt:"2026-11-22T01:00:00Z", readiness:{ready:false,blockers:["Scope missing"],alreadyHandedOff:false} },
      { opportunityId:"c", businessName:"Done", acceptedAt:"2026-11-22T01:00:00Z", readiness:{ready:false,blockers:["Already handed over"],alreadyHandedOff:true} },
    ], now)
    expect(r.map(x=>x.kind)).toEqual(["handoff_ready","handoff_blocked"])
    expect(r.find(x=>x.kind==="handoff_blocked")?.recommendedAction).toContain("Resolve")
    expect(r.every(x=>x.href==="/expansion/handoffs")).toBe(true)
  })
  it("rejects unsafe navigation and invalid event times", () => {
    expect(operationalSignals([{ id:"a",kind:"stalled",title:"Unsafe",since:"2026-11-22",href:"//evil.example",ageDays:1 }],[],now)).toEqual([])
    expect(operationalSignals([{ id:"b",kind:"meeting",title:"Invalid",since:"invalid",href:"/expansion",ageDays:1 }],[],now)).toEqual([])
    expect(()=>operationalSignals([],[],new Date("bad"))).toThrow()
  })
  it("produces stable identifiers without deriving a partner activity ranking", () => {
    const q=[{id:"scope:1",kind:"scope_review",title:"Scope",since:"2026-11-22T00:00:00Z",href:"/expansion",ageDays:1}]
    expect(operationalSignals(q,[],now)[0].id).toBe("sales:scope:1")
    expect(operationalSignals(q,[],now)).toEqual(operationalSignals(q,[],now))
  })
})
