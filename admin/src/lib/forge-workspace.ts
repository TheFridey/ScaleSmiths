export const FORGE_GENERATED_SITES_DIR = "generated-sites"
export const FORGE_WORKSPACE_MEMORY_KEY = "generated_site_workspace"
export const FORGE_WORKSPACE_TEMPLATE = "next-ts-tailwind"

export interface ForgeWorkspaceMetadata {
  projectId: number
  slug: string
  relativePath: string
  template: typeof FORGE_WORKSPACE_TEMPLATE
  fileCount: number
  createdAt: string
  updatedAt: string
}

export interface ForgeWorkspaceProject {
  id: number
  name: string
  businessName: string
  status?: string | null
}

export type WorkspacePathResult = { ok: true; path: string } | { ok: false; error: string }

const EXECUTABLE_EXTENSIONS = [".sh", ".bash", ".zsh", ".ps1", ".bat", ".cmd", ".exe", ".com", ".msi", ".vbs", ".js"] as const
const CORE_APP_SEGMENTS = new Set(["admin", "web", "nginx", "scripts", ".git", ".idea", ".next", "node_modules"])
const ALLOWED_ROOT_FILES = new Set([
  "package.json",
  "package-lock.json",
  "next.config.mjs",
  "next-env.d.ts",
  "tsconfig.json",
  "postcss.config.mjs",
  "tailwind.config.ts",
  "README.md",
])
const ALLOWED_TOP_LEVEL_DIRS = new Set(["src", "public", "docs"])
const DANGEROUS_FILENAMES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".npmrc",
  ".yarnrc",
  ".pnpmrc",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "credentials",
  "credentials.json",
  "service-account.json",
  "service_account.json",
  "google-credentials.json",
])
const DANGEROUS_EXTENSION_PATTERNS = [/\.(pem|key|p12|pfx|crt|cer|kdb|jks)$/i]
const DESTRUCTIVE_SHELL_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\brm\s+-fr\b/i,
  /\bdel\s+\/[fsq]/i,
  /\brmdir\s+\/s\b/i,
  /\bRemove-Item\b[^\n]*(?:-Recurse|-Force)/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-fd\b/i,
  /\bformat\s+[a-z]:/i,
  /\bdd\s+if=/i,
]
const UNKNOWN_OUTBOUND_PATTERNS = [
  /\bfetch\s*\(\s*["']https?:\/\//i,
  /\baxios\.(?:get|post|put|patch|delete)\s*\(\s*["']https?:\/\//i,
  /\bnavigator\.sendBeacon\s*\(\s*["']https?:\/\//i,
]
const SECRET_REQUEST_PATTERNS = [
  /\bprocess\.env\.(?!RESEND_API_KEY\b|NEXT_PUBLIC_)[A-Z0-9_]+/i,
  /\bOPENAI_API_KEY\b/i,
  /\bANTHROPIC_API_KEY\b/i,
  /\bWHATSAPP_ACCESS_TOKEN\b/i,
  /\bSTRIPE_SECRET_KEY\b/i,
  /\bPRIVATE_KEY\b/i,
  /\bBEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY\b/i,
]

export function buildForgeWorkspaceSlug(project: ForgeWorkspaceProject) {
  const base = `${project.businessName || project.name || "forge-project"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "forge-project"

  return `${project.id}-${base}`
}

export function buildForgeWorkspaceRelativePath(project: ForgeWorkspaceProject) {
  return `${FORGE_GENERATED_SITES_DIR}/${buildForgeWorkspaceSlug(project)}`
}

export function normalizeForgeWorkspacePath(input: string): WorkspacePathResult {
  if (typeof input !== "string" || !input.trim()) return { ok: false, error: "File path is required." }
  if (input.includes("\0")) return { ok: false, error: "File path contains an invalid character." }
  if (/^[a-zA-Z]:/.test(input) || input.startsWith("/") || input.startsWith("\\")) return { ok: false, error: "Absolute paths are not allowed." }

  const normalized = input.replace(/\\/g, "/").split("/").filter(Boolean)

  if (normalized.length === 0) return { ok: false, error: "File path is required." }
  if (normalized.some((segment) => segment === "." || segment === "..")) return { ok: false, error: "Path traversal is not allowed." }
  if (CORE_APP_SEGMENTS.has(normalized[0])) return { ok: false, error: "Generated files cannot target ScaleSmiths app directories." }

  return { ok: true, path: normalized.join("/") }
}

export function assertForgeWorkspaceFileAllowed(relativePath: string, content = "", options: { allowExecutableScripts?: boolean } = {}): WorkspacePathResult {
  const normalized = normalizeForgeWorkspacePath(relativePath)
  if (!normalized.ok) return normalized
  const safePath = normalized.path

  const allowlisted = assertForgeWorkspacePathAllowlisted(safePath)
  if (!allowlisted.ok) return allowlisted

  const safeName = assertForgeWorkspaceFilenameSafe(safePath)
  if (!safeName.ok) return safeName

  const safeContent = assertForgeWorkspaceContentSafe(safePath, content)
  if (!safeContent.ok) return safeContent

  if (!options.allowExecutableScripts && isExecutableWorkspaceFile(safePath, content)) {
    return { ok: false, error: "Executable scripts require explicit approval." }
  }

  return normalized
}

export function assertForgeWorkspacePathAllowlisted(relativePath: string): WorkspacePathResult {
  const normalized = normalizeForgeWorkspacePath(relativePath)
  if (!normalized.ok) return normalized
  const [first] = normalized.path.split("/")
  if (ALLOWED_ROOT_FILES.has(normalized.path) || ALLOWED_TOP_LEVEL_DIRS.has(first)) return normalized
  return { ok: false, error: "Generated files must stay within the approved workspace file allowlist." }
}

export function assertForgeWorkspaceFilenameSafe(relativePath: string): WorkspacePathResult {
  const normalized = normalizeForgeWorkspacePath(relativePath)
  if (!normalized.ok) return normalized
  const segments = normalized.path.split("/")
  const filename = segments[segments.length - 1].toLowerCase()
  if (DANGEROUS_FILENAMES.has(filename)) return { ok: false, error: "Dangerous secret or credential filenames are not allowed in generated workspaces." }
  if (DANGEROUS_EXTENSION_PATTERNS.some((pattern) => pattern.test(filename))) return { ok: false, error: "Private key and credential file extensions are not allowed in generated workspaces." }
  return normalized
}

export function assertForgeWorkspaceContentSafe(relativePath: string, content = ""): WorkspacePathResult {
  const normalized = normalizeForgeWorkspacePath(relativePath)
  if (!normalized.ok) return normalized

  if (SECRET_REQUEST_PATTERNS.some((pattern) => pattern.test(content))) {
    return { ok: false, error: "Generated files may not request or embed server secrets." }
  }

  if (UNKNOWN_OUTBOUND_PATTERNS.some((pattern) => pattern.test(content))) {
    return { ok: false, error: "Generated files may not phone home to unknown external domains." }
  }

  if (DESTRUCTIVE_SHELL_PATTERNS.some((pattern) => pattern.test(content))) {
    return { ok: false, error: "Generated scripts may not run destructive shell commands." }
  }

  return normalized
}

export function isExecutableWorkspaceFile(relativePath: string, content = "") {
  const lower = relativePath.toLowerCase()
  if (EXECUTABLE_EXTENSIONS.some((extension) => lower.endsWith(extension))) return true

  if (lower.endsWith("package.json")) {
    try {
      const parsed = JSON.parse(content) as { scripts?: unknown }
      return typeof parsed.scripts === "object" && parsed.scripts !== null
    } catch {
      return /"scripts"\s*:/.test(content)
    }
  }

  return false
}

export function canDeleteForgeWorkspace(project: ForgeWorkspaceProject) {
  return project.status === "archived" || /\b(test|demo|sandbox)\b/i.test(`${project.name} ${project.businessName}`)
}

export function readForgeWorkspaceMemory(value: string | null | undefined): ForgeWorkspaceMetadata | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<ForgeWorkspaceMetadata>
    if (
      typeof parsed.projectId === "number" &&
      typeof parsed.slug === "string" &&
      typeof parsed.relativePath === "string" &&
      parsed.relativePath.startsWith(`${FORGE_GENERATED_SITES_DIR}/`) &&
      parsed.template === FORGE_WORKSPACE_TEMPLATE &&
      typeof parsed.fileCount === "number" &&
      typeof parsed.createdAt === "string" &&
      typeof parsed.updatedAt === "string"
    ) {
      return parsed as ForgeWorkspaceMetadata
    }
  } catch {
    return null
  }

  return null
}
