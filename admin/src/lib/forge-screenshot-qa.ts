export const FORGE_SCREENSHOT_QA_VERSION = "1.0.0"
export const FORGE_SCREENSHOT_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
} as const

export type ForgeVisualFindingCategory = "overflow" | "clipped_content" | "weak_visual_hierarchy" | "low_contrast" | "unreadable_typography" | "broken_responsive_layout" | "inconsistent_cards" | "accidental_whitespace" | "poor_image_crop" | "weak_cta" | "header_navigation" | "footer" | "repetitive_sections" | "generic_template" | "animation_hiding_content" | "layout_shift"
export interface ForgeScreenshotRecord extends Record<string, JsonValue> { id: string; route: string; section: string; viewport: keyof typeof FORGE_SCREENSHOT_VIEWPORTS; width: number; height: number; relativePath: string; sha256: string; capturedAt: string }
export interface ForgeLayoutSignal extends Record<string, JsonValue> { route: string; viewport: string; documentWidth: number; viewportWidth: number; hiddenTextCount: number; clippedCount: number; lowContrastCount: number; smallTextCount: number; weakCtaCount: number; missingHeader: boolean; missingFooter: boolean; layoutShift: number; animatedHiddenCount: number }
export interface ForgeScreenshotFinding extends Record<string, JsonValue> { severity: "info" | "warning" | "error"; category: ForgeVisualFindingCategory; evidence: string[]; routes: string[]; screenshotIds: string[]; recommendedCorrection: string; confidence: number; advisory: true; approvalRequired: true; blocking: false }
export interface ForgeProposedVisualRepair extends Record<string, JsonValue> { id: string; findingCategories: ForgeVisualFindingCategory[]; title: string; instructions: string; status: "proposed"; approvalRequired: true; deployAutomatically: false }

export function evaluateDeterministicVisualSignals(signals: ForgeLayoutSignal[], screenshots: ForgeScreenshotRecord[]): ForgeScreenshotFinding[] {
  const findings: ForgeScreenshotFinding[] = []
  const add = (signal: ForgeLayoutSignal, category: ForgeVisualFindingCategory, evidence: string, correction: string, confidence = .95) => findings.push({ severity: category === "overflow" || category === "broken_responsive_layout" ? "error" : "warning", category, evidence: [evidence], routes: [signal.route], screenshotIds: screenshots.filter((s) => s.route === signal.route && s.viewport === signal.viewport).map((s) => s.id), recommendedCorrection: correction, confidence, advisory: true, approvalRequired: true, blocking: false })
  for (const signal of signals) {
    if (signal.documentWidth > signal.viewportWidth + 2) add(signal, "overflow", `Document width ${signal.documentWidth}px exceeds ${signal.viewportWidth}px viewport.`, "Constrain the overflowing element and verify responsive wrapping.")
    if (signal.clippedCount) add(signal, "clipped_content", `${signal.clippedCount} visible element(s) are clipped.`, "Remove fixed-height clipping or provide an intentional accessible overflow treatment.")
    if (signal.lowContrastCount) add(signal, "low_contrast", `${signal.lowContrastCount} text element(s) fail the deterministic contrast threshold.`, "Use approved brand colours with WCAG-compliant text contrast.")
    if (signal.smallTextCount) add(signal, "unreadable_typography", `${signal.smallTextCount} text element(s) render below 12px.`, "Increase body and control typography while preserving the approved type scale.")
    if (signal.weakCtaCount) add(signal, "weak_cta", `${signal.weakCtaCount} CTA candidate(s) are hidden, too small, or visually weak.`, "Strengthen CTA visibility and tap targets without changing approved wording.")
    if (signal.missingHeader) add(signal, "header_navigation", "No visible header or navigation landmark was found.", "Restore a responsive, keyboard-accessible navigation landmark.")
    if (signal.missingFooter) add(signal, "footer", "No visible footer landmark was found.", "Add the approved footer content and required policy links.")
    if (signal.layoutShift > .1) add(signal, "layout_shift", `Measured cumulative layout shift was ${signal.layoutShift.toFixed(3)}.`, "Reserve media/component dimensions and remove late layout movement.")
    if (signal.animatedHiddenCount) add(signal, "animation_hiding_content", `${signal.animatedHiddenCount} content element(s) remain hidden after animations settle.`, "Ensure content becomes visible and provide a reduced-motion fallback.")
  }
  return findings
}

export function proposeVisualRepairTasks(findings: ForgeScreenshotFinding[]): ForgeProposedVisualRepair[] {
  return findings.map((finding, index) => ({ id: `visual-repair-${index + 1}`, findingCategories: [finding.category], title: `Review ${finding.category.replaceAll("_", " ")}`, instructions: `${finding.recommendedCorrection} Re-render the affected routes and compare against the recorded screenshot IDs. Do not change approved client facts.`, status: "proposed", approvalRequired: true, deployAutomatically: false }))
}

export function compareVisualRuns(before: ForgeLayoutSignal[], after: ForgeLayoutSignal[]) { const metric = (s: ForgeLayoutSignal) => s.clippedCount + s.lowContrastCount + s.smallTextCount + s.weakCtaCount + s.animatedHiddenCount + Math.max(0, s.documentWidth - s.viewportWidth); const beforeScore = before.reduce((n, s) => n + metric(s), 0); const afterScore = after.reduce((n, s) => n + metric(s), 0); return { beforeScore, afterScore, delta: afterScore - beforeScore, outcome: afterScore < beforeScore ? "improved" : afterScore > beforeScore ? "regressed" : "unchanged" } as const }
import type { JsonValue } from "./forge-ai"
