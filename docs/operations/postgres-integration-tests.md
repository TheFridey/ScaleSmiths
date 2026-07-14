# PostgreSQL integration tests

The admin integration suite uses PostgreSQL 16 and the repository's real `web/drizzle` and `admin/drizzle` migration histories. It does not mock the database module.

## Local one-command run

From the repository root:

```sh
npm run test:integration
```

This starts `docker-compose.integration-test.yml` under the isolated Compose project `scalesmiths-integration-test`, waits for PostgreSQL, runs the suite, then removes its container, network, and tmpfs data in a `finally` block. It does not share the normal ScaleSmiths Compose project or volume.

The default connection is:

```text
postgresql://scalesmiths_test:scalesmiths_test_only@127.0.0.1:55432/scalesmiths_integration_test
```

Override `TEST_POSTGRES_PORT` and `TEST_DATABASE_URL` together when port 55432 is unavailable.

## Existing disposable PostgreSQL

From `admin`:

```sh
TEST_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/my_integration_test npm run test:integration
```

The suite destroys and recreates the target database's `public` schema. The safety validator therefore accepts only PostgreSQL URLs on `localhost`, loopback, or the named `postgres-integration` CI service, and requires a database name with a distinct `test` or `integration` segment. It refuses development/production names and all remote hosts.

## Coverage and isolation

The sequential suite verifies empty-database migration, critical schema consistency, idempotent owner bootstrap, password authentication persistence, persisted RBAC roles, Forge project creation, task execution/quality separation, activity metadata, artifact parent/version/supersession lineage, approval history, budget reservation/reconciliation, a real concurrent budget race, and transaction rollback.

The schema is recreated before the suite and application tables are truncated with identity reset before every test. Connections close in `afterAll`; the root runner removes the disposable service even when tests fail. Test credentials are fixed local-only values and are not application secrets.

## GitHub Actions

The required `CI / Database and Migrations` job provisions a PostgreSQL 16 service named `scalesmiths_integration_test`, tests the migration-consistency policy, checks both journal/file histories, and runs `npm run test:integration` from `admin`. The suite recreates the schema and applies both migration histories itself, avoiding a redundant pre-application step. Migration and integration output is retained as the `database-migration-logs` artifact. Fork pull requests receive no production database URL or repository secret.
