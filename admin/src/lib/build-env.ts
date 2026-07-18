export function isBuildPhaseWithoutDatabase(env: Partial<Record<string, string | undefined>> = process.env) {
  const isNextBuild = env.NEXT_PHASE === "phase-production-build" || env.npm_lifecycle_event === "build"
  const hasRuntimeDatabase = Boolean(env.ADMIN_DATABASE_URL || (env.NODE_ENV !== "production" && env.DATABASE_URL))
  return isNextBuild || !hasRuntimeDatabase
}
