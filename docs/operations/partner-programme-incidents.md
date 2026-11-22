# Partner programme incident procedures

Partner-specific procedures that sit under the general [Production incident response](incident-response.md) runbook: declare, contain, diagnose, recover and close as described there. Every action below uses an existing control. None needs a new tool, a database edit by hand, or a production feature switch changed outside an approved decision.

Written for Project Aegis (B1.7). Nothing here is production-verified. Partner modules are dormant in production until the founders decide otherwise ([B1-7-RELEASE-DECISIONS.md](../expansion/empower/B1-7-RELEASE-DECISIONS.md)).

## Ground rules

- Never paste partner, applicant or client personal data into tickets, chats or AI tools. Refer to people by partner id or application id.
- Never edit `expansion_commission_ledger`, contracts, payment events, `partner_agreement_acceptances` or audit tables by hand. They are append-only or trigger-protected by design. Corrections go through the founder commands, which audit them.
- Logs carry no recipient addresses or message bodies. Do not turn on extra logging that would add them.

## Partner cannot sign in

1. Check the sign-in limiter first. It allows 5 attempts per IP and per identifier in 10 minutes (`LOGIN_RATE_LIMIT_MAX`). A locked-out partner waits for the window to pass. Do not clear `login_rate_limits` in production to help one person.
2. In Recruitment, check the partner's state: activated, suspended or revoked. A revoked partner is refused by design: revocation sets `active=false` and increments `session_version`.
3. If the partner is active, look for `RBAC denial` and auth failures in the admin logs for that user id. Password resets follow [Admin identity](admin-identity.md).
4. Never reactivate a revoked partner as a fix. Reactivation is a founder decision, recorded in the audit trail.

## Agreement unavailable or not shown as accepted

- Today and the agreement page derive state from the partner's own records (Aegis): *none*, *awaiting acceptance*, *accepted*, *update awaiting acceptance*, or *unavailable*. *Unavailable* means the issued version was withdrawn, superseded or passed its review date.
- **Unavailable:** a founder publishes the current version through the Content studio and reissues it from the agreement register (`reissue_agreement`). The partner then accepts it on `/partner/agreement`. Their earlier acceptances stay downloadable.
- **Partner says they accepted, but the state says otherwise:** compare the register's accepted version with the issued version. Never insert an acceptance. The database fixes version, digest and time only through the partner's own acceptance.
- **Download fails an integrity check (HTTP 409):** treat it as a security incident. The stored text no longer matches its recorded digest.

## Invitation or partner email failed

- Founders see undelivered partner email in **Needs your attention** (failed, or email switched on with no provider).
- The founder decision is recorded whether or not the email arrives. The email is a courtesy.
- An invitation link is shown once and never stored. To retry, issue a new invitation. Do not try to recover the old token.
- `not_configured` means `PARTNER_EMAIL_ENABLED=true` without `RESEND_API_KEY` or `RESEND_FROM`. Switch email back off, or complete AP-LR-04. Do not hand-craft emails containing tokens.

## Commission looks wrong to a partner

1. Do not adjust anything while investigating.
2. Reconcile the partner's ledger against verified payment events and the contract's snapshotted terms in the Commission centre. Conditional commission is potential only. Earned commission comes only from verified VAT-exclusive collections.
3. Learning, resources, objection copying, help requests, meeting preparation, prospect registration and a signed agreement never create commission. The Aegis guidance suite hashes the ledger before and after to prove this.
4. Make corrections through the existing refund or adjustment commands, with an evidence reference.

## Duplicate prospect

Registration refuses a business that already has a ScaleSmiths relationship, or whose domain or contact is suppressed: "This business already has an existing ScaleSmiths relationship." Ownership disputes are a founder decision, recorded against the opportunity. Never delete or reassign the other partner's opportunity in SQL.

## A partner feature is unexpectedly unavailable

Every partner module answers 404 while its switch is off, and its links disappear:

- `PARTNER_ACADEMY_ENABLED`
- `PARTNER_RESOURCE_CENTRE_ENABLED`
- `PARTNER_KNOWLEDGE_BASE_ENABLED`
- `PARTNER_OBJECTION_HANDLING_ENABLED`
- `PARTNER_UNIFIED_WORKSPACE_ENABLED`

First check the process environment of the running PM2 app (`pm2 env <id>`); do not rely on the checkout's `.env`. An unexpected **on** is the more serious finding. Switch it off and restart, then record the incident.

## Database outage

Follow [Production incident response](incident-response.md) and [Production backup and restore](backup-and-restore.md).

After any restore, re-provision the least-privilege roles and run `verify-postgres-privileges.mjs` before any application connects. The dump carries no grants, so the restricted roles cannot read anything until this is done (Aegis drill).

## Failed deployment

Use the rollback in [PM2 host deploy](pm2-host-deploy.md): recreate both PM2 apps pointing at the previous release tree, with its `SS_RELEASE_ID`. The Aegis rehearsal ran the previous release (`37995d2`) against the migrated schema (admin 0095 to 0097, web 0024) and confirmed it is forward-compatible. A code rollback therefore needs no schema change. Never reverse an applied migration automatically.

## Security incident involving partner data

Contain with revocation: the founder command `revoke_partner` disables the account, increments the session version and clears any open invitation.

Preserve `expansion_audit`, `admin_security_audit` and `partner_notifications`. Partner-to-partner exposure is the critical case. Capture the request ids and endpoints, then add a regression test like the isolation cases in `empower-guidance.integration.test.ts`.

## Backup failure

The backup timer's failure hook fires on any non-zero exit. A run is not recoverable until an isolated restore drill passes.

Until the off-host destination is approved and installed (`AP-AEGIS-BAK-01`), the only copies are on the host. Treat a host failure as data loss beyond the last copy taken off the host by hand.
