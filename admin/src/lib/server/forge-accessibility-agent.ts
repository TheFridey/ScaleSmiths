import "server-only"
import { existsSync } from "node:fs"
import path from "node:path"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  buildForgeAccessibilityArtifactContent,
  buildForgeAccessibilityReport,
  FORGE_ACCESSIBILITY_ARTIFACT_KIND,
  FORGE_ACCESSIBILITY_ARTIFACT_TITLE,
  type ForgeAccessibilitySnapshot,
} from "@/lib/forge-accessibility"
import { FORGE_GENERATED_CODE_ARTIFACT_TITLE, readForgeGeneratedCodeArtifact } from "@/lib/forge-frontend-code"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"
import { startForgePreview, stopForgePreview } from "./forge-preview"

export class ForgeAccessibilityAgentError extends Error {
  safeMessage: string
  status: number
  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeAccessibilityAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

interface PlaywrightModule { chromium: { launch(options?: Record<string, unknown>): Promise<PlaywrightBrowser> } }
interface PlaywrightBrowser { newContext(options?: Record<string, unknown>): Promise<PlaywrightContext>; close(): Promise<void> }
interface PlaywrightContext { newPage(): Promise<PlaywrightPage>; close(): Promise<void> }
interface PlaywrightPage {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>
  emulateMedia(options?: Record<string, unknown>): Promise<void>
  evaluate<T>(expression: string): Promise<T>
}

export async function runForgeAccessibilityAgent(projectId: number, actor: string) {
  const { project, workspace, hasGeneratedCode, routes } = await loadAccessibilityContext(projectId)
  if (project.status === "archived") throw new ForgeAccessibilityAgentError("Archived Forge projects cannot run accessibility checks.", 400)
  if (!workspace) throw new ForgeAccessibilityAgentError("Create a generated-site workspace before running accessibility checks.", 400)
  if (!hasGeneratedCode) throw new ForgeAccessibilityAgentError("Generate site code before running accessibility checks.", 400)

  const now = new Date()
  const registry = getForgeAgentRegistryReference("accessibility_gate")
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeTasks).values({
      projectId,
      title: "Run accessibility quality gate",
      description: "Evaluate generated-site accessibility with browser DOM checks, semantic validation, keyboard/focus checks, reduced-motion checks, and deployment blocking for critical failures.",
      agentType: "qa",
      status: "running",
      inputJson: { projectId, routes },
      promptIdentifier: registry.promptIdentifier,
      promptVersion: registry.promptVersion,
      schemaIdentifier: registry.schemaIdentifier,
      schemaVersion: registry.schemaVersion,
      startedAt: now,
      updatedAt: now,
    }).returning()
    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "accessibility_gate_running",
      message: `Running accessibility gate for ${project.name}.`,
      metadataJson: { taskId: created.id, routes },
    })
    return [created]
  })

  let previewUrl: string | null = null
  let report = buildForgeAccessibilityReport({ previewUrl: null, routes, snapshots: [], toolingAvailable: false, unavailableReason: "Playwright is not installed in the admin app." })
  try {
    const playwright = await loadPlaywright()
    if (playwright) {
      const preview = await startForgePreview(projectId, actor)
      if (!preview.url) throw new ForgeAccessibilityAgentError("Approved preview did not provide a URL.", 500)
      previewUrl = preview.url
      try {
        const snapshots = await collectAccessibilitySnapshots(playwright, preview.url, routes)
        report = buildForgeAccessibilityReport({ previewUrl, routes, snapshots, toolingAvailable: true })
      } finally {
        await stopForgePreview(projectId, actor)
      }
    }

    const completedAt = new Date()
    const artifact = await saveAccessibilityReport(projectId, task.id, actor, report, completedAt)
    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "completed",
        resultQuality: report.blocking ? "degraded" : "validated",
        validationResult: { valid: !report.blocking, findingCount: report.findings.length, criticalCount: report.criticalCount },
        downstreamAllowed: true,
        humanApprovalRequired: report.blocking,
        publicationBlocked: report.blocking,
        outputJson: { status: report.status, blocking: report.blocking, findingCount: report.findings.length, criticalCount: report.criticalCount },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))
      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: report.blocking ? "accessibility_gate_blocked" : "accessibility_gate_passed",
        message: report.summary,
        metadataJson: { taskId: task.id, artifactId: artifact.id, status: report.status, criticalCount: report.criticalCount },
      })
    })
    return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeAccessibilityAgentError ? error.safeMessage : "Accessibility gate failed to run."
    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "failed",
        resultQuality: "failed",
        error: safeMessage,
        outputJson: { error: safeMessage, previewUrl },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))
      await tx.insert(forgeActivityLogs).values({ projectId, actor, action: "accessibility_gate_failed", message: safeMessage, metadataJson: { taskId: task.id } })
    })
    if (error instanceof ForgeAccessibilityAgentError) throw error
    throw new ForgeAccessibilityAgentError("Accessibility gate failed to run.", 500)
  }
}

async function collectAccessibilitySnapshots(playwright: PlaywrightModule, baseUrl: string, routes: string[]) {
  const browser = await playwright.chromium.launch({ args: ["--no-sandbox"] })
  const snapshots: ForgeAccessibilitySnapshot[] = []
  try {
    const criticalRoutes = [...new Set(["/", ...routes])].slice(0, 12)
    for (const route of criticalRoutes) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" })
      try {
        const page = await context.newPage()
        await page.emulateMedia({ reducedMotion: "reduce" })
        await page.goto(joinUrl(baseUrl, route), { waitUntil: "domcontentloaded", timeout: 30_000 })
        snapshots.push(await page.evaluate<ForgeAccessibilitySnapshot>(snapshotScript(route)))
      } finally {
        await context.close().catch(() => undefined)
      }
    }
  } finally {
    await browser.close().catch(() => undefined)
  }
  return snapshots
}

function snapshotScript(route: string) {
  return `(() => {
    const cssPath = (el) => {
      if (!el || el === document.documentElement) return "html";
      if (el.id) return "#" + CSS.escape(el.id);
      const name = el.tagName.toLowerCase();
      const parent = el.parentElement;
      if (!parent) return name;
      const same = [...parent.children].filter((x) => x.tagName === el.tagName);
      const suffix = same.length > 1 ? ":nth-of-type(" + (same.indexOf(el) + 1) + ")" : "";
      return cssPath(parent) + " > " + name + suffix;
    };
    const visible = (el) => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    const text = (el) => (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 160);
    const labelFor = (el) => {
      const id = el.id;
      const explicit = id ? document.querySelector("label[for='" + CSS.escape(id) + "']") : null;
      const implicit = el.closest("label");
      const labelledBy = el.getAttribute("aria-labelledby") ? [...document.querySelectorAll(el.getAttribute("aria-labelledby").split(/\\s+/).map((id) => "#" + CSS.escape(id)).join(","))].map(text).join(" ") : "";
      return text(explicit || implicit) || el.getAttribute("aria-label") || labelledBy || null;
    };
    const rgb = (value) => { const m = value.match(/\\d+(?:\\.\\d+)?/g); return m ? m.slice(0, 3).map(Number) : [255,255,255]; };
    const lum = (c) => { const q = c.map((x) => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126*q[0]+.7152*q[1]+.0722*q[2]; };
    const contrast = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
    const focusable = [...document.querySelectorAll("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter(visible).map((el) => {
      el.focus();
      const before = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const hasVisibleFocus = before.outlineStyle !== "none" || before.boxShadow !== "none" || before.borderColor !== getComputedStyle(document.body).borderColor;
      return { selector: cssPath(el), text: text(el), hasVisibleFocus, width: r.width, height: r.height };
    });
    const roleCount = (selector) => document.querySelectorAll(selector).length;
    const ariaMisuse = [...document.querySelectorAll("[aria-hidden='true'] a[href],[aria-hidden='true'] button,[aria-hidden='true'] input,[role='button']:not([tabindex])")].map((el) => ({ selector: cssPath(el), issue: "Interactive element is hidden from assistive tech or custom button lacks keyboard focus." }));
    return {
      page: ${JSON.stringify(route)},
      title: document.title || "",
      language: document.documentElement.lang || null,
      landmarks: { main: roleCount("main,[role='main']"), nav: roleCount("nav,[role='navigation']"), header: roleCount("header,[role='banner']"), footer: roleCount("footer,[role='contentinfo']") },
      headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((el) => ({ level: Number(el.tagName.slice(1)), text: text(el), selector: cssPath(el) })),
      focusable,
      forms: [...document.querySelectorAll("input:not([type='hidden']),select,textarea")].map((el) => ({ selector: cssPath(el), label: labelFor(el), required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true", hasErrorMessage: Boolean(el.getAttribute("aria-errormessage") || el.getAttribute("aria-describedby")) })),
      images: [...document.querySelectorAll("img")].map((el) => ({ selector: cssPath(el), alt: el.hasAttribute("alt") ? el.getAttribute("alt") : null, decorative: el.getAttribute("alt") === "" || el.getAttribute("role") === "presentation" })),
      links: [...document.querySelectorAll("a[href]")].map((el) => ({ selector: cssPath(el), text: text(el), href: el.getAttribute("href") })),
      buttons: [...document.querySelectorAll("button,[role='button']")].map((el) => { const r = el.getBoundingClientRect(); return { selector: cssPath(el), text: text(el), width: r.width, height: r.height }; }),
      modals: [...document.querySelectorAll("[role='dialog'],dialog")].map((el) => ({ selector: cssPath(el), role: el.getAttribute("role") || el.tagName.toLowerCase(), labelled: Boolean(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")), modal: el.getAttribute("aria-modal") === "true" || el.tagName.toLowerCase() === "dialog", closeButton: Boolean(el.querySelector("button,[role='button']")) })),
      mobileMenus: [...document.querySelectorAll("button[aria-controls],button[data-menu],button[data-mobile-menu]")].map((el) => ({ selector: cssPath(el), labelled: Boolean(text(el)), expanded: el.getAttribute("aria-expanded"), controls: el.getAttribute("aria-controls") })),
      ariaMisuse,
      skipLinks: [...document.querySelectorAll("a[href^='#']")].filter((el) => /skip/i.test(text(el))).map((el) => { el.focus(); return { selector: cssPath(el), href: el.getAttribute("href"), visibleOnFocus: visible(el) }; }),
      contrastIssues: [...document.querySelectorAll("body *")].filter((el) => visible(el) && (el.textContent || "").trim()).map((el) => { const s = getComputedStyle(el); return { selector: cssPath(el), ratio: contrast(s.color, s.backgroundColor), text: text(el) }; }).filter((x) => x.text && x.ratio < 4.5).slice(0, 30),
      reducedMotionIssues: [...document.querySelectorAll("body *")].filter((el) => { const s = getComputedStyle(el); return visible(el) && (s.animationDuration !== "0s" || s.transitionDuration !== "0s") && !/0s(, 0s)*/.test(s.animationDuration + s.transitionDuration); }).slice(0, 20).map((el) => ({ selector: cssPath(el), evidence: "Animation or transition remains active while prefers-reduced-motion is reduce." })),
    };
  })()`
}

async function saveAccessibilityReport(projectId: number, taskId: number, actor: string, report: ReturnType<typeof buildForgeAccessibilityReport>, now: Date) {
  const registry = getForgeAgentRegistryReference("accessibility_gate")
  const upstream = await db.select({ id: forgeArtifacts.id, outputHash: forgeArtifacts.outputHash }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.approvalState, "approved")))
  return saveVersionedForgeArtifact({
    projectId,
    type: "accessibility_report",
    title: FORGE_ACCESSIBILITY_ARTIFACT_TITLE,
    content: buildForgeAccessibilityArtifactContent(report),
    metadataJson: { kind: FORGE_ACCESSIBILITY_ARTIFACT_KIND, status: report.status, report, taskId },
    actor,
    now,
    action: report.blocking ? "accessibility_gate_blocked" : "accessibility_gate_completed",
    message: report.summary,
    provenance: {
      sourceTaskId: taskId,
      provider: "deterministic",
      model: "forge-accessibility-rules-v1",
      promptIdentifier: registry.promptIdentifier,
      promptVersion: registry.promptVersion,
      schemaIdentifier: registry.schemaIdentifier,
      schemaVersion: registry.schemaVersion,
      upstreamArtifacts: upstream,
      inputContext: { routes: report.routes, previewUrl: report.previewUrl, pagesEvaluated: report.pagesEvaluated },
      actor,
      validationResult: { valid: !report.blocking, findingCount: report.findings.length, criticalCount: report.criticalCount },
      qualityState: report.blocking ? "requires_review" : "validated",
      approvalState: "unapproved",
    },
  })
}

async function loadAccessibilityContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeAccessibilityAgentError("Forge project not found.", 404)
  const [workspaceMemories, generatedArtifacts] = await Promise.all([
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY))).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.type, "generated_code"), eq(forgeArtifacts.title, FORGE_GENERATED_CODE_ARTIFACT_TITLE))).orderBy(desc(forgeArtifacts.updatedAt)).limit(1),
  ])
  const generated = readForgeGeneratedCodeArtifact(generatedArtifacts[0]?.metadataJson)
  return {
    project,
    workspace: readForgeWorkspaceMemory(workspaceMemories[0]?.value),
    hasGeneratedCode: generated.status === "generated",
    routes: [...new Set((generated.summary?.routes ?? ["/"]).map((route) => route.startsWith("/") ? route : `/${route}`))],
  }
}

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    if (!existsSync(path.join(process.cwd(), "node_modules", "playwright", "package.json"))) return null
    const specifier = "playwright"
    const mod = (await import(/* webpackIgnore: true */ specifier)) as { default?: PlaywrightModule } & PlaywrightModule
    return (mod.default ?? mod) as PlaywrightModule
  } catch {
    return null
  }
}

function joinUrl(base: string, route: string) {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`
  return `${base.replace(/\/$/, "")}${normalizedRoute === "/" ? "" : normalizedRoute}`
}
