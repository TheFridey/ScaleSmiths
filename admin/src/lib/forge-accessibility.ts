import type { JsonValue } from "./forge-ai"

export const FORGE_ACCESSIBILITY_ARTIFACT_TITLE = "Accessibility Gate"
export const FORGE_ACCESSIBILITY_ARTIFACT_KIND = "forge_accessibility_report_v1"

export type ForgeAccessibilitySeverity = "info" | "warning" | "error" | "critical"
export type ForgeAccessibilityStatus = "passed" | "failed" | "skipped"

export interface ForgeAccessibilityFinding extends Record<string, JsonValue> {
  severity: ForgeAccessibilitySeverity
  wcag: string | null
  page: string
  selector: string | null
  element: string | null
  evidence: string
  recommendedCorrection: string
  automaticFixEligible: boolean
  blocking: boolean
}

export interface ForgeAccessibilitySnapshot extends Record<string, JsonValue> {
  page: string
  title: string
  language: string | null
  landmarks: Record<string, number>
  headings: Array<{ level: number; text: string; selector: string }>
  focusable: Array<{ selector: string; text: string; hasVisibleFocus: boolean; width: number; height: number }>
  forms: Array<{ selector: string; label: string | null; required: boolean; hasErrorMessage: boolean }>
  images: Array<{ selector: string; alt: string | null; decorative: boolean }>
  links: Array<{ selector: string; text: string; href: string | null }>
  buttons: Array<{ selector: string; text: string; width: number; height: number }>
  modals: Array<{ selector: string; role: string | null; labelled: boolean; modal: boolean; closeButton: boolean }>
  mobileMenus: Array<{ selector: string; labelled: boolean; expanded: string | null; controls: string | null }>
  ariaMisuse: Array<{ selector: string; issue: string }>
  skipLinks: Array<{ selector: string; href: string | null; visibleOnFocus: boolean }>
  contrastIssues: Array<{ selector: string; ratio: number; text: string }>
  reducedMotionIssues: Array<{ selector: string; evidence: string }>
}

export interface ForgeAccessibilityReport extends Record<string, JsonValue> {
  kind: typeof FORGE_ACCESSIBILITY_ARTIFACT_KIND
  status: ForgeAccessibilityStatus
  evaluatedAt: string
  previewUrl: string | null
  routes: string[]
  pagesEvaluated: number
  findings: ForgeAccessibilityFinding[]
  summary: string
  criticalCount: number
  blocking: boolean
  overrideRequiredRole: "owner"
}

export function buildForgeAccessibilityReport(input: {
  previewUrl: string | null
  routes: string[]
  snapshots: ForgeAccessibilitySnapshot[]
  toolingAvailable: boolean
  unavailableReason?: string | null
  evaluatedAt?: string
}): ForgeAccessibilityReport {
  const findings = input.snapshots.flatMap(evaluateAccessibilitySnapshot)
  if (!input.toolingAvailable) {
    findings.unshift({
      severity: "critical",
      wcag: null,
      page: "/",
      selector: null,
      element: null,
      evidence: input.unavailableReason ?? "Browser accessibility tooling was unavailable.",
      recommendedCorrection: "Run the accessibility gate in an environment with Playwright/browser support before deployment.",
      automaticFixEligible: false,
      blocking: true,
    })
  }
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length
  const blocking = findings.some((finding) => finding.blocking)
  const status: ForgeAccessibilityStatus = input.toolingAvailable ? blocking ? "failed" : "passed" : "skipped"
  return {
    kind: FORGE_ACCESSIBILITY_ARTIFACT_KIND,
    status,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    previewUrl: input.previewUrl,
    routes: input.routes,
    pagesEvaluated: input.snapshots.length,
    findings: findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    summary: blocking
      ? `Accessibility gate blocked deployment with ${criticalCount} critical finding(s) and ${findings.length} total finding(s).`
      : `Accessibility gate passed across ${input.snapshots.length} page(s).`,
    criticalCount,
    blocking,
    overrideRequiredRole: "owner",
  }
}

export function evaluateAccessibilitySnapshot(snapshot: ForgeAccessibilitySnapshot): ForgeAccessibilityFinding[] {
  const findings: ForgeAccessibilityFinding[] = []
  const add = (item: Omit<ForgeAccessibilityFinding, "page">) => {
    findings.push({ ...item, page: snapshot.page } as ForgeAccessibilityFinding)
  }

  if (!snapshot.title.trim()) add(finding("critical", "2.4.2", null, null, "Document has no title.", "Add a concise, page-specific <title>.", true))
  if (!snapshot.language) add(finding("error", "3.1.1", "html", "html", "Document language is missing.", "Set the lang attribute on the html element.", true))
  if ((snapshot.landmarks.main ?? 0) !== 1) add(finding("critical", "1.3.1", "main", "main", `Expected exactly one main landmark; found ${snapshot.landmarks.main ?? 0}.`, "Render one semantic <main> landmark per page.", true))
  if ((snapshot.landmarks.nav ?? 0) < 1) add(finding("warning", "1.3.1", "nav", "nav", "No navigation landmark was found.", "Wrap primary navigation in <nav> or expose an equivalent navigation landmark.", false))

  const headings = snapshot.headings
  if (!headings.some((heading) => heading.level === 1)) add(finding("critical", "1.3.1", "h1", "h1", "No h1 heading was found.", "Add one descriptive h1 that identifies the page purpose.", true))
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index].level > headings[index - 1].level + 1) add(finding("error", "1.3.1", headings[index].selector, `h${headings[index].level}`, `Heading jumps from h${headings[index - 1].level} to h${headings[index].level}.`, "Do not skip heading levels; preserve a logical outline.", true))
  }

  for (const item of snapshot.focusable) {
    if (!item.hasVisibleFocus) add(finding("critical", "2.4.7", item.selector, "focusable", `Focusable element "${item.text || item.selector}" lacks a visible focus indicator.`, "Add a visible :focus-visible style with sufficient contrast.", true))
    if (item.width < 24 || item.height < 24) add(finding("error", "2.5.8", item.selector, "interactive", `Interactive target is ${Math.round(item.width)}x${Math.round(item.height)}px.`, "Increase the target to at least 24x24px, with 44x44px preferred for touch controls.", true))
  }

  for (const field of snapshot.forms) {
    if (!field.label) add(finding("critical", "3.3.2", field.selector, "form field", "Form control has no accessible label.", "Associate a visible label, aria-label, or aria-labelledby with the control.", true))
    if (field.required && !field.hasErrorMessage) add(finding("error", "3.3.1", field.selector, "form field", "Required form control has no detectable error-message relationship.", "Use aria-describedby or aria-errormessage to connect validation text to the field.", false))
  }

  for (const image of snapshot.images) {
    if (!image.decorative && image.alt === null) add(finding("error", "1.1.1", image.selector, "img", "Informative image has no alt text.", "Add meaningful alt text, or mark decorative images with empty alt text.", true))
  }

  for (const link of snapshot.links) {
    if (!link.text || /^(click here|read more|learn more|more)$/i.test(link.text.trim())) add(finding("warning", "2.4.4", link.selector, "a", `Link purpose is unclear from text "${link.text}".`, "Make link text describe the destination or action.", true))
  }

  for (const issue of snapshot.contrastIssues) add(finding("critical", "1.4.3", issue.selector, "text", `Text contrast ratio ${issue.ratio.toFixed(2)} for "${issue.text.slice(0, 80)}".`, "Adjust foreground/background colours to meet WCAG contrast for the text size.", false))
  for (const issue of snapshot.reducedMotionIssues) add(finding("warning", "2.3.3", issue.selector, "animated element", issue.evidence, "Respect prefers-reduced-motion and provide non-motion alternatives.", false))

  for (const modal of snapshot.modals) {
    if (!modal.labelled || !modal.modal || !modal.closeButton) add(finding("critical", "4.1.2", modal.selector, "dialog", "Modal is missing accessible name, aria-modal, or a close button.", "Use role=dialog, aria-modal=true, an accessible label, focus trapping, and a keyboard-operable close control.", false))
  }
  for (const menu of snapshot.mobileMenus) {
    if (!menu.labelled || !menu.controls || (menu.expanded !== "true" && menu.expanded !== "false")) add(finding("error", "4.1.2", menu.selector, "mobile menu button", "Mobile-menu trigger lacks accessible label, aria-controls, or aria-expanded state.", "Expose menu state and controlled panel with aria-expanded and aria-controls.", true))
  }
  for (const issue of snapshot.ariaMisuse) add(finding("error", "4.1.2", issue.selector, "aria", issue.issue, "Remove invalid ARIA or replace it with valid semantic HTML/ARIA.", false))
  if (!snapshot.skipLinks.some((link) => link.href?.startsWith("#") && link.visibleOnFocus)) add(finding("warning", "2.4.1", "a[href^='#']", "skip link", "No keyboard-visible skip link was found.", "Add a skip link that becomes visible on focus and targets the main content.", true))

  return findings
}

export function buildForgeAccessibilityArtifactContent(report: ForgeAccessibilityReport) {
  return [
    "# Accessibility Gate",
    "",
    `Status: ${report.status}`,
    `Blocking: ${report.blocking ? "yes" : "no"}`,
    `Pages evaluated: ${report.pagesEvaluated}`,
    `Completed: ${report.evaluatedAt}`,
    "",
    "## Findings",
    ...(report.findings.length ? report.findings.map((finding) => [
      `- ${finding.severity.toUpperCase()}${finding.wcag ? ` WCAG ${finding.wcag}` : ""} on ${finding.page}${finding.selector ? ` (${finding.selector})` : ""}`,
      `  Evidence: ${finding.evidence}`,
      `  Correction: ${finding.recommendedCorrection}`,
      `  Blocking: ${finding.blocking ? "yes" : "no"}; auto-fix eligible: ${finding.automaticFixEligible ? "yes" : "no"}`,
    ].join("\n")) : ["- No findings."]),
  ].join("\n").trim()
}

function finding(severity: ForgeAccessibilitySeverity, wcag: string | null, selector: string | null, element: string | null, evidence: string, recommendedCorrection: string, automaticFixEligible: boolean): Omit<ForgeAccessibilityFinding, "page"> {
  return { severity, wcag, selector, element, evidence, recommendedCorrection, automaticFixEligible, blocking: severity === "critical" }
}

function severityRank(severity: ForgeAccessibilitySeverity) {
  return ({ info: 0, warning: 1, error: 2, critical: 3 })[severity]
}

export function readForgeAccessibilityArtifact(metadata: Record<string, unknown> | null | undefined): ForgeAccessibilityReport | null {
  if (!metadata || metadata.kind !== FORGE_ACCESSIBILITY_ARTIFACT_KIND || typeof metadata.report !== "object" || metadata.report === null) return null
  return (metadata.report as { kind?: unknown }).kind === FORGE_ACCESSIBILITY_ARTIFACT_KIND ? metadata.report as ForgeAccessibilityReport : null
}
