# ADR 0002: PostgreSQL and Drizzle

- Status: Accepted
- Date: 2026-07-13

## Context

Both applications use one PostgreSQL database. Drizzle ORM schema definitions and migrations live independently in `web/` and `admin/`. The public app owns quote and portal tables; admin owns CRM, identity, Forge, economics, approvals, and deployment data, while some operational tables are shared. Production connections are split between least-privilege web/admin runtime roles and a migration owner; `DATABASE_URL` remains a local/test fallback.

## Decision

Continue using PostgreSQL with Drizzle ORM and per-application migration directories. Production migrations run web first, then admin. Treat committed migration SQL and historical journal entries as immutable; record checksums and make schema corrections in new forward migrations.

## Alternatives Considered

- Separate databases for public and admin.
- A shared schema package consumed by both apps.
- Prisma or another ORM.
- Raw SQL only.

## Consequences

PostgreSQL provides durable transactional state for authentication, Forge, budgets, provenance, and portal/client operations. Independent Drizzle histories keep each app deployable, but require manual coordination for shared tables and enums.

## Security Implications

Both apps currently share database credentials, so isolation is application-level rather than database-role-level. Schema drift or unsafe migrations can affect both public and admin systems.

## Operational Implications

Migrations must be reviewed carefully, especially for rollback compatibility. Integration tests apply real migrations through both clean-install and historical-upgrade paths rather than recreating schema manually. A guarded operator script records before/after schema and journal evidence against an isolated production-backup restore; it never replaces the human backup-restore exercise.

## Related Code or Documentation

- `web/src/lib/schema.ts`
- `admin/src/lib/schema.ts`
- `web/drizzle`
- `admin/drizzle`
- `docs/architecture/data-model.md`
- `docs/operations/postgres-integration-tests.md`
- `docs/operations/migration-history-and-backup-verification.md`
- `README.md#database-migrations`
