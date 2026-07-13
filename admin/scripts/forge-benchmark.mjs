import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import ts from "typescript"

const root = process.cwd()
const outDir = path.resolve(root, "benchmark-results", "forge")
const live = process.argv.includes("--live") || process.env.FORGE_BENCHMARK_LIVE === "true"
const comparePath = valueAfter("--compare")

if (live && process.env.FORGE_BENCHMARK_LIVE !== "true") {
  console.error("Live provider benchmark requires FORGE_BENCHMARK_LIVE=true. Normal CI must use offline mode.")
  process.exit(1)
}

const mod = await importBenchmarkModule()
const baseline = comparePath ? await loadBaseline(comparePath) : undefined

if (live) {
  console.error("Live provider benchmark scheduling is opt-in but not executed by this offline runner. Use the provider evaluation worker with FORGE_BENCHMARK_LIVE=true.")
  process.exit(2)
}

const report = mod.runOfflineForgeBenchmark(baseline)
await mkdir(outDir, { recursive: true })
const stamp = report.generatedAt.replace(/[:.]/g, "-")
const jsonPath = path.join(outDir, `forge-benchmark-${stamp}.json`)
const latestJsonPath = path.join(outDir, "latest.json")
const mdPath = path.join(outDir, `forge-benchmark-${stamp}.md`)
await writeFile(jsonPath, JSON.stringify(report, null, 2))
await writeFile(latestJsonPath, JSON.stringify(report, null, 2))
await writeFile(mdPath, markdown(report))
console.log(`Forge benchmark complete: ${report.fixtureCount} fixtures, schema pass ${(report.schemaPassRate * 100).toFixed(1)}%, consistency ${report.averageConsistencyScore}, content ${report.averageContentQuality}.`)
console.log(`Report: ${path.relative(root, jsonPath)}`)

function valueAfter(flag) {
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

async function loadBaseline(file) {
  const parsed = JSON.parse(await readFile(path.resolve(root, file), "utf8"))
  return Object.fromEntries((parsed.results ?? []).map((result) => [result.fixtureId, result]))
}

async function importBenchmarkModule() {
  const sourcePath = path.join(root, "src", "lib", "forge-benchmarks.ts")
  const source = await readFile(sourcePath, "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: sourcePath,
  })
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`)
}

function markdown(report) {
  const lines = [
    "# Forge Benchmark Report",
    "",
    `Mode: ${report.mode}`,
    `Benchmark version: ${report.benchmarkVersion}`,
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- Fixtures: ${report.fixtureCount}`,
    `- Schema pass rate: ${(report.schemaPassRate * 100).toFixed(1)}%`,
    `- Average consistency score: ${report.averageConsistencyScore}`,
    `- Average content quality: ${report.averageContentQuality}`,
    `- Total cost: ${report.totalCostUsd === null ? "n/a" : `$${report.totalCostUsd}`}`,
    `- Average latency: ${report.averageLatencyMs}ms`,
    `- Retry count: ${report.retryCount}`,
    `- Fallback rate: ${(report.fallbackRate * 100).toFixed(1)}%`,
    `- Human-review requirement: ${(report.humanReviewRate * 100).toFixed(1)}%`,
    "",
    "## Fixtures",
    "",
    "| Fixture | Schema | Consistency | Content | Fallback | Human review | Regression |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...report.results.map((result) => `| ${result.fixtureName} | ${result.schemaPassed ? "pass" : "fail"} | ${result.consistencyScore} | ${result.contentQuality} | ${result.fallbackUsed ? "yes" : "no"} | ${result.humanReviewRequired ? "yes" : "no"} | ${result.regression.regressed ? "yes" : "no"} |`),
  ]
  return `${lines.join("\n")}\n`
}
