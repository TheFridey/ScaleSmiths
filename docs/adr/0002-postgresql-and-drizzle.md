# ADR 0002: PostgreSQL and Drizzle

- Status: Accepted
- Date: 2026-07-13

## Context

Both applications use PostgreSQL through one `DATABASE_URL`. Drizzle ORM schema definitions and migrations live independently in `web/` and `admin/`. The public app owns quote and portal tables; admin owns CRM, identity, Forge, economics, approvals, and deployment data, while some operational tables are shared.

## Decision

Continue using PostgreSQL with Drizzle ORM and per-application migration directories. Maintain the operational convention that production migrations run web first, then admin, unless a stage-specific migration note says otherwise.

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

Migrations must be reviewed carefully, especially for rollback compatibility. Integration tests should apply real migrations rather than recreating schema manually.

## Related Code or Documentation

- `web/src/lib/schema.ts`
- `admin/src/lib/schema.ts`
- `web/drizzle`
- `admin/drizzle`
- `docs/architecture/data-model.md`
- `docs/operations/postgres-integration-tests.md`
- `README.md#database-migrations`
