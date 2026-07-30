import { describe, expect, it } from "vitest"
import {
  buildForgeVisualCritiqueApprovalRecord,
  buildForgeVisualCritiqueReport,
  type ForgeVisualCritiqueDraft,
} from "./forge-visual-critique"
import {
  buildResendFormQaResult,
  buildWhatsAppLinkQaResult,
  prepareForgeRepairPatches,
} from "./forge-qa"
import { FORGE_RUN_STAGE_REGISTRY, getForgeRunStage } from "./forge-run-stages"
import { defaultForgeWhatsAppConfig } from "./forge-whatsapp"

const passingDraft: ForgeVisualCritiqueDraft = {
  overallScore: 86,
  scores: {
    brandFit: 86,
    visualQuality: 86,
    ctaRelevance: 86,
    contentSpecificity: 86,
    seoAeoQuality: 86,
    accessibility: 86,
    mobileReadiness: 86,
    clientReadiness: 86,
  },
  strengths: ["Clear hierarchy"],
  weaknesses: [],
  recommendations: [],
  summary: "The draft passes the visual policy threshold.",
}

describe("atomic Forge build and QA governance", () => {
  it("rejects a failing critique without a named override policy", () => {
    const report = buildForgeVisualCritiqueReport({
      data: { ...passingDraft, overallScore: 62, scores: { ...passingDraft.scores, visualQuality: 62 } },
    })
    expect(() => buildForgeVisualCritiqueApprovalRecord({
      report,
      actor: "operator@example.com",
      reason: "Client accepts the documented visual trade-off.",
      relevantArtifacts: [21],
    })).toThrow("override policy")
  })

  it("records explicit approval evidence for a passing critique", () => {
    const report = buildForgeVisualCritiqueReport({ data: passingDraft })
    expect(buildForgeVisualCritiqueApprovalRecord({
      report,
      actor: "operator@example.com",
      reason: "Reviewed against the approved premium design direction.",
      relevantArtifacts: [21, 22],
      now: "2026-07-30T12:00:00.000Z",
    })).toEqual(expect.objectContaining({
      actor: "operator@example.com",
      previousQualityState: "validated",
      resultingQualityState: "validated",
      relevantArtifacts: [21, 22],
      overridePolicy: null,
    }))
  })

  it("records an explicit policy override without erasing failed findings", () => {
    const report = buildForgeVisualCritiqueReport({
      data: { ...passingDraft, scores: { ...passingDraft.scores, mobileReadiness: 69 } },
    })
    const approval = buildForgeVisualCritiqueApprovalRecord({
      report,
      actor: "owner@example.com",
      reason: "Launch exception approved for the time-boxed campaign.",
      relevantArtifacts: [21],
      overridePolicy: "owner-launch-exception-v1",
    })
    expect(approval.overridePolicy).toBe("owner-launch-exception-v1")
    expect(approval.downstreamImpact).toContain("original critique findings remain auditable")
    expect(report.status).toBe("draft")
  })

  it("prepares the smallest safe repair and retains pre-repair versions", () => {
    const prepared = prepareForgeRepairPatches([
      { path: "src/components/Hero.tsx", content: "export function Hero(){return <h1>Fixed</h1>}", reason: "Repair the invalid JSX." },
      { path: "src/app/page.tsx", content: "unchanged", reason: "No effective change." },
    ], [
      { path: "src/components/Hero.tsx", content: "export function Hero(){return <h1>Broken</h1>}" },
      { path: "src/app/page.tsx", content: "unchanged" },
    ])
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.patches.map((patch) => patch.path)).toEqual(["src/components/Hero.tsx"])
    expect(prepared.preRepairVersions[0].content).toContain("Broken")
    expect(prepared.affectedChecks).toEqual(expect.arrayContaining(["typecheck", "build", "mobile_responsive"]))
  })

  it("stops repair when proposed replacements make no progress", () => {
    expect(prepareForgeRepairPatches([
      { path: "src/app/page.tsx", content: "unchanged", reason: "Provider repeated the file." },
    ], [{ path: "src/app/page.tsx", content: "unchanged" }])).toEqual(expect.objectContaining({ ok: false, error: expect.stringContaining("no progress") }))
  })

  it("rejects absolute, traversal and ScaleSmiths core repair paths", () => {
    for (const path of ["/var/www/scalesmiths/ScaleSmiths/admin/page.tsx", "../admin/src/app/page.tsx", "admin/src/app/page.tsx"]) {
      expect(prepareForgeRepairPatches([{ path, content: "unsafe", reason: "Unsafe target." }], [])).toEqual(expect.objectContaining({ ok: false }))
    }
  })

  it("skips integration checks explicitly when integrations are irrelevant", () => {
    expect(buildResendFormQaResult({ contactRoute: false, config: false, validation: false, template: false }, false)).toMatchObject({ status: "skipped", skippedReason: "Resend integration is disabled." })
    expect(buildWhatsAppLinkQaResult({ config: false, cta: false, sticky: false }, defaultForgeWhatsAppConfig())).toMatchObject({ status: "skipped", skippedReason: "WhatsApp integration is disabled." })
  })

  it("defines every build and QA concern as an atomic stage/job", () => {
    const expected = {
      code_generation: "generate_site",
      seo_schema: "seo",
      accessibility: "accessibility_gate",
      consistency_review: "consistency_review",
      copy_quality_review: "copy_quality_review",
      originality_review: "originality_review",
      visual_critique: "visual_critique",
      functional_qa: "qa",
      repair: "repair",
      visual_qa: "visual_qa",
      preview: "preview_start",
    }
    for (const [stage, job] of Object.entries(expected)) expect(getForgeRunStage(stage)?.jobMapping?.kind).toBe(job)
    expect(FORGE_RUN_STAGE_REGISTRY.find((stage) => stage.key === "quality_review")?.optionalWhen({} as never)).toContain("atomic")
  })

  it("keeps successful upstream stages outside an atomic retry scope", () => {
    expect(getForgeRunStage("functional_qa")?.invalidatedDownstreamStages).toEqual(["repair", "visual_qa", "preview", "client_review", "deploy_readiness"])
    expect(getForgeRunStage("functional_qa")?.invalidatedDownstreamStages).not.toContain("code_generation")
    expect(getForgeRunStage("functional_qa")?.estimatedCostUsd).toBeLessThan(getForgeRunStage("code_generation")!.estimatedCostUsd)
  })
})
