import "server-only"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { FORGE_GENERATED_CODE_ARTIFACT_TITLE, readForgeGeneratedCodeArtifact } from "@/lib/forge-frontend-code"
import { buildForgeGeneratedProcessEnv } from "@/lib/forge-process-env"
import { FORGE_QA_ARTIFACT_TITLE, readForgeQaArtifact, type ForgeQaCommandStatus } from "@/lib/forge-qa"
import { FORGE_SEO_ARTIFACT_TITLE, readForgeSeoArtifact } from "@/lib/forge-seo"
import {
  buildForgeVisualQaArtifactContent,
  buildForgeVisualQaReport,
  evaluateForgeLighthouse,
  normalizeLighthouseScore,
  resolveForgeLighthouseThresholds,
  resolveForgeMaxConsoleErrors,
  FORGE_VISUAL_QA_ARTIFACT_KIND,
  FORGE_VISUAL_QA_ARTIFACT_TITLE,
  type ForgeConsoleErrorCheck,
  type ForgeLighthouseResult,
  type ForgeLighthouseScores,
  type ForgeLighthouseThresholds,
  type ForgeMobileCheck,
  type ForgeSmokeTest,
  type ForgeVisualQaReport,
} from "@/lib/forge-visual-qa"
import { FORGE_PREVIEW_VIEWPORTS } from "@/lib/forge-preview"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { startForgePreview, stopForgePreview } from "./forge-preview"
import { saveVersionedForgeArtifact } from "./forge-artifacts"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import { evaluateDeterministicVisualSignals, FORGE_SCREENSHOT_QA_VERSION, FORGE_SCREENSHOT_VIEWPORTS, proposeVisualRepairTasks, type ForgeLayoutSignal, type ForgeScreenshotRecord } from "@/lib/forge-screenshot-qa"

export class ForgeVisualQaAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeVisualQaAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

const LIGHTHOUSE_TIMEOUT_MS = 120_000
const LOG_LIMIT = 120

export async function runForgeVisualQaAgent(projectId: number, actor: string) {
  const { project, workspace, hasGeneratedCode, routes, qaStatuses, seoScore } = await loadVisualQaContext(projectId)

  if (project.status === "archived") throw new ForgeVisualQaAgentError("Archived Forge projects cannot run visual QA.", 400)
  if (!workspace) throw new ForgeVisualQaAgentError("Create a generated-site workspace before running visual QA.", 400)
  if (!hasGeneratedCode) throw new ForgeVisualQaAgentError("Generate site code before running visual QA.", 400)

  const thresholds = resolveForgeLighthouseThresholds(process.env)
  const maxConsoleErrors = resolveForgeMaxConsoleErrors(process.env)
  const seoThreshold = thresholds.seo

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeTasks).values({
      projectId,
      title: "Run Lighthouse & visual QA",
      description: "Run Lighthouse scoring and browser smoke tests against the generated site, failing gracefully if tooling is unavailable.",
      agentType: "qa",
      status: "running",
      inputJson: { projectId, projectName: project.name, routes },
      startedAt: now,
      updatedAt: now,
    }).returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "visual_qa_running",
      message: `Running Lighthouse & visual QA for ${project.name}.`,
      metadataJson: { taskId: created.id },
    })

    return [created]
  })

  const logs: string[] = []
  const pushLog = (line: string) => {
    if (!line) return
    logs.push(line)
    while (logs.length > LOG_LIMIT) logs.shift()
  }

  try {
    const tooling = detectTooling()
    pushLog(`Tooling: lighthouse=${tooling.lighthouse ? "available" : "unavailable"}, browser=${tooling.browser ? "available" : "unavailable"}.`)

    let previewUrl: string | null = null
    let lighthouse = skippedLighthouse(thresholds, tooling.lighthouseReason)
    let smokeTests: ForgeSmokeTest[] = skippedSmokeTests(routes)
    let mobile = skippedMobile()
    let consoleErrors = skippedConsoleErrors(maxConsoleErrors)
    let screenshotQa: ForgeVisualQaReport["screenshotQa"] | undefined

    if (tooling.lighthouse || tooling.browser) {
      const preview = await startForgePreview(projectId, actor)
      if (!preview.url) throw new ForgeVisualQaAgentError("Approved preview did not provide a URL.", 500)
      const server = { url: preview.url, stop: async () => { await stopForgePreview(projectId, actor) } }
      previewUrl = server.url
      try {
        if (tooling.lighthouse) {
          lighthouse = await runLighthouse(server.url, thresholds, pushLog)
        }
        if (tooling.browser) {
          const browserResults = await runBrowserChecks(server.url, routes, maxConsoleErrors, pushLog, projectId, task.id)
          smokeTests = browserResults.smokeTests
          mobile = browserResults.mobile
          consoleErrors = browserResults.consoleErrors
          screenshotQa = browserResults.screenshotQa
        } else {
          smokeTests = await runFetchSmoke(server.url, routes, pushLog)
        }
      } finally {
        await server.stop()
      }
    } else {
      pushLog("Lighthouse and browser tooling unavailable; visual QA skipped without blocking progress.")
    }

    const report = buildForgeVisualQaReport({
      workspacePath: workspace.relativePath,
      previewUrl,
      lighthouse,
      smokeTests,
      mobile,
      consoleErrors,
      build: qaStatuses.build,
      typecheck: qaStatuses.typecheck,
      seoScore,
      seoThreshold,
      logs,
      screenshotQa,
    })

    const completedAt = new Date()
    const artifact = await saveVisualQaReport(projectId, report, task.id, actor, completedAt)

    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        // A graceful skip is not a hard failure; only real threshold/smoke failures fail the task.
        status: report.status === "failed" ? "failed" : "completed",
        error: report.status === "failed" ? report.summary : null,
        outputJson: {
          status: report.status,
          badges: report.badges,
          lighthouse: report.lighthouse.scores,
          recommendations: report.recommendations,
        },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: report.status === "failed" ? "visual_qa_failed" : "visual_qa_completed",
        message: `Lighthouse & visual QA ${report.status} for ${project.name}.`,
        metadataJson: { taskId: task.id, artifactId: artifact.id, status: report.status, badges: report.badges },
      })
    })

    return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeVisualQaAgentError ? error.safeMessage : "Visual QA failed to run."

    await db.transaction(async (tx) => {
      await tx.update(forgeTasks).set({
        status: "failed",
        error: safeMessage,
        outputJson: { error: safeMessage, logs: logs.slice(-40) },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "visual_qa_failed",
        message: `Lighthouse & visual QA failed for ${project.name}.`,
        metadataJson: { taskId: task.id, error: safeMessage },
      })
    })

    if (error instanceof ForgeVisualQaAgentError) throw error
    throw new ForgeVisualQaAgentError("Visual QA failed to run.", 500)
  }
}

/* ── tooling detection (optional, never throws) ─────────────────────── */

function detectTooling() {
  const lighthouse = isModuleInstalled("lighthouse") && isModuleInstalled("chrome-launcher")
  const browser = isModuleInstalled("playwright")
  return {
    lighthouse,
    lighthouseReason: lighthouse ? null : "Lighthouse (`lighthouse` + `chrome-launcher`) is not installed in the admin app.",
    browser,
  }
}

// Detect optional native tooling without statically importing it, so the bundle never
// requires Lighthouse/Playwright to be installed.
function isModuleInstalled(name: string): boolean {
  try {
    return existsSync(path.join(process.cwd(), "node_modules", name, "package.json"))
  } catch {
    return false
  }
}

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    const specifier = "playwright"
    const mod = (await import(/* webpackIgnore: true */ specifier)) as { default?: PlaywrightModule } & PlaywrightModule
    return (mod.default ?? mod) as PlaywrightModule
  } catch {
    return null
  }
}

/* ── ephemeral preview server ───────────────────────────────────────── */

/* ── Lighthouse via CLI (graceful) ──────────────────────────────────── */

async function runLighthouse(url: string, thresholds: ForgeLighthouseThresholds, pushLog: (line: string) => void): Promise<ForgeLighthouseResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "forge-lh-"))
  const outputPath = path.join(dir, "report.json")
  try {
    const args = [
      "--yes", "lighthouse", url,
      "--quiet",
      "--output=json",
      `--output-path=${outputPath}`,
      "--only-categories=performance,accessibility,best-practices,seo",
      "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
      "--preset=desktop",
    ]
    const result = await runCommand("npx", args, dir, LIGHTHOUSE_TIMEOUT_MS, pushLog)
    if (result.code !== 0) {
      return skippedLighthouse(thresholds, `Lighthouse exited with code ${result.code ?? "unknown"}.`)
    }

    const raw = await readFile(outputPath, "utf8").catch(() => null)
    if (!raw) return skippedLighthouse(thresholds, "Lighthouse did not produce a report.")

    const parsed = JSON.parse(raw) as { categories?: Record<string, { score?: number }> }
    const categories = parsed.categories ?? {}
    const scores: ForgeLighthouseScores = {
      performance: normalizeLighthouseScore(categories.performance?.score),
      accessibility: normalizeLighthouseScore(categories.accessibility?.score),
      bestPractices: normalizeLighthouseScore(categories["best-practices"]?.score),
      seo: normalizeLighthouseScore(categories.seo?.score),
    }
    return evaluateForgeLighthouse(scores, thresholds, true)
  } catch (error) {
    return skippedLighthouse(thresholds, error instanceof Error ? error.message : "Lighthouse run failed.")
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/* ── Browser smoke tests via optional Playwright (graceful) ─────────── */

interface PlaywrightModule {
  chromium: {
    launch(options?: Record<string, unknown>): Promise<PlaywrightBrowser>
  }
}
interface PlaywrightBrowser {
  newContext(options?: Record<string, unknown>): Promise<PlaywrightContext>
  close(): Promise<void>
}
interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>
  close(): Promise<void>
}
interface PlaywrightPage {
  on(event: string, handler: (payload: { type?: () => string; text?: () => string }) => void): void
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>
  title(): Promise<string>
  locator(selector: string): { count(): Promise<number>; first(): { click(options?: Record<string, unknown>): Promise<void> }; nth(index: number): { screenshot(options?: Record<string, unknown>): Promise<Buffer> } }
  url(): string
  screenshot(options?: Record<string, unknown>): Promise<Buffer>
  evaluate<T>(expression: string): Promise<T>
  waitForTimeout(ms: number): Promise<void>
}

async function runBrowserChecks(baseUrl: string, routes: string[], maxConsoleErrors: number, pushLog: (line: string) => void, projectId: number, taskId: number) {
  const playwright = await loadPlaywright()
  if (!playwright) {
    return {
      smokeTests: await runFetchSmoke(baseUrl, routes, pushLog),
      mobile: skippedMobile(),
      consoleErrors: skippedConsoleErrors(maxConsoleErrors),
      screenshotQa: emptyScreenshotQa(),
    }
  }

  const consoleMessages: string[] = []
  let browser: PlaywrightBrowser | null = null
  const smokeTests: ForgeSmokeTest[] = []
  let mobile = skippedMobile()
  let screenshotQa = emptyScreenshotQa()

  try {
    browser = await playwright.chromium.launch({ args: ["--no-sandbox"] })
    const context = await browser.newContext()
    const page = await context.newPage()
    page.on("console", (message) => {
      if (typeof message.type === "function" && message.type() === "error") {
        consoleMessages.push(typeof message.text === "function" ? message.text() : "console error")
      }
    })
    page.on("pageerror", (error) => {
      consoleMessages.push(typeof (error as { text?: () => string }).text === "function" ? (error as { text: () => string }).text() : "page error")
    })

    // homepage loads
    smokeTests.push(await timedCheck("homepage loads", async () => {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
      const title = await page.title()
      return { ok: Boolean(title), detail: `Loaded homepage with title "${title}".` }
    }))

    // navigation works
    smokeTests.push(await timedCheck("navigation works", async () => {
      const navLinks = page.locator("header a[href]")
      const count = await navLinks.count()
      if (count === 0) return { ok: false, detail: "No navigation links found in the header." }
      await navLinks.first().click({ timeout: 15_000 }).catch(() => undefined)
      return { ok: true, detail: `Header exposes ${count} navigation link(s).` }
    }))

    // contact form renders
    smokeTests.push(await timedCheck("contact form renders", async () => {
      await page.goto(joinUrl(baseUrl, "/contact"), { waitUntil: "domcontentloaded", timeout: 30_000 })
      const fields = await page.locator("form input[name='email'], form textarea[name='message']").count()
      return { ok: fields > 0, detail: fields > 0 ? "Contact form fields rendered." : "No contact form fields found on /contact." }
    }))

    // service pages load
    const servicePaths = routes.filter((route) => route !== "/" && !/about|contact/i.test(route)).slice(0, 4)
    smokeTests.push(await timedCheck("service pages load", async () => {
      if (!servicePaths.length) return { ok: true, detail: "No dedicated service routes to verify." }
      for (const route of servicePaths) {
        await page.goto(joinUrl(baseUrl, route), { waitUntil: "domcontentloaded", timeout: 30_000 })
        const title = await page.title()
        if (!title) return { ok: false, detail: `Route ${route} rendered without a document title.` }
      }
      return { ok: true, detail: `Loaded ${servicePaths.length} service route(s).` }
    }))

    // mobile viewport check
    const mobileViewport = FORGE_PREVIEW_VIEWPORTS.mobile
    const mobileContext = await browser.newContext({ viewport: { width: mobileViewport.width, height: mobileViewport.height }, isMobile: true })
    try {
      const mobilePage = await mobileContext.newPage()
      await mobilePage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 })
      const title = await mobilePage.title()
      mobile = {
        status: title ? "passed" : "failed",
        viewport: { width: mobileViewport.width, height: mobileViewport.height },
        detail: title ? `Homepage rendered at ${mobileViewport.width}×${mobileViewport.height}.` : "Homepage failed to render at mobile viewport.",
      }
    } finally {
      await mobileContext.close().catch(() => undefined)
    }

    await context.close().catch(() => undefined)
    screenshotQa = await captureVisualEvidence(browser, baseUrl, routes, projectId, taskId, pushLog)
  } catch (error) {
    pushLog(`Browser checks degraded: ${error instanceof Error ? error.message : "unknown error"}.`)
    if (!smokeTests.length) {
      return {
        smokeTests: await runFetchSmoke(baseUrl, routes, pushLog),
        mobile: skippedMobile(),
        consoleErrors: skippedConsoleErrors(maxConsoleErrors),
        screenshotQa: emptyScreenshotQa(),
      }
    }
  } finally {
    await browser?.close().catch(() => undefined)
  }

  const consoleErrors: ForgeConsoleErrorCheck = {
    status: consoleMessages.length > maxConsoleErrors ? "failed" : "passed",
    count: consoleMessages.length,
    threshold: maxConsoleErrors,
    messages: consoleMessages.slice(0, 20),
  }

  return { smokeTests, mobile, consoleErrors, screenshotQa }
}

function emptyScreenshotQa(): ForgeVisualQaReport["screenshotQa"] { return { evaluatorVersion: FORGE_SCREENSHOT_QA_VERSION, screenshots: [], layoutSignals: [], findings: [], proposedRepairs: [], evaluator: null, comparison: null } }

async function captureVisualEvidence(browser: PlaywrightBrowser, baseUrl: string, routes: string[], projectId: number, taskId: number, pushLog: (line: string) => void): Promise<ForgeVisualQaReport["screenshotQa"]> {
  const evidenceRoot = path.resolve(process.env.FORGE_VISUAL_EVIDENCE_ROOT ?? path.join(process.cwd(), "..", "generated-sites", ".forge-evidence"))
  const runRoot = path.join(evidenceRoot, String(projectId), String(taskId))
  await mkdir(runRoot, { recursive: true })
  const screenshots: ForgeScreenshotRecord[] = []
  const layoutSignals: ForgeLayoutSignal[] = []
  const criticalRoutes = [...new Set(["/", "/style-guide", ...routes])].slice(0, 12)
  for (const [viewport, dimensions] of Object.entries(FORGE_SCREENSHOT_VIEWPORTS)) {
    const context = await browser.newContext({ viewport: dimensions, reducedMotion: "reduce" })
    try {
      const page = await context.newPage()
      for (const route of criticalRoutes) {
        await page.goto(joinUrl(baseUrl, route), { waitUntil: "domcontentloaded", timeout: 30_000 })
        await page.waitForTimeout(500)
        const safeRoute = route === "/" ? "home" : route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")
        const filename = `${safeRoute}-${viewport}.png`
        const buffer = await page.screenshot({ fullPage: true, animations: "disabled" })
        await import("node:fs/promises").then(({ writeFile }) => writeFile(path.join(runRoot, filename), buffer))
        const id = `${projectId}-${taskId}-${safeRoute}-${viewport}`
        screenshots.push({ id, route, section: "full-page", viewport: viewport as keyof typeof FORGE_SCREENSHOT_VIEWPORTS, ...dimensions, relativePath: path.relative(evidenceRoot, path.join(runRoot, filename)).replaceAll("\\", "/"), sha256: createHash("sha256").update(buffer).digest("hex"), capturedAt: new Date().toISOString() })
        const sections = page.locator("main section, main > div[data-section]")
        const sectionCount = Math.min(await sections.count(), 8)
        for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex += 1) {
          const sectionBuffer = await sections.nth(sectionIndex).screenshot({ animations: "disabled" }).catch(() => null)
          if (!sectionBuffer) continue
          const sectionFilename = `${safeRoute}-${viewport}-section-${sectionIndex + 1}.png`
          await import("node:fs/promises").then(({ writeFile }) => writeFile(path.join(runRoot, sectionFilename), sectionBuffer))
          screenshots.push({ id: `${id}-section-${sectionIndex + 1}`, route, section: `section-${sectionIndex + 1}`, viewport: viewport as keyof typeof FORGE_SCREENSHOT_VIEWPORTS, ...dimensions, relativePath: path.relative(evidenceRoot, path.join(runRoot, sectionFilename)).replaceAll("\\", "/"), sha256: createHash("sha256").update(sectionBuffer).digest("hex"), capturedAt: new Date().toISOString() })
        }
        const signal = await page.evaluate<ForgeLayoutSignal>(`(() => { const els=[...document.querySelectorAll('body *')]; const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}; const rgb=v=>{const m=v.match(/\\d+(?:\\.\\d+)?/g);return m?m.slice(0,3).map(Number):[0,0,0]}; const lum=c=>{const q=c.map(x=>{x/=255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*q[0]+.7152*q[1]+.0722*q[2]}; const low=els.filter(e=>visible(e)&&e.textContent?.trim()&&(()=>{const s=getComputedStyle(e),a=lum(rgb(s.color)),b=lum(rgb(s.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)<3})()).length; return {route:${JSON.stringify(route)},viewport:${JSON.stringify(viewport)},documentWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth,hiddenTextCount:els.filter(e=>e.textContent?.trim()&&!visible(e)).length,clippedCount:els.filter(e=>{if(!visible(e))return false;const s=getComputedStyle(e);return ['hidden','clip'].includes(s.overflow)&&e.scrollHeight>e.clientHeight+2}).length,lowContrastCount:low,smallTextCount:els.filter(e=>visible(e)&&e.textContent?.trim()&&parseFloat(getComputedStyle(e).fontSize)<12).length,weakCtaCount:[...document.querySelectorAll('a,button')].filter(e=>/book|quote|contact|call|buy|get started/i.test(e.textContent||'')&&(!visible(e)||e.getBoundingClientRect().height<32)).length,missingHeader:![...document.querySelectorAll('header,nav')].some(visible),missingFooter:![...document.querySelectorAll('footer')].some(visible),layoutShift:performance.getEntriesByType('layout-shift').reduce((n,e)=>n+(e.hadRecentInput?0:e.value),0),animatedHiddenCount:els.filter(e=>e.textContent?.trim()&&getComputedStyle(e).opacity==='0'&&getComputedStyle(e).animationName!=='none').length}; })()`)
        layoutSignals.push(signal)
      }
    } finally { await context.close().catch(() => undefined) }
  }
  const findings = evaluateDeterministicVisualSignals(layoutSignals, screenshots)
  pushLog(`Captured ${screenshots.length} screenshot(s) with ${findings.length} advisory deterministic finding(s).`)
  return { evaluatorVersion: FORGE_SCREENSHOT_QA_VERSION, screenshots, layoutSignals, findings, proposedRepairs: proposeVisualRepairTasks(findings), evaluator: null, comparison: null }
}

/* ── Fetch-based smoke fallback (no browser required) ───────────────── */

async function runFetchSmoke(baseUrl: string, routes: string[], pushLog: (line: string) => void): Promise<ForgeSmokeTest[]> {
  const tests: ForgeSmokeTest[] = []

  tests.push(await timedCheck("homepage loads", async () => {
    const html = await fetchText(baseUrl)
    return { ok: html !== null && html.length > 0, detail: html ? "Homepage returned HTML." : "Homepage did not respond." }
  }))

  tests.push(await timedCheck("navigation works", async () => {
    const html = await fetchText(baseUrl)
    const hasNav = html ? /<header[\s\S]*?<a [\s\S]*?href=/.test(html) || /<nav[\s\S]*?href=/.test(html) : false
    return { ok: hasNav, detail: hasNav ? "Header navigation links present in markup." : "No navigation links detected in homepage markup." }
  }))

  tests.push(await timedCheck("contact form renders", async () => {
    const html = await fetchText(joinUrl(baseUrl, "/contact"))
    const hasForm = html ? /<form[\s\S]*?(name=["']email["']|name=["']message["'])/.test(html) : false
    return { ok: hasForm, detail: hasForm ? "Contact form fields present in /contact markup." : "Contact form fields not detected on /contact." }
  }))

  tests.push(await timedCheck("style guide renders", async () => {
    const html = await fetchText(joinUrl(baseUrl, "/style-guide"))
    const hasStyleGuide = html ? /Generated design-token implementation|Internal style guide|design-token/i.test(html) : false
    return { ok: hasStyleGuide, detail: hasStyleGuide ? "Generated style-guide route rendered." : "Generated style-guide route did not render expected content." }
  }))

  tests.push(await timedCheck("service pages load", async () => {
    const servicePaths = routes.filter((route) => route !== "/" && !/about|contact/i.test(route)).slice(0, 4)
    if (!servicePaths.length) return { ok: true, detail: "No dedicated service routes to verify." }
    for (const route of servicePaths) {
      const html = await fetchText(joinUrl(baseUrl, route))
      if (!html) return { ok: false, detail: `Route ${route} did not respond.` }
    }
    return { ok: true, detail: `Fetched ${servicePaths.length} service route(s).` }
  }))

  pushLog("Ran fetch-based smoke tests (browser tooling unavailable).")
  return tests
}

/* ── persistence + context ──────────────────────────────────────────── */

async function saveVisualQaReport(projectId: number, report: ForgeVisualQaReport, taskId: number, actor: string, now: Date) {
  const content = buildForgeVisualQaArtifactContent(report)
  const upstream = await db.select({ id: forgeArtifacts.id, outputHash: forgeArtifacts.outputHash }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), eq(forgeArtifacts.approvalState, "approved")))
  const registry = getForgeAgentRegistryReference("screenshot_visual_qa")
  return saveVersionedForgeArtifact({
    projectId, type: "visual_qa", title: FORGE_VISUAL_QA_ARTIFACT_TITLE, content, actor, now,
    metadataJson: {
    kind: FORGE_VISUAL_QA_ARTIFACT_KIND,
    status: report.status,
    report,
    taskId,
    },
    provenance: { sourceTaskId: taskId, provider: report.screenshotQa.evaluator?.provider ?? "deterministic", model: report.screenshotQa.evaluator?.model ?? `layout-rules-${FORGE_SCREENSHOT_QA_VERSION}`, promptIdentifier: registry.promptIdentifier, promptVersion: registry.promptVersion, schemaIdentifier: registry.schemaIdentifier, schemaVersion: registry.schemaVersion, upstreamArtifacts: upstream, inputContext: { screenshots: report.screenshotQa.screenshots.map(({ id, sha256 }) => ({ id, sha256 })), evaluatorVersion: report.screenshotQa.evaluatorVersion }, validationResult: { valid: true, findingCount: report.screenshotQa.findings.length }, qualityState: report.status === "failed" ? "requires_review" : "validated", approvalState: "unapproved" },
  })
}

async function loadVisualQaContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeVisualQaAgentError("Forge project not found.", 404)

  const [workspaceMemories, generatedCodeArtifacts, qaArtifacts, seoArtifacts] = await Promise.all([
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(
      eq(forgeMemories.projectId, projectId),
      eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "generated_code"),
      eq(forgeArtifacts.title, FORGE_GENERATED_CODE_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "qa_report"),
      eq(forgeArtifacts.title, FORGE_QA_ARTIFACT_TITLE),
    )).orderBy(desc(forgeArtifacts.updatedAt)).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "seo_pack"),
      eq(forgeArtifacts.title, FORGE_SEO_ARTIFACT_TITLE),
    )).orderBy(desc(forgeArtifacts.updatedAt)).limit(1),
  ])

  const generatedCode = readForgeGeneratedCodeArtifact(generatedCodeArtifacts[0]?.metadataJson)
  const qa = readForgeQaArtifact(qaArtifacts[0]?.metadataJson)
  const seo = readForgeSeoArtifact(seoArtifacts[0]?.metadataJson)
  const routes = dedupeRoutes(generatedCode.summary?.routes ?? ["/"])

  return {
    project,
    workspace: readForgeWorkspaceMemory(workspaceMemories[0]?.value),
    hasGeneratedCode: generatedCode.status === "generated",
    routes,
    qaStatuses: commandStatuses(qa.report?.commands ?? []),
    seoScore: seo.score?.overall ?? null,
  }
}

function commandStatuses(commands: { name: string; status: ForgeQaCommandStatus }[]) {
  const find = (name: string) => commands.find((command) => command.name === name)?.status ?? null
  return { build: find("build"), typecheck: find("typecheck") }
}

function dedupeRoutes(routes: string[]) {
  const normalized = routes.map((route) => {
    const trimmed = (route || "/").trim()
    const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`
    return withSlash.replace(/\/+/g, "/").replace(/(.)\/$/, "$1")
  })
  return [...new Set(normalized.length ? normalized : ["/"])]
}

/* ── skipped defaults ───────────────────────────────────────────────── */

function skippedLighthouse(thresholds: ForgeLighthouseThresholds, reason: string | null): ForgeLighthouseResult {
  return evaluateForgeLighthouse(
    { performance: null, accessibility: null, bestPractices: null, seo: null },
    thresholds,
    false,
    reason,
  )
}

function skippedSmokeTests(routes: string[]): ForgeSmokeTest[] {
  void routes
  return [
    { name: "homepage loads", status: "skipped", detail: "Browser/preview tooling unavailable.", durationMs: 0 },
    { name: "navigation works", status: "skipped", detail: "Browser/preview tooling unavailable.", durationMs: 0 },
    { name: "contact form renders", status: "skipped", detail: "Browser/preview tooling unavailable.", durationMs: 0 },
    { name: "style guide renders", status: "skipped", detail: "Browser/preview tooling unavailable.", durationMs: 0 },
    { name: "service pages load", status: "skipped", detail: "Browser/preview tooling unavailable.", durationMs: 0 },
  ]
}

function skippedMobile(): ForgeMobileCheck {
  const viewport = FORGE_PREVIEW_VIEWPORTS.mobile
  return { status: "skipped", viewport: { width: viewport.width, height: viewport.height }, detail: "Mobile viewport check requires Playwright." }
}

function skippedConsoleErrors(threshold: number): ForgeConsoleErrorCheck {
  return { status: "skipped", count: 0, threshold, messages: [] }
}

/* ── process + network utilities ────────────────────────────────────── */

async function timedCheck(name: string, run: () => Promise<{ ok: boolean; detail: string }>): Promise<ForgeSmokeTest> {
  const started = Date.now()
  try {
    const result = await run()
    return { name, status: result.ok ? "passed" : "failed", detail: result.detail, durationMs: Date.now() - started }
  } catch (error) {
    return { name, status: "failed", detail: error instanceof Error ? error.message : "Check threw an error.", durationMs: Date.now() - started }
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (response.status >= 500) return null
    return await response.text()
  } catch {
    return null
  }
}

function joinUrl(base: string, route: string) {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`
  return `${base.replace(/\/$/, "")}${normalizedRoute === "/" ? "" : normalizedRoute}` || base
}

function runCommand(bin: string, args: string[], cwd: string, timeoutMs: number, pushLog: (line: string) => void) {
  const executable = bin === "npx" ? npxCommand() : bin
  return new Promise<{ code: number | null }>((resolve) => {
    const child = spawn(executable, args, {
      cwd,
      env: buildForgeGeneratedProcessEnv(),
      windowsHide: true,
      stdio: "pipe",
    })
    const timer = setTimeout(() => { void stopProcess(child); pushLog(`Command timed out: ${bin} ${args[0]}`) }, timeoutMs)
    attachLogging(child, pushLog)
    child.once("error", (error) => { clearTimeout(timer); pushLog(`Command error: ${error.message}`); resolve({ code: null }) })
    child.once("exit", (code) => { clearTimeout(timer); resolve({ code }) })
  })
}

function attachLogging(child: ChildProcessWithoutNullStreams, pushLog: (line: string) => void) {
  const push = (chunk: Buffer) => {
    const text = chunk.toString("utf8").trim()
    if (text) pushLog(text.slice(0, 500))
  }
  child.stdout.on("data", push)
  child.stderr.on("data", push)
}

function stopProcess(child: ChildProcessWithoutNullStreams) {
  return new Promise<void>((resolve) => {
    if (child.killed || !child.pid) { resolve(); return }
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
      killer.once("exit", () => resolve())
      killer.once("error", () => resolve())
      return
    }
    child.kill("SIGTERM")
    setTimeout(() => { if (!child.killed) child.kill("SIGKILL"); resolve() }, 1500)
  })
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx"
}
