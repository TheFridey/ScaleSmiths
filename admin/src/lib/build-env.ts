export function isBuildPhaseWithoutDatabase(env: Partial<Record<string, string | undefined>> = process.env) {
  const isNextBuild = env.NEXT_PHASE === "phase-production-build" || env.npm_lifecycle_event === "build"
  return isNextBuild || !env.DATABASE_URL
}
