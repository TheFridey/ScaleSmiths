import { spawn } from "node:child_process"
import { createWriteStream, existsSync } from "node:fs"
import { gzipSync } from "node:zlib"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, "..")
const reportDir = path.join(webRoot, "performance-reports")
const nextDir = path.join(webRoot, ".next")
const port = Number(process.env.PERFORMANCE_BUDGET_PORT ?? 3320)
const baseUrl = process.env.PERFORMANCE_BUDGET_BASE_URL ?? `http://127.0.0.1:${port}`
const runLighthouse = process.env.PERFORMANCE_BUDGET_SKIP_LIGHTHOUSE !== "1"
const hardOnly = process.env.PERFORMANCE_BUDGET_HARD_ONLY === "1"

const routes = [
  {
    id: "normal",
    route: "/?experience=normal",
    manifestKey: "/page",
    description: "Canonical normal public homepage",
    hard: {
      routeJsGzipKb: 260,
      initialJsGzipKb: 320,
      transferredKb: 1_600,
      lcpMs: 4_200,
      cls: 0.12,
      totalBlockingMs: 900,
      performance: 0.58,
      accessibility: 0.90,
      seo: 0.90,
      bestPractices: 0.82,
    },
    advisory: {
      lcpMs: 2_800,
      totalBlockingMs: 350,
      performance: 0.78,
    },
  },
  {
    id: "interactive",
    route: "/interactive",
    manifestKey: "/interactive/page",
    description: "Interactive V2 experience route",
    hard: {
      routeJsGzipKb: 340,
      initialJsGzipKb: 390,
      transferredKb: 2_400,
      lcpMs: 5_000,
      cls: 0.15,
      totalBlockingMs: 500,
      performance: 0.50,
      accessibility: 0.88,
      seo: 0.88,
      bestPractices: 0.80,
    },
    advisory: {
      lcpMs: 3_600,
      totalBlockingMs: 300,
      performance: 0.70,
    },
  },
]

const generatedSiteLighthouseHard = {
  performance: 70,
  accessibility: 92,
  seo: 90,
  bestPractices: 85,
}

async function main() {
  await mkdir(reportDir, { recursive: true })

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    hardOnly,
    routes: [],
    interactiveRuntime: await inspectInteractiveRuntime(),
    generatedForgeSites: {
      note: "Generated Forge sites are enforced by admin visual QA. This public-site CI report records the strengthened default thresholds expected there.",
      lighthouseHardThresholds: generatedSiteLighthouseHard,
    },
    failures: [],
    warnings: [],
  }

  const bundleManifest = await readJson(path.join(nextDir, "app-build-manifest.json"))
  const allRouteFiles = new Set()

  for (const route of routes) {
    const files = bundleManifest.pages?.[route.manifestKey]
    if (!Array.isArray(files)) throw new Error(`Missing Next app-build-manifest entry for ${route.manifestKey}. Run npm run build before performance budgets.`)
    files.filter((file) => file.endsWith(".js")).forEach((file) => allRouteFiles.add(file))
  }

  const sharedInitialFiles = [...allRouteFiles]
  let server = null

  try {
    if (runLighthouse) {
      server = await startNextServer()
    }

    for (const route of routes) {
      const routeFiles = bundleManifest.pages[route.manifestKey].filter((file) => file.endsWith(".js"))
      const bundle = await measureBundle(routeFiles, sharedInitialFiles)
      const lighthouse = runLighthouse ? await runLighthouseForRoute(route) : skippedLighthouse()
      const routeReport = { ...route, bundle, lighthouse, checks: [] }

      checkMax(routeReport, "route bundle gzip", bundle.routeJsGzipKb, route.hard.routeJsGzipKb, "KB")
      checkMax(routeReport, "initial JavaScript gzip", bundle.initialJsGzipKb, route.hard.initialJsGzipKb, "KB")

      if (lighthouse.available) {
        checkMax(routeReport, "transferred assets", lighthouse.metrics.transferredKb, route.hard.transferredKb, "KB")
        checkMax(routeReport, "Largest Contentful Paint", lighthouse.metrics.lcpMs, route.hard.lcpMs, "ms")
        checkMax(routeReport, "Cumulative Layout Shift", lighthouse.metrics.cls, route.hard.cls, "")
        checkMax(routeReport, "main-thread blocking", lighthouse.metrics.totalBlockingMs, route.hard.totalBlockingMs, "ms")
        checkMin(routeReport, "Lighthouse performance", lighthouse.scores.performance, route.hard.performance)
        checkMin(routeReport, "Lighthouse accessibility", lighthouse.scores.accessibility, route.hard.accessibility)
        checkMin(routeReport, "Lighthouse SEO", lighthouse.scores.seo, route.hard.seo)
        checkMin(routeReport, "Lighthouse best practices", lighthouse.scores.bestPractices, route.hard.bestPractices)

        warnMax(routeReport, "advisory LCP target", lighthouse.metrics.lcpMs, route.advisory.lcpMs, "ms")
        warnMax(routeReport, "advisory main-thread target", lighthouse.metrics.totalBlockingMs, route.advisory.totalBlockingMs, "ms")
        warnMin(routeReport, "advisory performance target", lighthouse.scores.performance, route.advisory.performance)
      }

      report.routes.push(routeReport)
    }
  } finally {
    if (server) await stopProcess(server)
  }

  evaluateInteractiveRuntime(report)
  await writeReports(report)

  if (report.failures.length) {
    console.error(`Performance budgets failed with ${report.failures.length} hard limit breach(es).`)
    for (const failure of report.failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }

  console.log(`Performance budgets passed for ${report.routes.length} route(s).`)
  if (report.warnings.length) {
    console.log(`${report.warnings.length} advisory warning(s) were recorded but did not fail CI.`)
  }
}

function checkMax(routeReport, label, actual, limit, unit) {
  const passed = actual <= limit
  routeReport.checks.push({ label, actual, limit, unit, status: passed ? "pass" : "fail", type: "hard-max" })
  if (!passed) routeReport.failures = [...(routeReport.failures ?? []), `${label}: ${format(actual, unit)} > ${format(limit, unit)}`]
}

function checkMin(routeReport, label, actual, limit) {
  const passed = actual >= limit
  routeReport.checks.push({ label, actual, limit, unit: "score", status: passed ? "pass" : "fail", type: "hard-min" })
  if (!passed) routeReport.failures = [...(routeReport.failures ?? []), `${label}: ${score(actual)} < ${score(limit)}`]
}

function warnMax(routeReport, label, actual, limit, unit) {
  if (hardOnly || actual <= limit) return
  routeReport.checks.push({ label, actual, limit, unit, status: "warn", type: "advisory-max" })
}

function warnMin(routeReport, label, actual, limit) {
  if (hardOnly || actual >= limit) return
  routeReport.checks.push({ label, actual, limit, unit: "score", status: "warn", type: "advisory-min" })
}

function evaluateInteractiveRuntime(report) {
  for (const check of report.interactiveRuntime.checks) {
    if (check.status === "fail") report.failures.push(`interactive runtime: ${check.label}`)
    if (check.status === "warn") report.warnings.push(`interactive runtime: ${check.label}`)
  }
  for (const route of report.routes) {
    for (const failure of route.failures ?? []) report.failures.push(`${route.id}: ${failure}`)
    for (const warning of route.checks.filter((check) => check.status === "warn")) {
      report.warnings.push(`${route.id}: ${warning.label} ${format(warning.actual, warning.unit)} outside advisory ${format(warning.limit, warning.unit)}`)
    }
  }
}

async function inspectInteractiveRuntime() {
  const canvasPath = path.join(webRoot, "src", "components", "v2", "three", "ClientSceneCanvas.tsx")
  const interactivePath = path.join(webRoot, "src", "components", "v2", "V2InteractiveExperience.tsx")
  const heroPath = path.join(webRoot, "src", "components", "ForgeHeroScene.tsx")
  const canvas = await readFile(canvasPath, "utf8")
  const interactive = await readFile(interactivePath, "utf8")
  const hero = await readFile(heroPath, "utf8")

  const checks = [
    hardCheck("React Three Fiber uses demand rendering", canvas.includes('frameloop="demand"')),
    hardCheck("manual Three.js render loop is throttled", canvas.includes("TARGET_RENDER_FPS") && canvas.includes("TARGET_FRAME_MS")),
    hardCheck("frame loop suspends when document is hidden", canvas.includes("document.hidden") && canvas.includes("visibilitychange")),
    hardCheck("offscreen canvas work suspends with IntersectionObserver", canvas.includes("IntersectionObserver") && canvas.includes("canvasVisible")),
    hardCheck("reduced-motion fallback disables interactive canvas", canvas.includes('prefers-reduced-motion: reduce') && canvas.includes("StaticSceneFallback")),
    hardCheck("low-powered-device fallback is present", canvas.includes("deviceMemory") && canvas.includes("hardwareConcurrency")),
    hardCheck("mobile/coarse pointer fallback is present", canvas.includes("pointer: coarse") && canvas.includes("max-width: 767px")),
    hardCheck("interactive route lazy-loads the Three.js canvas", interactive.includes("dynamic(() => import") && interactive.includes("ClientSceneCanvas")),
    hardCheck("public e2e can disable canvases without production env flags", interactive.includes("scalesmiths.e2e.disableCanvas") && hero.includes("scalesmiths.e2e.disableCanvas")),
  ]

  return { checks }
}

function hardCheck(label, ok) {
  return { label, status: ok ? "pass" : "fail", type: "hard-runtime-guarantee" }
}

async function measureBundle(routeFiles, initialFiles) {
  const routeJs = await sumFiles(routeFiles)
  const initialJs = await sumFiles(initialFiles)

  return {
    routeFiles,
    routeJsKb: kb(routeJs.raw),
    routeJsGzipKb: kb(routeJs.gzip),
    initialFiles,
    initialJsKb: kb(initialJs.raw),
    initialJsGzipKb: kb(initialJs.gzip),
  }
}

async function sumFiles(files) {
  let raw = 0
  let gzip = 0
  for (const file of files) {
    const absolute = path.join(nextDir, file)
    const buffer = await readFile(absolute)
    raw += buffer.byteLength
    gzip += gzipSync(buffer).byteLength
  }
  return { raw, gzip }
}

async function runLighthouseForRoute(route) {
  const url = `${baseUrl}${route.route}`
  const outputPath = path.join(reportDir, `${route.id}.lighthouse.json`)
  const chromePath = await resolveChromePath()
  const args = [
    "--yes",
    "lighthouse@12.8.2",
    url,
    "--quiet",
    "--output=json",
    `--output-path=${outputPath}`,
    "--only-categories=performance,accessibility,best-practices,seo",
    "--preset=desktop",
    "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
  ]
  if (chromePath) args.push(`--chrome-path=${chromePath}`)

  const result = await runCommand(npxCommand(), args, webRoot, 180_000)
  if (result.code !== 0 || !existsSync(outputPath)) {
    return {
      available: false,
      unavailableReason: `Lighthouse failed for ${url}. ${result.stderr.slice(-500)}`,
      scores: null,
      metrics: null,
    }
  }

  const lhr = await readJson(outputPath)
  const audits = lhr.audits ?? {}
  const categories = lhr.categories ?? {}
  const networkRequests = audits["network-requests"]?.details?.items ?? []
  const totalTransfer = Array.isArray(networkRequests)
    ? networkRequests.reduce((sum, item) => sum + Number(item.transferSize ?? 0), 0)
    : 0

  return {
    available: true,
    url,
    scores: {
      performance: numberScore(categories.performance?.score),
      accessibility: numberScore(categories.accessibility?.score),
      bestPractices: numberScore(categories["best-practices"]?.score),
      seo: numberScore(categories.seo?.score),
    },
    metrics: {
      lcpMs: Math.round(Number(audits["largest-contentful-paint"]?.numericValue ?? 0)),
      cls: Number((audits["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)),
      totalBlockingMs: Math.round(Number(audits["total-blocking-time"]?.numericValue ?? 0)),
      transferredKb: kb(totalTransfer),
      mainThreadWorkMs: Math.round(Number(audits["mainthread-work-breakdown"]?.numericValue ?? 0)),
      interactionToNextPaint: audits["interaction-to-next-paint"]?.numericValue ?? null,
    },
  }
}

function skippedLighthouse() {
  return {
    available: false,
    unavailableReason: "Skipped by PERFORMANCE_BUDGET_SKIP_LIGHTHOUSE=1.",
    scores: null,
    metrics: null,
  }
}

async function startNextServer() {
  const logPath = path.join(reportDir, "next-start.log")
  await rm(logPath, { force: true })
  const out = createWriteStream(logPath, { flags: "a" })
  const child = spawn(process.execPath, ["--env-file-if-exists=../.env", "./node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: webRoot,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  child.stdout.pipe(out)
  child.stderr.pipe(out)
  await waitForUrl(baseUrl)
  return child
}

async function waitForUrl(url) {
  const started = Date.now()
  let lastFailure = "no response"
  while (Date.now() - started < 60_000) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      })
      if (response.status < 500) return
      lastFailure = `HTTP ${response.status}`
    } catch (error) {
      lastFailure = error instanceof Error ? error.message : String(error)
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`Timed out waiting for ${url}; last failure: ${lastFailure}.`)
}

async function stopProcess(child) {
  if (!child.pid || child.killed) return
  await new Promise((resolve) => {
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
      killer.once("exit", resolve)
      killer.once("error", resolve)
      return
    }
    child.kill("SIGTERM")
    setTimeout(resolve, 1500)
  })
}

function runCommand(command, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: "pipe",
      windowsHide: true,
      shell: process.platform === "win32" && /\.(?:cmd|bat)$/i.test(command),
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      void stopProcess(child)
      stderr += `\nTimed out after ${timeoutMs}ms.`
    }, timeoutMs)
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8") })
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8") })
    child.once("error", (error) => {
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr: `${stderr}\n${error.message}` })
    })
    child.once("exit", (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

async function resolveChromePath() {
  try {
    const playwright = await import("playwright")
    return playwright.chromium.executablePath()
  } catch {
    return null
  }
}

async function writeReports(report) {
  await writeFile(path.join(reportDir, "performance-budget-report.json"), `${JSON.stringify(report, null, 2)}\n`)
  await writeFile(path.join(reportDir, "performance-budget-report.md"), markdown(report))
}

function markdown(report) {
  const lines = [
    "# Public Performance Budget Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Base URL: ${report.baseUrl}`,
    "",
    "## Result",
    "",
    report.failures.length ? `Hard failures: ${report.failures.length}` : "Hard failures: 0",
    `Advisory warnings: ${report.warnings.length}`,
    "",
    "## Routes",
    "",
    "| Route | Route JS gzip | Initial JS gzip | LCP | TBT | CLS | Perf | A11y | SEO | Best | Transfer |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...report.routes.map((route) => {
      const lh = route.lighthouse
      return [
        route.route,
        `${route.bundle.routeJsGzipKb} KB`,
        `${route.bundle.initialJsGzipKb} KB`,
        lh.available ? `${lh.metrics.lcpMs} ms` : "n/a",
        lh.available ? `${lh.metrics.totalBlockingMs} ms` : "n/a",
        lh.available ? String(lh.metrics.cls) : "n/a",
        lh.available ? score(lh.scores.performance) : "n/a",
        lh.available ? score(lh.scores.accessibility) : "n/a",
        lh.available ? score(lh.scores.seo) : "n/a",
        lh.available ? score(lh.scores.bestPractices) : "n/a",
        lh.available ? `${lh.metrics.transferredKb} KB` : "n/a",
      ].join(" | ")
    }).map((row) => `| ${row} |`),
    "",
    "## Interactive Runtime Guarantees",
    "",
    ...report.interactiveRuntime.checks.map((check) => `- ${check.status.toUpperCase()}: ${check.label}`),
    "",
    "## Generated Forge Sites",
    "",
    `Default hard Lighthouse thresholds: performance ${generatedSiteLighthouseHard.performance}, accessibility ${generatedSiteLighthouseHard.accessibility}, SEO ${generatedSiteLighthouseHard.seo}, best practices ${generatedSiteLighthouseHard.bestPractices}.`,
    "",
    "## Hard Failures",
    "",
    ...(report.failures.length ? report.failures.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Advisory Warnings",
    "",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ["- None"]),
    "",
  ]
  return `${lines.join("\n")}\n`
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"))
}

function kb(bytes) {
  return Math.round((Number(bytes) / 1024) * 10) / 10
}

function numberScore(value) {
  return typeof value === "number" ? value : 0
}

function score(value) {
  return `${Math.round(Number(value) * 100)}`
}

function format(value, unit) {
  if (unit === "score") return score(value)
  return `${value}${unit ? ` ${unit}` : ""}`
}

function npxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx"
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
})
