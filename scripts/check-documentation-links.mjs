#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REQUIRED_CANONICAL_REFERENCES = new Map([
  ["README.md", "docs/operations/release-runbook.md"],
  ["docs/releases/README.md", "../operations/release-runbook.md"],
  ["docs/architecture/deployment-topology.md", "../operations/release-runbook.md"],
])

export function validateDocumentationLinks(documents, repositoryRoot) {
  const failures = []
  const byPath = new Map(documents.map((document) => [normalise(document.path), document.content]))

  for (const document of documents) {
    const sourcePath = normalise(document.path)
    const content = stripFencedCode(document.content)
    for (const target of markdownTargets(content)) {
      if (isExternalOrPageAnchor(target)) continue
      const targetWithoutAnchor = target.split("#", 1)[0].split("?", 1)[0]
      if (!targetWithoutAnchor) continue
      let decoded
      try {
        decoded = decodeURIComponent(targetWithoutAnchor.replace(/^<|>$/g, ""))
      } catch {
        failures.push(`[invalid-link] ${sourcePath} contains an invalid encoded target: ${target}`)
        continue
      }
      if (decoded.startsWith("/")) continue // Application routes are not documentation files.
      const resolved = path.resolve(repositoryRoot, path.dirname(sourcePath), decoded)
      const relative = normalise(path.relative(repositoryRoot, resolved))
      if (relative.startsWith("../") || path.isAbsolute(relative)) {
        failures.push(`[outside-repository] ${sourcePath} -> ${target}`)
      } else if (!existsSync(resolved)) {
        failures.push(`[broken-link] ${sourcePath} -> ${target}`)
      }
    }
  }

  for (const [source, target] of REQUIRED_CANONICAL_REFERENCES) {
    const content = byPath.get(source)
    if (!content) failures.push(`[canonical-reference] missing documentation source ${source}`)
    else if (!markdownTargets(stripFencedCode(content)).includes(target)) failures.push(`[canonical-reference] ${source} must link to ${target}`)
  }
  return failures
}

export function loadDocumentation(repositoryRoot) {
  const result = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "*.md"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
  return result.split("\0").filter(Boolean).map((file) => ({
    path: normalise(file),
    content: readFileSync(path.join(repositoryRoot, file), "utf8"),
  }))
}

function markdownTargets(content) {
  const targets = []
  for (const match of content.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+["'][^)]*["'])?\)/g)) targets.push(match[1].replace(/^<|>$/g, ""))
  for (const match of content.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)) targets.push(match[1].replace(/^<|>$/g, ""))
  for (const match of content.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) targets.push(match[1])
  return targets
}

function stripFencedCode(content) {
  return content.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1\s*$/gm, "")
}

function isExternalOrPageAnchor(target) {
  return target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//")
}

function normalise(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//, "")
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const failures = validateDocumentationLinks(loadDocumentation(repositoryRoot), repositoryRoot)
  if (failures.length) {
    console.error(`Documentation link check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`)
    process.exitCode = 1
    return
  }
  console.log("Documentation link check passed: internal file links resolve and canonical release references are present.")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
