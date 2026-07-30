import test from "node:test"
import assert from "node:assert/strict"
import { inspectDependencyGovernance } from "./check-dependency-governance.mjs"

const policy = {
  reviewedFrameworkVersion: "15.5.22",
  criticalDependencies: {
    web: { next: "15.5.22", "eslint-config-next": "15.5.22", react: "18.3.1", "react-dom": "18.3.1" },
    admin: { next: "15.5.22", "eslint-config-next": "15.5.22", react: "18.3.1", "react-dom": "18.3.1", "next-auth": "5.0.0-beta.32" },
  },
  acceptedAdvisories: [{ id: "GHSA-example", severity: "moderate" }],
}

function app(dependencies, devDependencies = {}) {
  const packages = { "": { dependencies: { ...dependencies }, devDependencies: { ...devDependencies } } }
  for (const [name, version] of Object.entries({ ...dependencies, ...devDependencies })) packages[`node_modules/${name}`] = { version }
  packages["node_modules/@next/env"] = { version: "15.5.22" }
  packages["node_modules/@next/eslint-plugin-next"] = { version: "15.5.22" }
  packages["node_modules/@next/swc-linux-x64-gnu"] = { version: "15.5.22" }
  return { manifest: { dependencies, devDependencies }, lock: { packages } }
}

test("accepts aligned exact framework and authentication versions", () => {
  const web = app({ next: "15.5.22", react: "18.3.1", "react-dom": "18.3.1" }, { "eslint-config-next": "15.5.22" })
  const admin = app({ next: "15.5.22", react: "18.3.1", "react-dom": "18.3.1", "next-auth": "5.0.0-beta.32" }, { "eslint-config-next": "15.5.22" })
  const report = inspectDependencyGovernance({ web, admin }, policy)
  assert.deepEqual(report.errors, [])
  assert.equal(report.acceptedAdvisories[0].severity, "moderate")
})

test("reports unpinned critical dependencies and manifest-lock drift", () => {
  const web = app({ next: "^15.5.22", react: "18.3.1", "react-dom": "18.3.1" }, { "eslint-config-next": "15.5.22" })
  web.lock.packages[""].dependencies.next = "15.5.22"
  const admin = app({ next: "15.5.22", react: "18.3.1", "react-dom": "18.3.1", "next-auth": "5.0.0-beta.32" }, { "eslint-config-next": "15.5.22" })
  const report = inspectDependencyGovernance({ web, admin }, policy)
  assert(report.errors.some((error) => error.includes("differs between package.json")))
  assert(report.errors.some((error) => error.includes("must use an exact version")))
})

test("reports mismatched Next.js ecosystem and React versions", () => {
  const web = app({ next: "15.5.22", react: "18.3.1", "react-dom": "18.3.1" }, { "eslint-config-next": "15.5.22" })
  web.lock.packages["node_modules/@next/env"].version = "15.5.21"
  const admin = app({ next: "15.5.22", react: "18.2.0", "react-dom": "18.2.0", "next-auth": "5.0.0-beta.32" }, { "eslint-config-next": "15.5.22" })
  const report = inspectDependencyGovernance({ web, admin }, policy)
  assert(report.errors.some((error) => error.includes("@next/env")))
  assert(report.errors.some((error) => error.includes("React mismatch")))
})
