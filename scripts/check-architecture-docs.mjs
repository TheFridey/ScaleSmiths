import { readFileSync } from "node:fs"
import path from "node:path"

const requiredDocuments = {
  "current-architecture.md": [
    "1. System purpose",
    "3. Modular-monolith boundaries",
    "5. Trust boundaries",
    "6. Authentication flows",
    "8. Data ownership",
    "9. Database roles and principals",
    "11. Invoice and document immutability",
    "12. Forge execution, sandbox, and release path",
    "13. Deployment topology",
    "14. Backup and restore",
    "15. CI and security pipeline",
    "17. Current residual risks",
    "18. Retired historical risks",
    "19. Decisions not to revisit casually",
    "20. Recommended domain boundaries going forward",
  ],
  "system-overview.md": ["Public web application", "Admin application", "Authentication", "Tests and current coverage", "Audit findings"],
  "forge-workflow.md": ["Lifecycle", "Agents and outputs", "AI provider abstraction and budgets", "Artifact lifecycle", "Workspace and preview lifecycle"],
  "security-boundaries.md": ["Trust zones", "AI boundary", "Generated workspace boundary", "Preview and publication boundary", "Database boundary"],
  "deployment-topology.md": ["Supported Compose variants", "Images and migrations", "Nginx routing", "CI topology"],
  "data-model.md": ["Domain map", "Public/shared operational tables", "Forge tables", "Migration inventory", "Integrity and lifecycle gaps"],
  "rbac-policy.md": ["Capability matrix", "Enforcement", "Change control"],
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
