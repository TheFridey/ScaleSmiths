# PostgreSQL least-privilege rollout

This is an operator-run, staged change. Do not run it directly against production until it has passed against an isolated restore of the latest verified backup.

## Intended privilege model

All application objects in `public` and both Drizzle journals in `drizzle` are owned by the migration role. Neither runtime is an owner. `PUBLIC` receives no database, schema, application relation, sequence, or application-function privilege. Managed login roles do not inherit other roles and are `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`; only the backup login has `BYPASSRLS`.

| Principal | Database/schema | Tables and views | Sequences/functions | Explicitly forbidden |
| --- | --- | --- | --- | --- |
| Migration owner (`MIGRATION_DATABASE_URL`) | Owns the database plus `public`/`drizzle`; `CONNECT`, `CREATE`, `TEMPORARY`; creates and alters objects | Owns all application and journal relations; applies web then admin histories | Owns application sequences/functions/types | Long-running application use; provisioning roles; bypassing the ordered migration process |
| Web runtime (`WEB_DATABASE_URL`) | `CONNECT`; `USAGE` on `public`; no `CREATE`, `TEMPORARY`, or `drizzle` access | Exact operations from `postgres-privilege-policy.mjs`; no private admin/Forge/journal access; no `DELETE`, `TRUNCATE`, `REFERENCES`, or `TRIGGER` | `USAGE`/`SELECT` only on sequences backing tables into which web inserts; no application-function execution | Ownership, DDL, role management, cross-domain access, migration access |
| Admin runtime (`ADMIN_DATABASE_URL`) | `CONNECT`; `USAGE` on `public`; no `CREATE`, `TEMPORARY`, or `drizzle` access | `SELECT`, `INSERT`, `UPDATE` on public application relations; `DELETE` only on the five lifecycle tables declared in policy; no `TRUNCATE`, `REFERENCES`, or `TRIGGER` | `USAGE`/`SELECT` on public sequences; execute only the reviewed `digest` and `gen_random_uuid` functions when present | Ownership, DDL, role management, journal access, undeclared row deletion |
| Forge worker | No separate principal today; the instrumentation-started worker is part of admin | Same admin DML boundary | Same admin sequence/function boundary | Generated workspaces receive no database URL; a future separate worker must have a new explicit policy before deployment |
| Read-only operator (`READONLY_DATABASE_URL`, optional) | `CONNECT`; `USAGE` on `public`/`drizzle`; no `CREATE` or `TEMPORARY`; no RLS bypass | `SELECT` only | No sequence or application-function privileges | DML, DDL, ownership, role membership, RLS bypass |
| Backup (`BACKUP_DATABASE_URL`, optional) | `CONNECT`; `USAGE`; no `CREATE` or `TEMPORARY`; `BYPASSRLS` only for complete dumps | `SELECT` only across `public`/`drizzle` | `SELECT` only on sequences; no application-function execution | DML, DDL, ownership, role management, application runtime, restore |
| Provisioning operator (`POSTGRES_PROVISIONING_DATABASE_URL`) | Dedicated superuser used only for role attributes, ownership transfer and grant repair | Not an application identity | Not supplied to runtime or generated code | Long-running containers and ordinary application operations |

Production restore has no standing production “restore role”. Restore targets use a separately controlled credential for the explicitly confirmed isolated database. Any replacement of production remains a human-gated incident action; the read-only backup role cannot perform it.

Development tooling is deliberately outside this model. `admin/scripts/seed-forge-demo.mjs` rewrites Forge project rows and needs `DELETE` on Forge tables that the admin runtime role does not hold; it refuses to run when `NODE_ENV=production` rather than failing mid-transaction on a permission error. `admin/scripts/test-database.mjs` is similarly gated by `assertIsolatedAdminTestDatabase`. Neither is a production operational procedure, and neither justifies widening the admin grant.

## Required secrets

Generate distinct, random passwords and store these URLs in the protected production environment file:

- `WEB_DATABASE_URL` using a dedicated web login
- `ADMIN_DATABASE_URL` using a dedicated admin login
- `MIGRATION_DATABASE_URL` using the migration-owner login
- `POSTGRES_PROVISIONING_DATABASE_URL` using a dedicated, operator-controlled PostgreSQL superuser; it must not be any application, migration, read-only or backup role
- optional `READONLY_DATABASE_URL`
- `BACKUP_DATABASE_URL` using a dedicated backup login when the backup framework is enabled

Keep `POSTGRES_PROVISIONING_DATABASE_URL` out of long-running containers and operator shell history where possible. Prefer a root-readable environment file. The provisioning command logs role names and the target host/database, never passwords.

## Staging sequence

1. Create and validate a fresh encrypted PostgreSQL backup and record its recovery identifier.
2. Restore it into an isolated staging database and configure all URLs to target only that restore.
3. Build the tool image, then provision principals and schema ownership:

   ```bash
   cd /var/www/scalesmiths/ScaleSmiths
   docker compose -f docker-compose.host-nginx.yml --profile tools run --rm postgres-provision
   ```

4. Apply histories in the required order with the migration credential:

   ```bash
   docker compose -f docker-compose.host-nginx.yml --profile tools run --rm web-migrate
   docker compose -f docker-compose.host-nginx.yml --profile tools run --rm admin-migrate
   ```

5. Run `postgres-provision` again. This applies audited grants to objects introduced by the migrations and is safe to repeat.
6. Verify PostgreSQL catalogs against the executable policy:

   ```bash
   docker compose -f docker-compose.host-nginx.yml --profile tools run --rm postgres-verify
   ```

7. Run the PostgreSQL integration suite and manually verify public quote/portal flows, admin login, client analytics ingestion, Forge task execution and backup validation.
8. Deploy application containers with dedicated URLs. Confirm each container has unrelated URLs blanked using names only; never print their values.
9. Revoke or remove the legacy runtime `DATABASE_URL` from production after both applications are healthy.

## Production rollout

Use the same sequence during a change window: verified backup, first provisioning pass, web migration, admin migration, second provisioning pass, runtime deployment, health checks. Production must not start a runtime with a migration credential. Keep the prior application images and environment file available through the existing encrypted rollback process.

## Verification

`npm run test:postgres-privileges` is the CI/disposable proof. It starts real PostgreSQL 16, provisions distinct principals, applies both real migration histories in web-then-admin order, reprovisions grants, and queries PostgreSQL catalogs and effective `has_*_privilege` results. It verifies:

- role attributes and absence of inherited memberships;
- database and schema owners;
- database `CONNECT`/`CREATE`/`TEMPORARY` rights;
- schema `USAGE`/`CREATE` rights;
- ownership and exact effective privileges for every table/view and sequence in `public` and `drizzle`;
- forbidden `TRUNCATE`, `REFERENCES`, `TRIGGER`, DDL, and journal access;
- reviewed function execution only;
- migration-owner default privileges for future tables, sequences, and functions.

The harness then injects three real grants in turn, and for each one confirms verification fails naming the exact privilege, reruns provisioning, and confirms the grant is removed:

- `CREATE ON SCHEMA public` to admin, covering DDL drift;
- `DELETE ON public.clients` to admin, covering destructive drift outside the declared lifecycle tables;
- `INSERT ON public.clients` to web, covering write drift on a read-only table.

It therefore tests both detection and recovery using PostgreSQL itself rather than mocked ACL data. Readiness is proven by an authenticated connection from the host through the published port, because container-local `pg_isready` answers over the Unix socket while the image is still in its init phase.

For an already provisioned environment, run the non-mutating verifier through `postgres-verify` as shown above. It logs only role names and host/database identifiers, never passwords or full URLs. Save its exit status and bounded output with release evidence.

- Public quote submission and portal authentication work.
- Admin authentication, CRM and Forge reads/writes work.
- Client analytics for one client does not return another client's rows.
- Web login cannot select `admin_users` and cannot create a table.
- Admin login cannot create a table or write `drizzle.__drizzle_migrations`.
- Both migration journal tables are owned by the migration role.
- A backup bundle made with the backup role contains protected analytics tables.

Do not include passwords or complete connection strings in evidence. Record role names, database/host, commands, timestamps and pass/fail only.

## Rollback

Application rollback does not require reverting migration `0044`; older analytics code does not set tenant context and would therefore fail closed on protected analytics tables. If application rollback must restore analytics availability, deploy the previous application only with a tightly controlled migration-owner connection as an emergency measure, or use the isolated restore procedure below. Do not grant schema ownership to a runtime role.

Preferred rollback:

1. Stop new writes through the normal maintenance procedure.
2. Restore the verified pre-change backup into an isolated target and validate it.
3. If the production database itself must be restored, follow the human-gated restore runbook and incident process.
4. Restore the encrypted prior environment file and previous images.
5. Re-run health, authentication, portal, Forge and backup checks.

Grant recovery, when the data remains sound, is performed as follows:

1. Stop or restrict application writes if the drift grants destructive or cross-domain access.
2. Preserve a catalog-only evidence report without passwords and identify the actor/change that introduced drift.
3. Correct role URLs if necessary and rerun `postgres-provision`. It revokes managed database, schema, table, sequence, function, and default privileges before rebuilding the declared model, and transfers application ownership back to migration.
4. Run `postgres-verify`; do not restart affected runtimes until it passes.
5. Exercise representative web, portal, admin, Forge, migration-journal and backup operations.
6. Rotate a credential if it was exposed or used by the wrong workload. Revoke unexpected role memberships separately before verification.

If object ownership or data integrity is uncertain, stop and use the isolated restore/incident procedure instead of improvising grants. Never make a runtime user an owner, edit an applied migration, disable RLS, or grant a runtime the migration connection as a shortcut.
