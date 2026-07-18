type DatabaseEnvironment = Partial<Record<string, string | undefined>>

export function isProductionBuild(env: DatabaseEnvironment = process.env) {
  return env.NEXT_PHASE === "phase-production-build" || env.npm_lifecycle_event === "build"
}

export function resolveAdminDatabaseUrl(env: DatabaseEnvironment = process.env) {
  if (env.ADMIN_DATABASE_URL) return env.ADMIN_DATABASE_URL
  if (env.NODE_ENV === "production") {
    if (isProductionBuild(env)) return undefined
    throw new Error("ADMIN_DATABASE_URL is required for the admin runtime in production. DATABASE_URL is only supported for local development and tests.")
  }
  return env.DATABASE_URL
}

export function resolveMigrationDatabaseUrl(env: DatabaseEnvironment = process.env) {
  if (env.MIGRATION_DATABASE_URL) return env.MIGRATION_DATABASE_URL
  if (env.NODE_ENV === "production") {
    throw new Error("MIGRATION_DATABASE_URL is required for production migrations. DATABASE_URL is only supported for local development and tests.")
  }
  return env.DATABASE_URL
}
