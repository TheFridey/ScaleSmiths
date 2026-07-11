export const FORGE_SANDBOX_RUNNERS = ["local", "docker"] as const
export const FORGE_SANDBOX_NETWORK_MODES = ["none", "bridge"] as const

export type ForgeSandboxRunner = (typeof FORGE_SANDBOX_RUNNERS)[number]
export type ForgeSandboxNetworkMode = (typeof FORGE_SANDBOX_NETWORK_MODES)[number]

export interface ForgeSandboxConfig {
  runner: ForgeSandboxRunner
  dockerImage: string
  cpus: string
  memory: string
  network: ForgeSandboxNetworkMode
  installNetwork: ForgeSandboxNetworkMode
  previewNetwork: ForgeSandboxNetworkMode
  previewInternalPort: number
  pidsLimit: number
  user: string
}

export interface ForgeDockerRunOptions {
  workspaceRoot: string
  command: string
  config: ForgeSandboxConfig
  network?: ForgeSandboxNetworkMode
  detached?: boolean
  name?: string
  publish?: {
    host: string
    hostPort: number
    containerPort: number
  }
}

const DEFAULT_DOCKER_IMAGE = "node:22-bookworm-slim"

export function resolveForgeSandboxConfig(env: Partial<Record<string, string | undefined>> = process.env): ForgeSandboxConfig {
  return {
    runner: env.FORGE_SANDBOX_RUNNER === "docker" ? "docker" : "local",
    dockerImage: env.FORGE_SANDBOX_DOCKER_IMAGE?.trim() || DEFAULT_DOCKER_IMAGE,
    cpus: normalizeCpus(env.FORGE_SANDBOX_CPUS),
    memory: normalizeMemory(env.FORGE_SANDBOX_MEMORY),
    network: normalizeNetwork(env.FORGE_SANDBOX_NETWORK, "none"),
    installNetwork: normalizeNetwork(env.FORGE_SANDBOX_INSTALL_NETWORK, "none"),
    previewNetwork: normalizeNetwork(env.FORGE_SANDBOX_PREVIEW_NETWORK, "bridge"),
    previewInternalPort: normalizePort(env.FORGE_SANDBOX_PREVIEW_INTERNAL_PORT, 3000),
    pidsLimit: normalizeInteger(env.FORGE_SANDBOX_PIDS_LIMIT, 128, 16, 512),
    user: /^\d+:\d+$/.test(env.FORGE_SANDBOX_USER ?? "") ? env.FORGE_SANDBOX_USER! : "1000:1000",
  }
}

export function buildForgeDockerRunArgs(options: ForgeDockerRunOptions) {
  const network = options.network ?? options.config.network
  const args = [
    "run",
    "--rm",
    "--cpus",
    options.config.cpus,
    "--memory",
    options.config.memory,
    "--pids-limit",
    String(options.config.pidsLimit),
    "--user",
    options.config.user,
    "--read-only",
    "--init",
    "--ulimit",
    `nproc=${options.config.pidsLimit}:${options.config.pidsLimit}`,
    "--ulimit",
    "nofile=1024:1024",
    "--tmpfs",
    "/tmp:rw,noexec,nosuid,nodev,size=128m",
    "--tmpfs",
    "/home/node:rw,noexec,nosuid,nodev,size=32m",
    "--network",
    network,
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "-e",
    "NODE_ENV=production",
    "-e",
    "NEXT_TELEMETRY_DISABLED=1",
    "-e",
    "BROWSER=none",
    "-v",
    `${options.workspaceRoot}:/workspace:rw`,
    "-w",
    "/workspace",
  ]

  if (options.detached) args.push("-d")
  if (options.name) args.push("--name", options.name)
  if (options.publish) {
    args.push("-p", `${options.publish.host}:${options.publish.hostPort}:${options.publish.containerPort}`)
  }

  args.push(options.config.dockerImage, "sh", "-lc", options.command)
  return args
}

export function buildForgeDockerStopArgs(containerIdOrName: string) {
  return ["stop", containerIdOrName]
}

function normalizeNetwork(value: string | undefined, fallback: ForgeSandboxNetworkMode): ForgeSandboxNetworkMode {
  return value === "bridge" || value === "none" ? value : fallback
}

function normalizeCpus(value: string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 8 ? String(parsed) : "1"
}

function normalizeMemory(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase()
  if (trimmed && /^\d+(?:m|g)$/.test(trimmed)) return trimmed
  return "1024m"
}

function normalizePort(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1024 && parsed <= 65000 ? parsed : fallback
}
function normalizeInteger(value:string|undefined,fallback:number,min:number,max:number){const parsed=Number(value);return Number.isInteger(parsed)&&parsed>=min&&parsed<=max?parsed:fallback}

export function appendBoundedSandboxLog(current:string, chunk:string, maxBytes=64_000){const next=current+chunk;if(Buffer.byteLength(next,"utf8")<=maxBytes)return{value:next,truncated:false};const tail=Buffer.from(next,"utf8").subarray(-Math.max(0,maxBytes-80)).toString("utf8");return{value:`[sandbox output truncated to ${maxBytes} bytes]\n${tail}`,truncated:true}}
