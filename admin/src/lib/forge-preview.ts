export const FORGE_PREVIEW_MEMORY_KEY = "generated_site_preview"
export const FORGE_PREVIEW_METHOD = "local-next-dev"
export const FORGE_DOCKER_PREVIEW_METHOD = "docker-next-dev"

export type ForgePreviewMethod = typeof FORGE_PREVIEW_METHOD | typeof FORGE_DOCKER_PREVIEW_METHOD
export type ForgePreviewStatus = "stopped" | "starting" | "running" | "failed"
export type ForgePreviewViewport = "desktop" | "tablet" | "mobile"

export interface ForgePreviewState {
  projectId: number
  status: ForgePreviewStatus
  method: ForgePreviewMethod
  url: string | null
  host: string
  port: number | null
  pid: number | null
  workspacePath: string | null
  startedAt: string | null
  stoppedAt: string | null
  updatedAt: string
  error: string | null
}

export interface ForgePreviewEnv {
  FORGE_PREVIEW_HOST?: string
  FORGE_PREVIEW_PORT_BASE?: string
  FORGE_ALLOW_PUBLIC_PREVIEWS?: string
}

export const FORGE_PREVIEW_VIEWPORTS: Record<ForgePreviewViewport, { label: string; width: number; height: number }> = {
  desktop: { label: "Desktop", width: 1440, height: 900 },
  tablet: { label: "Tablet", width: 820, height: 1180 },
  mobile: { label: "Mobile", width: 390, height: 844 },
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"])

export function defaultForgePreviewState(projectId: number, workspacePath: string | null = null): ForgePreviewState {
  const now = new Date().toISOString()
  return {
    projectId,
    status: "stopped",
    method: FORGE_PREVIEW_METHOD,
    url: null,
    host: resolveForgePreviewHost({}),
    port: null,
    pid: null,
    workspacePath,
    startedAt: null,
    stoppedAt: null,
    updatedAt: now,
    error: null,
  }
}

export function readForgePreviewMemory(value: string | null | undefined): ForgePreviewState | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<ForgePreviewState>
    if (
      typeof parsed.projectId === "number" &&
      isPreviewStatus(parsed.status) &&
      isPreviewMethod(parsed.method) &&
      typeof parsed.host === "string" &&
      (typeof parsed.port === "number" || parsed.port === null) &&
      (typeof parsed.url === "string" || parsed.url === null) &&
      (typeof parsed.pid === "number" || parsed.pid === null) &&
      (typeof parsed.workspacePath === "string" || parsed.workspacePath === null) &&
      typeof parsed.updatedAt === "string"
    ) {
      return {
        projectId: parsed.projectId,
        status: parsed.status,
        method: parsed.method,
        url: parsed.url ?? null,
        host: parsed.host,
        port: parsed.port ?? null,
        pid: parsed.pid ?? null,
        workspacePath: parsed.workspacePath ?? null,
        startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
        stoppedAt: typeof parsed.stoppedAt === "string" ? parsed.stoppedAt : null,
        updatedAt: parsed.updatedAt,
        error: typeof parsed.error === "string" ? parsed.error : null,
      }
    }
  } catch {
    return null
  }

  return null
}

export function resolveForgePreviewHost(env: ForgePreviewEnv) {
  const configured = env.FORGE_PREVIEW_HOST?.trim() || "127.0.0.1"
  const allowPublic = env.FORGE_ALLOW_PUBLIC_PREVIEWS === "true"
  if (allowPublic) return configured
  return LOOPBACK_HOSTS.has(configured) ? configured : "127.0.0.1"
}

export function resolveForgePreviewPortBase(env: ForgePreviewEnv) {
  const parsed = Number(env.FORGE_PREVIEW_PORT_BASE)
  return Number.isInteger(parsed) && parsed >= 1024 && parsed <= 65000 ? parsed : 4300
}

export function buildForgePreviewUrl(host: string, port: number) {
  const safeHost = host === "::1" ? "[::1]" : host
  return `http://${safeHost}:${port}`
}

export function canExposeForgePreviewHost(host: string, env: ForgePreviewEnv) {
  return LOOPBACK_HOSTS.has(host) || env.FORGE_ALLOW_PUBLIC_PREVIEWS === "true"
}

function isPreviewStatus(value: unknown): value is ForgePreviewStatus {
  return value === "stopped" || value === "starting" || value === "running" || value === "failed"
}

function isPreviewMethod(value: unknown): value is ForgePreviewMethod {
  return value === FORGE_PREVIEW_METHOD || value === FORGE_DOCKER_PREVIEW_METHOD
}
