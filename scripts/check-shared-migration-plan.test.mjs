import assert from "node:assert/strict"
import test from "node:test"
import { validateSharedMigrationPlan } from "./check-shared-migration-plan.mjs"

test("global plan contains both complete histories in dependency-safe order", async () => {
  const { plan, failures } = await validateSharedMigrationPlan()
  assert.deepEqual(failures, [])
  assert.equal(plan.ordered.length, plan.histories.web.length + plan.histories.admin.length)
  assert.ok(plan.ordered.findIndex((item) => item.entry.tag === "0050_flippant_namor") < plan.ordered.findIndex((item) => item.entry.tag === "0018_unified_client_activity"))
})

test("immutable duplicate DDL is guarded by structural equivalence", async () => {
  const { plan } = await validateSharedMigrationPlan()
  const rule = plan.equivalentMigrations["admin/0052_stiff_dazzler"]
  assert.equal(rule.satisfiedBy, "web/0017_client_request_read_state")
  assert.deepEqual(rule.columns.map(({ table, column }) => `${table}.${column}`), [
    "client_request_messages.notification_email_status",
    "client_request_messages.notification_email_failure_reason",
    "client_requests.client_last_read_at",
    "client_requests.admin_last_read_at",
  ])
})

test("SQL object references are checked against producers in the global plan", async () => {
  const { failures } = await validateSharedMigrationPlan()
  assert.equal(failures.some((failure) => failure.includes("references missing object")), false)
})
