import { Client } from "pg"

const REQUIRED_ENVIRONMENT = "forge-v2-e2e"
const REQUIRED_MARKER = "scalesmiths-forge-v2-isolated-test-v1"
const ALLOWED_DATABASE_NAME = /(?:^|[_-])(e2e|test|isolated)(?:[_-]|$)/i
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "postgres"])

type VerifiedClaimSnapshot = {
  id: string
  status: string
}

function guardedDatabaseUrl() {
  if (process.env.SCALESMITHS_TEST_ENVIRONMENT !== REQUIRED_ENVIRONMENT) {
    throw new Error(`SCALESMITHS_TEST_ENVIRONMENT=${REQUIRED_ENVIRONMENT} is required for database-mutating E2E tests.`)
  }

  const value = process.env.WEB_DATABASE_URL
  if (!value) throw new Error("WEB_DATABASE_URL is required for database-mutating E2E tests.")

  const target = new URL(value)
  const databaseName = decodeURIComponent(target.pathname.slice(1))
  const host = target.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (!ALLOWED_HOSTS.has(host) || !ALLOWED_DATABASE_NAME.test(databaseName)) {
    throw new Error(`Refusing non-isolated E2E database target: ${host}/${databaseName}.`)
  }
  return value
}

async function assertFixtureMarker(client: Client) {
  const result = await client.query<{ marker: string }>(
    "select marker from public.scalesmiths_test_environment where marker = $1",
    [REQUIRED_MARKER],
  )
  if (result.rowCount !== 1) throw new Error("Isolated E2E database marker is missing.")
}

export async function withoutVerifiedPublicClaims<T>(run: () => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: guardedDatabaseUrl() })
  await client.connect()

  let snapshots: VerifiedClaimSnapshot[] = []
  try {
    await assertFixtureMarker(client)
    const result = await client.query<VerifiedClaimSnapshot>(
      "select id, status from public.public_claims where status = 'verified' order by id for update",
    )
    snapshots = result.rows
    if (snapshots.length > 0) {
      await client.query(
        "update public.public_claims set status = 'draft', updated_at = now() where id = any($1::text[])",
        [snapshots.map(({ id }) => id)],
      )
    }
    return await run()
  } finally {
    try {
      if (snapshots.length > 0) {
        await client.query(
          "update public.public_claims set status = 'verified', updated_at = now() where id = any($1::text[])",
          [snapshots.map(({ id }) => id)],
        )
      }
    } finally {
      await client.end()
    }
  }
}
