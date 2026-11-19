import test from "node:test"
import assert from "node:assert/strict"
import { ADMIN_DELETE_TABLES, WEB_APPLICANT_INSERT_COLUMNS, WEB_INSERT_TABLES, WEB_TABLE_GRANTS } from "../admin/scripts/postgres-privilege-policy.mjs"

test("public applicant intake has insert and sequence admission without founder read or review authority", () => {
  assert.equal(WEB_TABLE_GRANTS.has("partner_applications"), false)
  assert(WEB_APPLICANT_INSERT_COLUMNS.includes("privacy_version"))
  assert(WEB_APPLICANT_INSERT_COLUMNS.includes("retention_until"))
  for (const privateColumn of ["id", "status", "submitted_at", "review_notes", "onboarding_confirmations"]) {
    assert(!WEB_APPLICANT_INSERT_COLUMNS.includes(privateColumn))
  }
  assert(WEB_INSERT_TABLES.includes("partner_applications"))
})

test("public runtime never gains partner operating or financial table access", () => {
  assert.deepEqual([...WEB_TABLE_GRANTS.keys()].filter((name) => name.startsWith("expansion_")), [])
})

test("applicant retention does not grant delete over partner or financial history", () => {
  assert(ADMIN_DELETE_TABLES.includes("partner_applications"))
  assert.deepEqual(ADMIN_DELETE_TABLES.filter((name) => name.startsWith("expansion_")).sort(), [
    "expansion_applicant_retention_holds",
    "expansion_payout_claims",
  ])
})
