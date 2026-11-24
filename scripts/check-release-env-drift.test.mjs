import { test } from "node:test"
import assert from "node:assert/strict"
import { compareEnvironments, isDrift, GOVERNED_SWITCHES } from "./check-release-env-drift.mjs"

const live = "PARTNER_APPLICATIONS_ENABLED=true\nASCEND_ENGINE_ENABLED=true\nASCEND_SCHEDULER_ENABLED=false\nSECRET_TOKEN=abc\n"

test("identical governed switches pass; secrets are not governed", () => {
  const r = compareEnvironments(live, live.replace("abc", "different"))
  assert.equal(r.filter(isDrift).length, 0)
  assert.ok(!GOVERNED_SWITCHES.includes("SECRET_TOKEN"))
})

test("the 24 November 2026 drift is caught: switches present in the release but missing from the canonical file", () => {
  const r = compareEnvironments("MEGATON_ENABLED=true\n", "MEGATON_ENABLED=true\n" + live)
  const byKey = Object.fromEntries(r.map((e) => [e.key, e.status]))
  assert.equal(byKey.PARTNER_APPLICATIONS_ENABLED, "missing_in_canonical")
  assert.equal(byKey.ASCEND_ENGINE_ENABLED, "missing_in_canonical")
  assert.equal(byKey.MEGATON_ENABLED, "identical")
  assert.ok(r.some(isDrift))
})

test("differing values and runtime-equivalent syntax are compared as node --env-file reads them", () => {
  assert.equal(compareEnvironments("ASCEND_AGENT_API_ENABLED=false\n", "ASCEND_AGENT_API_ENABLED=true\n").find((e) => e.key === "ASCEND_AGENT_API_ENABLED").status, "differs")
  assert.equal(compareEnvironments("export ASCEND_AGENT_API_ENABLED=false # off\n", "ASCEND_AGENT_API_ENABLED=\"false\"\n").find((e) => e.key === "ASCEND_AGENT_API_ENABLED").status, "identical")
})

test("output entries never carry values", () => {
  for (const e of compareEnvironments(live, live)) assert.deepEqual(Object.keys(e).sort(), ["key", "status"])
})

test("governs the partner portal launch switches (Empower B2.10), so a release cannot silently close the portal", () => {
  for (const key of ["PARTNER_ACTIVATION_ENABLED", "PARTNER_EMAIL_ENABLED", "PARTNER_ACADEMY_ENABLED", "PARTNER_RESOURCE_CENTRE_ENABLED", "PARTNER_KNOWLEDGE_BASE_ENABLED", "PARTNER_PIPELINE_ENABLED"]) assert.ok(GOVERNED_SWITCHES.includes(key), key)
  const r = compareEnvironments("PARTNER_ACADEMY_ENABLED=true\n", "")
  assert.equal(r.find((e) => e.key === "PARTNER_ACADEMY_ENABLED").status, "missing_in_release")
  assert.ok(isDrift(r.find((e) => e.key === "PARTNER_ACADEMY_ENABLED")))
})
