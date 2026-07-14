#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

export function inspectDependencyGovernance(apps, policy) {
  const errors = []
  const details = []
  for (const [appName, app] of Object.entries(apps)) {
    const rootPackage = app.lock.packages?.[""]
    if (!rootPackage) {
      errors.push(`${appName}: package-lock.json has no root package entry.`)
      continue
    }

    for (const section of ["dependencies", "devDependencies", "optionalDependencies"]) {
      const manifestSection = app.manifest[section] ?? {}
      const lockSection = rootPackage[section] ?? {}
      const names = new Set([...Object.keys(manifestSection), ...Object.keys(lockSection)])
      for (const name of names) {
        if (manifestSection[name] !== lockSection[name]) errors.push(`${appName}: ${section}.${name} differs between package.json (${manifestSection[name] ?? "missing"}) and package-lock.json (${lockSection[name] ?? "missing"}).`)
      }
    }

    for (const [name, expected] of Object.entries(policy.criticalDependencies[appName] ?? {})) {
      const declared = app.manifest.dependencies?.[name] ?? app.manifest.devDependencies?.[name]
      const resolved = app.lock.packages?.[`node_modules/${name}`]?.version
      if (!EXACT_VERSION.test(declared ?? "")) errors.push(`${appName}: critical dependency ${name} must use an exact version, found ${declared ?? "missing"}.`)
      if (declared !== expected) errors.push(`${appName}: critical dependency ${name} must be the reviewed ${expected}, found ${declared ?? "missing"}.`)
      if (resolved !== expected) errors.push(`${appName}: lockfile resolves ${name} to ${resolved ?? "missing"}, expected ${expected}.`)
    }

    const frameworkVersion = policy.reviewedFrameworkVersion
    const nextPackages = []
    for (const [packagePath, metadata] of Object.entries(app.lock.packages ?? {})) {
      if (!/^node_modules\/@next\/(?:env|eslint-plugin-next|swc-[^/]+)$/.test(packagePath)) continue
      nextPackages.push(packagePath)
      if (metadata.version !== frameworkVersion) errors.push(`${appName}: ${packagePath.slice("node_modules/".length)} resolves to ${metadata.version}, expected ${frameworkVersion}.`)
    }
    for (const required of ["node_modules/@next/env", "node_modules/@next/eslint-plugin-next"]) {
      if (!nextPackages.includes(required)) errors.push(`${appName}: lockfile is missing ${required.slice("node_modules/".length)}.`)
    }
    if (!nextPackages.some((packagePath) => packagePath.startsWith("node_modules/@next/swc-"))) errors.push(`${appName}: lockfile contains no platform SWC package for Next.js ${frameworkVersion}.`)
    details.push(`${appName}: Next.js ecosystem ${frameworkVersion}; React ${app.manifest.dependencies?.react}/${app.manifest.dependencies?.["react-dom"]}.`)
  }

  const webReact = apps.web?.manifest.dependencies?.react
  const adminReact = apps.admin?.manifest.dependencies?.react
  const webReactDom = apps.web?.manifest.dependencies?.["react-dom"]
  const adminReactDom = apps.admin?.manifest.dependencies?.["react-dom"]
  if (webReact !== adminReact || webReactDom !== adminReactDom) errors.push(`React mismatch: web uses ${webReact}/${webReactDom}; admin uses ${adminReact}/${adminReactDom}.`)

  return { errors, details, acceptedAdvisories: policy.acceptedAdvisories ?? [] }
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8"))
}

async function main() {
  const policy = await readJson("scripts/dependency-governance-policy.json")
  const apps = {}
  for (const appName of ["web", "admin"]) {
    apps[appName] = {
      manifest: await readJson(`${appName}/package.json`),
      lock: await readJson(`${appName}/package-lock.json`),
    }
  }
  const report = inspectDependencyGovernance(apps, policy)
  for (const detail of report.details) console.log(detail)
  if (report.acceptedAdvisories.length) {
    console.log("Accepted advisories requiring review:")
    for (const advisory of report.acceptedAdvisories) console.log(`- ${advisory.id} [${advisory.severity}] ${advisory.package}: ${advisory.decision}; review by ${advisory.reviewBy}. ${advisory.reason}`)
  }
  if (report.errors.length) {
    console.error("Dependency governance check failed:")
    for (const error of report.errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }
  console.log("Dependency governance check passed.")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
