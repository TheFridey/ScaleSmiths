const allowedNames = /(?:^|[_-])(e2e|test|isolated)(?:[_-]|$)/i
const refusedNames = new Set(["postgres", "template0", "template1", "scalesmiths"])
const allowedHosts = new Set(["127.0.0.1", "localhost", "::1", "postgres"])

export function assertIsolatedTestDatabase(databaseUrl, environmentMarker) {
  if (environmentMarker !== "forge-v2-e2e") {
    throw new Error("SCALESMITHS_TEST_ENVIRONMENT=forge-v2-e2e is required.")
  }
  if (!databaseUrl) throw new Error("An isolated WEB_DATABASE_URL is required.")

  const target = new URL(databaseUrl)
  const databaseName = decodeURIComponent(target.pathname.slice(1))
  const host = target.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (!allowedHosts.has(host)) throw new Error(`Refusing non-local test database host: ${host}.`)
  if (!allowedNames.test(databaseName) || refusedNames.has(databaseName.toLowerCase())) {
    throw new Error(`Refusing database without an isolated test name: ${databaseName}.`)
  }
  return { target, databaseName, host }
}
