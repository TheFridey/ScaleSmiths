const GENERATED_WORKSPACE_ENV_ALLOWLIST = [
  "PATH",
  "Path",
  "PATHEXT",
  "SYSTEMROOT",
  "SystemRoot",
  "COMSPEC",
  "ComSpec",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "npm_config_cache",
  "npm_config_user_agent",
  "npm_config_prefix",
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_CONFIG",
] as const

type ForgeProcessEnvInput = Partial<Record<string, string | undefined>>

const GENERATED_WORKSPACE_DEFAULTS: ForgeProcessEnvInput = {
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  BROWSER: "none",
}

export function buildForgeGeneratedProcessEnv(source: ForgeProcessEnvInput = process.env, extra: ForgeProcessEnvInput = {}): NodeJS.ProcessEnv {
  const env: ForgeProcessEnvInput = { ...GENERATED_WORKSPACE_DEFAULTS }

  for (const key of GENERATED_WORKSPACE_ENV_ALLOWLIST) {
    if (source[key]) env[key] = source[key]
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) env[key] = value
  }

  return env as NodeJS.ProcessEnv
}
