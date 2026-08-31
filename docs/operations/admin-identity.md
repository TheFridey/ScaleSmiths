# Admin identity operations

ScaleSmiths admin identities are stored in PostgreSQL `admin_users`. There is no public signup route. Roles are `owner`, `administrator`, `sales`, `project_manager`, `developer`, `finance`, and `viewer`.

## Initial migration and bootstrap

Run the admin migration before deploying the new authentication code, then bootstrap the existing configured admin:

```bash
docker compose -f docker-compose.host-nginx.yml run --rm admin-migrate
docker compose -f docker-compose.host-nginx.yml run --rm admin-bootstrap
```

`admin:bootstrap` reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optional `ADMIN_DISPLAY_NAME`. It creates an active owner only when that normalized email does not already exist. Re-running it is safe and leaves the existing database identity unchanged. The existing configured password is bcrypt-hashed before insertion; an existing bcrypt hash can be supplied directly. For compatibility, bootstrap warns but preserves a legacy value shorter than the new 12-character policy. Reset that password immediately after first login. Plaintext passwords are never stored.

After successful bootstrap and login verification, remove `ADMIN_PASSWORD` from long-lived production configuration if it is not needed for another controlled bootstrap. Authentication no longer reads it during normal login.

## User administration

Owners and administrators can list and create internal users, change roles, enable/disable accounts, and revoke sessions at `/users`. Only owners can create owners or reset passwords. Password reset immediately increments the session version. Disabling an account also revokes its sessions. The final active owner cannot be disabled or demoted, and an actor cannot disable their own account.

Client portal identities are a separate authority surface at `/portal-users`. Owners, administrators, and project managers can list accounts, issue explicitly client-linked activation invitations, and change portal email/status; credential-reset invitations are limited to owners and administrators. These permissions do not grant access to `/users` or `/api/admin-users*`. Activation and reset use hashed, expiring, single-use tokens; the admin API does not create or return plaintext portal passwords. Portal account status changes affect only the external account; internal administrator status and sessions are handled only by the admin identity APIs.

Admin middleware runs in the Node runtime and reloads the authenticated identity for every protected request. A disabled account or mismatched session version is rejected across pages and APIs, not only on the user-management screen.

MFA state and security audits are persisted. See `admin-mfa.md` for enrolment, production enforcement, recovery codes, invalidation, and bootstrap grace operations.

## Emergency owner recovery

Recovery is an explicit command, not a web endpoint. Set temporary process environment variables, run the command once, then clear them from shell history/environment:

```bash
export ADMIN_RECOVERY_EMAIL='owner@scalesmiths.co.uk'
export ADMIN_RECOVERY_NAME='Emergency Owner'
export ADMIN_RECOVERY_PASSWORD='a-new-random-password-at-least-12-characters'
docker compose -f docker-compose.host-nginx.yml run --rm admin-bootstrap npm run admin:recover-owner
unset ADMIN_RECOVERY_EMAIL ADMIN_RECOVERY_NAME ADMIN_RECOVERY_PASSWORD
```

The recovery command transactionally creates the owner if absent or reactivates the matching identity, grants `owner`, replaces its bcrypt password hash, and increments its session version. It does not delete or demote other users. Audit VPS shell access separately because anyone able to run this command with database credentials can recover ownership.

## Deployment order and rollback

Deploy migration `0016_admin_identity` first, run the idempotent bootstrap, then start the new admin image. Do not start the new image against an unmigrated database. Rolling application code back is possible, but the old environment-only login model would ignore database disable/revocation state; treat rollback as a security-sensitive emergency operation.
