import { describe, expect, it } from 'vitest'
import { isSafeReviewSignal, safeReviewHref } from './ascend-review-validation'
const valid = {id:'sales:meeting:1',source:'sales_command',kind:'meeting',severity:'attention',title:'Meeting',explanation:'Review',recommendedAction:'Open the record',observedAt:'2026-11-23T00:00:00Z',href:'/expansion?tab=meetings'}
describe('B2.8 persisted advisory validation', () => {
  it('accepts only internal founder expansion links', () => {
    expect(safeReviewHref('/expansion/handoffs')).toBe(true)
    for(const href of ['//evil.example','/\\evil.example','/partner','/expansion-other','/expansion\n','https://evil.example','/'])expect(safeReviewHref(href)).toBe(false)
  })
  it('accepts a complete advisory and rejects malformed persisted payloads', () => {
    expect(isSafeReviewSignal(valid)).toBe(true)
    for(const patch of [{href:'//evil.example'},{href:42},{id:''},{source:'external'},{severity:'critical'},{observedAt:'garbage'},{title:null}])expect(isSafeReviewSignal({...valid,...patch})).toBe(false)
    expect(isSafeReviewSignal(null)).toBe(false)
  })
})
