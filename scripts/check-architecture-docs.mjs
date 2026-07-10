import { readFileSync } from "node:fs"
import path from "node:path"

const requiredDocuments = {
  "system-overview.md": ["Public web application", "Admin application", "Authentication", "Tests and current coverage", "Audit findings"],
  "forge-workflow.md": ["Lifecycle", "Agents and outputs", "AI provider abstraction and budgets", "Artifact lifecycle", "Workspace and preview lifecycle"],
  "security-boundaries.md": ["Trust zones", "AI boundary", "Generated workspace boundary", "Preview and publication boundary", "Database boundary"],
  "deployment-topology.md": ["Supported Compose variants", "Images and migrations", "Nginx routing", "CI topology"],
  "data-model.md": ["Domain map", "Public/shared operational tables", "Forge tables", "Migration inventory", "Integrity and lifecycle gaps"],
}

const architectureRoot = path.resolve("docs", "architecture")
const failures = []

for (const [filename, requiredSections] of Object.entries(requiredDocuments)) {
  const filepath = path.join(architectureRoot, filename)
  let content = ""

  try {
    content = readFileSync(filepath, "utf8")
  } catch {
    failures.push(`${filename}: missing or unreadable`)
    continue
  }

  if (!content.includes("```mermaid")) failures.push(`${filename}: missing Mermaid diagram`)
  for (const section of requiredSections) {
    if (!content.includes(`## ${section}`)) failures.push(`${filename}: missing section "${section}"`)
  }
}

if (failures.length) {
  console.error("Architecture documentation check failed:")
  failures.forEach((failure) => console.error(`  - ${failure}`))
  process.exit(1)
}

console.log("Architecture documentation check passed.")
