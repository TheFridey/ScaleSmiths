import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const BLOCKED_STORAGE_IMPORT = /from\s+["']@\/lib\/(?:db|schema)["']/
const COMPOSITION_ROOTS = [
  "admin/src/app/(protected)/dashboard/page.tsx",
  "admin/src/app/(protected)/clients/page.tsx",
]
const PUBLIC_READ_APIS = [
  "admin/src/lib/server/acquisition-read-service.ts",
  "admin/src/lib/server/client-read-service.ts",
  "admin/src/lib/server/delivery-read-service.ts",
  "admin/src/lib/server/finance-read-service.ts",
  "admin/src/lib/server/reporting-read-service.ts",
  "admin/src/lib/server/sales-read-service.ts",
]

export function validateDomainBoundaries(root) {
  const failures = []
  for (const relative of COMPOSITION_ROOTS) {
    const source = read(root, relative, failures)
    if (source && BLOCKED_STORAGE_IMPORT.test(source)) failures.push(`${relative} must compose domain server APIs, not import database storage directly.`)
  }
  for (const app of ["admin", "web"]) {
    const components = path.join(root, app, "src", "components")
    for (const file of sourceFiles(components)) {
      const source = fs.readFileSync(file, "utf8")
      if (BLOCKED_STORAGE_IMPORT.test(source)) failures.push(`${slash(path.relative(root, file))} is UI and must not import database storage directly.`)
    }
  }
  for (const relative of PUBLIC_READ_APIS) {
    const source = read(root, relative, failures)
    if (source && !/^import\s+["']server-only["']/m.test(source)) failures.push(`${relative} must remain server-only.`)
  }
  return failures
}

function read(root, relative, failures) {
  const file = path.join(root, relative)
  if (!fs.existsSync(file)) { failures.push(`${relative} is a required domain boundary.`); return "" }
  return fs.readFileSync(file, "utf8")
}

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(target)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : []
  })
}

function slash(value) { return value.replaceAll("\\", "/") }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const failures = validateDomainBoundaries(root)
  if (failures.length) {
    console.error(`Domain boundary check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`)
    process.exitCode = 1
  } else console.log("Domain boundary check passed: UI and selected composition roots depend on server-only domain APIs.")
}
