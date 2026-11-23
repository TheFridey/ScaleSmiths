import { describe, expect, it } from "vitest"
import { handoffReadiness, validateHandoffApproval, type HandoffSource } from "./delivery-handoff"

const accepted: HandoffSource = {
  opportunityId:"30000000-0000-4000-8000-000000000001", opportunityStatus:"contract_accepted",
  contractId:"40000000-0000-4000-8000-000000000001", contractClientId:3, opportunityClientId:3,
  acceptedAt:"2026-11-23T12:00:00Z", agreementReference:"SIGNED-TEST-001", scopeVersion:2,
  scopeSnapshot:{ services:["website"] }, cancelled:false, existingHandoffId:null,
}
describe("B2.6 immutable handoff readiness", () => {
  it("accepts only an authoritative, uncancelled, unhandled accepted contract", () => {
    expect(handoffReadiness(accepted)).toEqual({ready:true,blockers:[],alreadyHandedOff:false})
  })
  it("refuses cancelled contracts and stale lifecycle stages", () => {
    const r=handoffReadiness({...accepted,cancelled:true,opportunityStatus:"approved"})
    expect(r.ready).toBe(false)
    expect(r.blockers).toEqual(expect.arrayContaining([expect.stringContaining("cancellation"),expect.stringContaining("accepted contract")]))
  })
  it("protects against wrong-client links, empty accepted scopes and duplicate handoffs", () => {
    const r=handoffReadiness({...accepted,contractClientId:8,scopeVersion:0,existingHandoffId:"00000000-0000-4000-8000-000000000001"})
    expect(r.ready).toBe(false)
    expect(r.alreadyHandedOff).toBe(true)
    expect(r.blockers.length).toBeGreaterThanOrEqual(3)
  })
  it("requires positive founder confirmation, an expected exact contract and a meaningful reason", () => {
    const input={confirm:true,opportunityId:accepted.opportunityId,expectedContractId:accepted.contractId,reason:"Reviewed signed agreement and accepted technical scope"}
    expect(validateHandoffApproval(input).reason).toContain("Reviewed")
    expect(()=>validateHandoffApproval({...input,confirm:false})).toThrow()
    expect(()=>validateHandoffApproval({...input,expectedContractId:"nope"})).toThrow()
    expect(()=>validateHandoffApproval({...input,reason:"ok"})).toThrow()
  })
})
