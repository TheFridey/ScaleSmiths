import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { buildForgeDependencyEvidence, hashCanonicalJson, verifyForgeDependencyEvidence } from "./forge-dependency-admission"
import { ACTIVE_FORGE_DEPENDENCY_POLICY_VERSION, FORGE_DEPENDENCY_POLICY_REGISTRY, getActiveForgeDependencyPolicy } from "./forge-dependency-policy"

const fixtureRoot = join(process.cwd(), "test", "fixtures", "dependency-admission")
const textFixture = (name: string) => readFileSync(join(fixtureRoot, name), "utf8")
const jsonFixture = (name: string) => JSON.parse(textFixture(name)) as unknown
const capturedAt = "2026-07-14T12:00:00.000Z"
const workspaceHash = "a".repeat(64)

function safeEvidence() {
  return buildForgeDependencyEvidence({ packageJson: textFixture("safe-package.json"), packageLock: textFixture("safe-package-lock.json"), auditReport: jsonFixture("safe-audit.json"), workspaceHash, evidenceTimestamp: capturedAt })
}

describe("generated-site dependency admission", () => {
  it("admits a reviewed exact lock graph and emits candidate-bound SPDX JSON", () => {
    const evidence = safeEvidence()
    expect(evidence.report).toMatchObject({ status: "passed", policyVersion: ACTIVE_FORGE_DEPENDENCY_POLICY_VERSION, packageCount: 3, blockedCount: 0 })
    expect(evidence.sbom).toMatchObject({ spdxVersion: "SPDX-2.3", dataLicense: "CC0-1.0" })
    expect(evidence.sbomHash).toHaveLength(64)
    expect(verifyForgeDependencyEvidence({ ...evidence, packageJson: textFixture("safe-package.json"), packageLock: textFixture("safe-package-lock.json"), workspaceHash, now: new Date("2026-07-14T13:00:00.000Z") }).valid).toBe(true)
  })

  it("blocks unapproved packages and disallowed licences", () => {
    const blocked = buildForgeDependencyEvidence({ packageJson: textFixture("blocked-package.json"), packageLock: textFixture("blocked-package-lock.json"), auditReport: jsonFixture("safe-audit.json"), workspaceHash, evidenceTimestamp: capturedAt })
    const licence = buildForgeDependencyEvidence({ packageJson: textFixture("safe-package.json"), packageLock: textFixture("licence-failure-lock.json"), auditReport: jsonFixture("safe-audit.json"), workspaceHash, evidenceTimestamp: capturedAt })
    expect(blocked.report.status).toBe("failed")
    expect(blocked.report.blockingReasons.join(" ")).toMatch(/allowlist|Licence/)
    expect(licence.report.blockingReasons.join(" ")).toContain("denylist")
  })

  it("blocks High vulnerability evidence and audit failures", () => {
    const vulnerable = buildForgeDependencyEvidence({ packageJson: textFixture("safe-package.json"), packageLock: textFixture("safe-package-lock.json"), auditReport: jsonFixture("vulnerable-audit.json"), workspaceHash, evidenceTimestamp: capturedAt })
    const unavailable = buildForgeDependencyEvidence({ packageJson: textFixture("safe-package.json"), packageLock: textFixture("safe-package-lock.json"), auditReport: { error: { summary: "registry unavailable" } }, workspaceHash, evidenceTimestamp: capturedAt })
    expect(vulnerable.report.blockingReasons.join(" ")).toContain("high known vulnerability")
    expect(unavailable.report).toMatchObject({ status: "failed", auditStatus: "failed" })
  })

  it("invalidates evidence when the lockfile or workspace changes", () => {
    const evidence = safeEvidence()
    const mutated = verifyForgeDependencyEvidence({ ...evidence, packageJson: textFixture("safe-package.json"), packageLock: textFixture("mutated-lock.json"), workspaceHash, storedLockfileHash: "b".repeat(64), now: new Date("2026-07-14T13:00:00.000Z") })
    const stale = jsonFixture("stale-sbom-evidence.json") as { workspaceHash: string }
    const reused = verifyForgeDependencyEvidence({ ...evidence, packageJson: textFixture("safe-package.json"), packageLock: textFixture("safe-package-lock.json"), workspaceHash: stale.workspaceHash, now: new Date("2026-07-14T13:00:00.000Z") })
    expect(mutated.errors).toContain("Generated package-lock.json changed after dependency admission.")
    expect(mutated.errors).toContain("Candidate lockfile hash does not match the dependency report.")
    expect(reused.errors).toContain("Dependency evidence is bound to a different workspace hash.")
  })

  it("invalidates altered or stale SBOM evidence even when a caller supplies a matching replacement hash", () => {
    const evidence = safeEvidence()
    const sbom = structuredClone(evidence.sbom)
    ;(sbom.creationInfo as Record<string, unknown>).comment = "stale unrelated evidence"
    const result = verifyForgeDependencyEvidence({ ...evidence, sbom, sbomHash: hashCanonicalJson(sbom), packageJson: textFixture("safe-package.json"), packageLock: textFixture("safe-package-lock.json"), workspaceHash, now: new Date("2026-07-15T13:00:01.000Z") })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("report and generated-site SBOM"), expect.stringContaining("not bound"), expect.stringContaining("24-hour")]))
  })

  it("keeps historical policy versions explicit and rejects unknown direct ranges and sources", () => {
    expect(Object.keys(FORGE_DEPENDENCY_POLICY_REGISTRY)).toEqual(["2026-07-14.1"])
    expect(getActiveForgeDependencyPolicy().status).toBe("active")
    const manifest = textFixture("safe-package.json").replace('"18.3.1"', '"file:../react"')
    const lock = textFixture("safe-package-lock.json").replaceAll('"18.3.1"', '"file:../react"').replace("https://registry.npmjs.org/react/-/react-18.3.1.tgz", "file:../react")
    const evidence = buildForgeDependencyEvidence({ packageJson: manifest, packageLock: lock, auditReport: jsonFixture("safe-audit.json"), workspaceHash, evidenceTimestamp: capturedAt })
    expect(evidence.report.blockingReasons.join(" ")).toMatch(/prohibited|approved manifest range/)
  })

  it("blocks unreviewed lifecycle/native packages and warns when package review is stale", () => {
    const lock = JSON.parse(textFixture("safe-package-lock.json")) as { packages: Record<string, Record<string, unknown>> }
    lock.packages["node_modules/react"].hasInstallScript = true
    lock.packages["node_modules/react"].cpu = ["x64"]
    const blocked = buildForgeDependencyEvidence({ packageJson: textFixture("safe-package.json"), packageLock: JSON.stringify(lock), auditReport: jsonFixture("safe-audit.json"), workspaceHash, evidenceTimestamp: capturedAt })
    expect(blocked.report.blockingReasons.join(" ")).toMatch(/Native|lifecycle/)

    const policy = structuredClone(getActiveForgeDependencyPolicy())
    policy.maximumReviewAgeDays = 1
    policy.approvedPackages.react.reviewedAt = "2026-07-01T00:00:00.000Z"
    const staleReview = buildForgeDependencyEvidence({ packageJson: textFixture("safe-package.json"), packageLock: textFixture("safe-package-lock.json"), auditReport: jsonFixture("safe-audit.json"), workspaceHash, evidenceTimestamp: capturedAt, policy })
    expect(staleReview.report.status).toBe("passed")
    expect(staleReview.report.warnings.join(" ")).toContain("Package review is older than 1 days")
  })

  it("does not inherit trust for an arbitrary transitive added to an approved dependency graph", () => {
    const lock = JSON.parse(textFixture("safe-package-lock.json")) as { packages: Record<string, Record<string, unknown>> }
    ;(lock.packages["node_modules/react"].dependencies as Record<string, string>)["arbitrary-transitive"] = "1.0.0"
    lock.packages["node_modules/arbitrary-transitive"] = { version: "1.0.0", resolved: "https://registry.npmjs.org/arbitrary-transitive/-/arbitrary-transitive-1.0.0.tgz", integrity: "sha512-YXJiaXRyYXJ5", license: "MIT" }
    const evidence = buildForgeDependencyEvidence({ packageJson: textFixture("safe-package.json"), packageLock: JSON.stringify(lock), auditReport: jsonFixture("safe-audit.json"), workspaceHash, evidenceTimestamp: capturedAt })
    expect(evidence.report.status).toBe("failed")
    expect(evidence.report.blockingReasons.join(" ")).toContain("reviewed lock-graph allowlist")
  })
})
