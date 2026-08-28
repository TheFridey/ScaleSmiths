import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { mkdtemp, cp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import { validateBranchProtectionContract } from "./check-branch-protection-policy.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("accepts the repository branch-protection contract", async () => {
  assert.deepEqual(await validateBranchProtectionContract(root), [])
})

async function withRepositoryFixture(run) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "scalesmiths-branch-policy-"))
  try {
    for (const item of [".github", "scripts", "docs/operations"]) {
      await cp(path.join(root, item), path.join(temporaryRoot, item), { recursive: true })
    }
    await run(temporaryRoot)
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
}

test("rejects a renamed required workflow job", async () => {
  await withRepositoryFixture(async (fixture) => {
    const workflowPath = path.join(fixture, ".github", "workflows", "ci.yml")
    const workflow = await readFile(workflowPath, "utf8")
    await writeFile(workflowPath, workflow.replace("name: Root Hygiene", "name: Repository Hygiene"))
    const failures = await validateBranchProtectionContract(fixture)
    assert(failures.some((failure) => failure.includes("policy is missing Repository Hygiene")))
    assert(failures.some((failure) => failure.includes("policy references missing workflow check Root Hygiene")))
  })
})

test("rejects weakened settings, undocumented checks and missing CODEOWNERS coverage", async () => {
  await withRepositoryFixture(async (fixture) => {
    const policyPath = path.join(fixture, "scripts", "branch-protection-policy.json")
    const policy = JSON.parse(await readFile(policyPath, "utf8"))
    policy.allowForcePushes = true
    await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`)
    const ownersPath = path.join(fixture, ".github", "CODEOWNERS")
    await writeFile(ownersPath, (await readFile(ownersPath, "utf8")).replace(/^\/scripts\/backup\/.*(?:\r?\n)?/m, ""))
    const docsPath = path.join(fixture, "docs", "operations", "protected-areas-and-branch-protection.md")
    await writeFile(docsPath, (await readFile(docsPath, "utf8")).replace("`Web`", "Web"))
    const failures = await validateBranchProtectionContract(fixture)
    assert(failures.some((failure) => failure.includes("force pushes must be prohibited")))
    assert(failures.some((failure) => failure.includes("missing explicit sensitive-path coverage for /scripts/backup/")))
    assert(failures.some((failure) => failure.includes("required check is not documented: Web")))
  })
})
