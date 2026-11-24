# Partner activation runbook (Operation EMPOWER B2.10)

**Requires explicit founder approval before any step that touches the VPS.** B2.10 was prepared without VPS access; nothing here has been executed in production. Release mechanics follow [ASCEND-OPERATOR-RUNBOOK.md](../ascend/ASCEND-OPERATOR-RUNBOOK.md) §6. Do not bypass the release approval process or the drift check.

## 0. What this release changes

- **Migration 0105** `expansion_onboarding_progress`: one new append-only table (partner acknowledgements).
- **Migration 0106**:
  - adds `partner_password_resets` and `partner_application_withdrawals`, which store SHA-256 token digests only, with expiry enforced by CHECK constraints;
  - replaces the `partner_notifications` kind constraint with a strict superset that adds `password_reset` and `withdrawal_confirmation`.
- Both migrations are additive and rewrite no data. Journal: admin 107 entries.
- Both were rehearsed on PostgreSQL 14.25 with least-privilege checks: the web role cannot read either token table.
- Partner workspace: new journey ("Getting started"), overview summary with empty states, grouped navigation, Coming soon page, meeting-type preselection.
- Founder workspace: "Partner onboarding" command centre (checklist per partner, toolkit requests).
- Partner API: two new actions, `acknowledge_onboarding_step` and `request_toolkit_item` (records intent as `awaiting_approval`; never overwrites a founder record).
- Public endpoints `/api/partner/password-reset` and `/api/partner/withdraw`, with pages `/partner/reset` and `/partner/withdraw`:
  - unauthenticated, but same-origin only, rate-limited and limited to 8 KB requests;
  - deliver links only when `PARTNER_EMAIL_ENABLED=true` and Resend is configured.
- Founder: consolidated content review queue; waiting-on-founders queue and applicant pipeline in Partner onboarding.
- Drift check now governs 13 partner switches.
- Knowledge-base drafts: 14 new partner-programme entries (drafts only; import is a separate, explicit step).

Nothing in this release sends a message, moves money, changes commission, publishes content or an agreement, activates a partner, or alters ASCEND or Megaton behaviour.

## 1. Fresh backup (mandatory)

`pg_dump -Fc` with the provisioning superuser URL to `/var/backups/scalesmiths/pre-b2-10-<ts>-<sha>/`, `sha256sum` the dump and write `RELEASE-NOTE.txt`. Confirm the dump restores with `pg_restore --list`.

## 2. Read the live switches (names and booleans only)

On the VPS, in the live release directory, print each switch in [PRODUCTION-FEATURE-MATRIX.md](PRODUCTION-FEATURE-MATRIX.md) as `name=true|false|unset` (never print secrets; for `RESEND_API_KEY` print presence only). Record the result in `evidence/b2-10/production-switches.txt`.

## 3. Synchronise the canonical `.env`

Copy the approved values for every governed switch into the canonical `.env`, then:

```bash
node scripts/check-release-env-drift.mjs /var/www/scalesmiths/.env <release>/.env
```

It must print `No drift in governed switches.` before building.

## 4. Build, migrate, start

1. Build web and admin from the release SHA with `node --env-file=../.env ./node_modules/next/dist/bin/next build`.
2. `npm run db:migrate` (applies 0105 only). Then re-run `admin/scripts/provision-postgres-roles.mjs --confirm-provision` and `verify-postgres-privileges.mjs`; the new table needs the application role's grants.
3. Start on the alternate ports, health-check, switch nginx, keep the previous release for rollback.

## 5. Content import (drafts only)

Dry run first, against production only with founder approval:

```bash
EMPOWER_IMPORT_DATABASE_URL=<provisioning URL> node admin/scripts/import-empower-curriculum.mjs --founder-email <founder> --allow-database
```

Then with `--confirm-import`. Everything arrives as a draft; founders review and publish in **Founder workspace → Content** ([CONTENT-PUBLICATION-REGISTER.md](CONTENT-PUBLICATION-REGISTER.md)).

## 6. Activate in order

Follow the numbered order in [PRODUCTION-FEATURE-MATRIX.md](PRODUCTION-FEATURE-MATRIX.md). `PARTNER_ACTIVATION_ENABLED=true` only after [FOUNDER-LAUNCH-CHECKLIST.md](FOUNDER-LAUNCH-CHECKLIST.md) item 1 is complete. Restart admin after each batch and re-run the drift check.

## 7. Production verification (controlled synthetic partner)

Use a founder-owned test mailbox, never a real applicant. Record evidence in `evidence/b2-10/`.

1. Submit an application at `/partners`; confirm the confirmation email (if `PARTNER_EMAIL_ENABLED`).
2. Founder: review → approve in principle → agreement pending → onboarding with all four confirmations → issue invitation.
3. Open the invitation link, preview, accept the agreement, set a password, sign in.
4. Getting started shows 1/4 (agreement accepted); acknowledge the three steps; progress shows 100%; sign out and back in, still 100%.
5. Register a test prospect, request a technical assistance meeting, create a referral code, request an email address; confirm the founder command centre shows the progress and the toolkit request.
5a. Request a password reset for the synthetic partner at `/partner/reset`; use the emailed link; confirm the old session is signed out and the new password works.
5b. Submit a second synthetic application, then withdraw it at `/partner/withdraw` with the emailed link; confirm the founder Recruitment tab shows it as withdrawn.
6. As a second synthetic partner, confirm none of the first partner's data is visible, and `/expansion` is refused.
7. Clean up: decline/withdraw the synthetic application, suspend the synthetic partner user. Do not create financial records.

## 8. Rollback

- Application: switch nginx back to the previous release.
- Database: none needed. 0105 adds one unused-by-old-code table; the previous release ignores it. Do not drop it (its rows are an audit record).
- Switches: set any switch back to its previous value and restart; records are retained.
