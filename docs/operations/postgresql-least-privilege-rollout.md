# PostgreSQL least-privilege rollout

This is an operator-run, staged change. Do not run it directly against production until it has passed against an isolated restore of the latest verified backup.

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
6. Run the PostgreSQL integration suite and manually verify public quote/portal flows, admin login, client analytics ingestion, Forge task execution and backup validation.
7. Deploy application containers with dedicated URLs. Confirm each container has unrelated URLs blanked using names only; never print their values.
8. Revoke or remove the legacy runtime `DATABASE_URL` from production after both applications are healthy.

## Production rollout

Use the same sequence during a change window: verified backup, first provisioning pass, web migration, admin migration, second provisioning pass, runtime deployment, health checks. Production must not start a runtime with a migration credential. Keep the prior application images and environment file available through the existing encrypted rollback process.

## Verification

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

Grant rollback, when the data remains sound, is performed by correcting the URLs and rerunning `postgres-provision`; it recalculates ownership and grants idempotently. Never edit an applied migration or disable RLS as an informal rollback.
