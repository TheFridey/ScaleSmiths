import { describe, expect, it } from "vitest"
import {
  FORGE_DEPLOY_ARTIFACT_KIND,
  FORGE_DEPLOY_METHODS,
  buildForgeDeployChecklist,
  buildForgeDeploymentNotesContent,
  buildForgeDeploymentPlan,
  defaultForgeDeployConfirmations,
  evaluateForgeDeployReadiness,
  isForgeDeployMethod,
  parseForgeDeployConfirmations,
  readForgeDeploymentArtifact,
  type ForgeDeployConfirmations,
  type ForgeDeployContext,
  type ForgeDeploySignals,
  type ForgeDeploymentNotes,
} from "./forge-deploy"

const ctx: ForgeDeployContext = {
  businessName: "Acme Repairs",
  slug: "42-acme-repairs",
  workspacePath: "generated-sites/42-acme-repairs",
  exportZipName: "acme-repairs-site-2026-06-21.zip",
}

function signals(overrides: Partial<ForgeDeploySignals> = {}): ForgeDeploySignals {
  return {
    hasGeneratedSite: true,
    qaStatus: "passed",
    lighthouseStatus: "passed",
    resendEnabled: false,
    whatsappEnabled: false,
    analyticsEnabled: false,
    ...overrides,
  }
}

function allConfirmed(): ForgeDeployConfirmations {
  return {
    domain: true,
    env_vars: true,
    resend_verified: true,
    whatsapp_confirmed: true,
    analytics_configured: true,
    sitemap_submitted: true,
    lighthouse_accepted: true,
  }
}

describe("forge deploy methods", () => {
  it("lists only non-automated V1 methods", () => {
    expect(FORGE_DEPLOY_METHODS.map((method) => method.id)).toEqual(["manual", "vps", "github"])
    expect(FORGE_DEPLOY_METHODS.every((method) => method.automated === false)).toBe(true)
    expect(isForgeDeployMethod("vps")).toBe(true)
    expect(isForgeDeployMethod("k8s")).toBe(false)
  })

  it("builds a manual plan with steps and no risky files", () => {
    const plan = buildForgeDeploymentPlan("manual", ctx)
    expect(plan.method).toBe("manual")
    expect(plan.steps.length).toBeGreaterThan(0)
    expect(plan.files).toEqual([])
    expect(plan.summary).toMatch(/export/i)
  })

  it("builds a VPS package with config files and a non-executed deploy script", () => {
    const plan = buildForgeDeploymentPlan("vps", ctx)
    const paths = plan.files.map((file) => file.path)
    expect(paths).toContain("Dockerfile")
    expect(paths).toContain("nginx.conf")
    expect(paths).toContain("forge-42-acme-repairs.service")
    expect(paths).toContain("deploy.sh")
    expect(plan.warnings.join(" ")).toMatch(/does not execute it for you/i)
  })

  it("builds a GitHub placeholder that never auto-pushes and excludes secrets", () => {
    const plan = buildForgeDeploymentPlan("github", ctx)
    const gitignore = plan.files.find((file) => file.path === ".gitignore")?.content ?? ""
    expect(gitignore).toContain(".env")
    expect(plan.summary).toMatch(/placeholder/i)
    expect(plan.warnings.join(" ")).toMatch(/does not push to client repositories automatically/i)
  })
})

describe("forge deploy checklist", () => {
  it("includes all eight required checklist items", () => {
    const checklist = buildForgeDeployChecklist(signals(), defaultForgeDeployConfirmations())
    expect(checklist.map((item) => item.key)).toEqual([
      "domain",
      "env_vars",
      "resend_verified",
      "whatsapp_confirmed",
      "analytics_configured",
      "sitemap_submitted",
      "build_passing",
      "lighthouse_accepted",
    ])
  })

  it("derives build + lighthouse from QA signals automatically", () => {
    const passing = buildForgeDeployChecklist(signals(), defaultForgeDeployConfirmations())
    expect(passing.find((item) => item.key === "build_passing")?.status).toBe("passed")
    expect(passing.find((item) => item.key === "lighthouse_accepted")?.status).toBe("passed")

    const failing = buildForgeDeployChecklist(signals({ qaStatus: "failed", lighthouseStatus: "failed" }), defaultForgeDeployConfirmations())
    expect(failing.find((item) => item.key === "build_passing")?.status).toBe("failed")
    expect(failing.find((item) => item.key === "lighthouse_accepted")?.status).toBe("failed")

    const notRun = buildForgeDeployChecklist(signals({ qaStatus: null, lighthouseStatus: null }), defaultForgeDeployConfirmations())
    expect(notRun.find((item) => item.key === "build_passing")?.status).toBe("pending")
    expect(notRun.find((item) => item.key === "lighthouse_accepted")?.status).toBe("pending")
  })

  it("skips integration items that are not enabled, requires confirmation when enabled", () => {
    const disabled = buildForgeDeployChecklist(signals(), defaultForgeDeployConfirmations())
    expect(disabled.find((item) => item.key === "resend_verified")?.status).toBe("skipped")
    expect(disabled.find((item) => item.key === "whatsapp_confirmed")?.status).toBe("skipped")

    const enabled = buildForgeDeployChecklist(signals({ resendEnabled: true, whatsappEnabled: true }), defaultForgeDeployConfirmations())
    expect(enabled.find((item) => item.key === "resend_verified")?.status).toBe("pending")
    expect(enabled.find((item) => item.key === "whatsapp_confirmed")?.status).toBe("pending")
  })

  it("is ready only when no items are failed or pending", () => {
    const incomplete = buildForgeDeployChecklist(signals(), defaultForgeDeployConfirmations())
    const incompleteReadiness = evaluateForgeDeployReadiness(incomplete)
    expect(incompleteReadiness.ready).toBe(false)
    expect(incompleteReadiness.pending).toContain("Domain configured")

    const complete = buildForgeDeployChecklist(signals({ resendEnabled: true, whatsappEnabled: true, analyticsEnabled: true }), allConfirmed())
    expect(evaluateForgeDeployReadiness(complete).ready).toBe(true)

    const buildBroken = buildForgeDeployChecklist(signals({ qaStatus: "failed" }), allConfirmed())
    const brokenReadiness = evaluateForgeDeployReadiness(buildBroken)
    expect(brokenReadiness.ready).toBe(false)
    expect(brokenReadiness.failed).toContain("Build passing")
  })

  it("parses confirmations defensively", () => {
    expect(parseForgeDeployConfirmations(null)).toEqual(defaultForgeDeployConfirmations())
    expect(parseForgeDeployConfirmations({ domain: true, bogus: 1 }).domain).toBe(true)
    expect(parseForgeDeployConfirmations({ domain: "yes" }).domain).toBe(false)
  })
})

describe("forge deploy notes artifact", () => {
  function notes(lifecycle: ForgeDeploymentNotes["lifecycle"]): ForgeDeploymentNotes {
    const confirmations = allConfirmed()
    const sig = signals({ resendEnabled: true, whatsappEnabled: true, analyticsEnabled: true })
    const checklist = buildForgeDeployChecklist(sig, confirmations)
    return {
      kind: FORGE_DEPLOY_ARTIFACT_KIND,
      method: "vps",
      lifecycle,
      plan: buildForgeDeploymentPlan("vps", ctx),
      checklist,
      confirmations,
      readiness: evaluateForgeDeployReadiness(checklist),
      readyAt: lifecycle === "draft" ? null : "2026-06-21T10:00:00.000Z",
      deployedAt: lifecycle === "deployed" ? "2026-06-21T11:00:00.000Z" : null,
      generatedAt: "2026-06-21T09:00:00.000Z",
    }
  }

  it("renders deployment notes markdown with checklist and generated files", () => {
    const content = buildForgeDeploymentNotesContent(notes("ready"))
    expect(content).toContain("# Deployment Notes")
    expect(content).toContain("## Deployment checklist")
    expect(content).toContain("Dockerfile")
    expect(content).toContain("ready to deploy")
  })

  it("reads the artifact state and lifecycle back", () => {
    const state = readForgeDeploymentArtifact({ kind: FORGE_DEPLOY_ARTIFACT_KIND, notes: notes("deployed") })
    expect(state.notes?.method).toBe("vps")
    expect(state.lifecycle).toBe("deployed")
    expect(state.ready).toBe(true)
    expect(readForgeDeploymentArtifact(null).lifecycle).toBe("draft")
    expect(readForgeDeploymentArtifact(null).notes).toBeNull()
    expect(readForgeDeploymentArtifact({ kind: "other" }).notes).toBeNull()
  })
})
