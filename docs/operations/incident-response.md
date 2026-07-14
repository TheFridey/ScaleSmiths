# Production incident response

Use this runbook for authentication compromise, client-data exposure, Forge/sandbox escape concerns, provider credential leakage, database failure, or a bad release. Preserve evidence and client isolation while restoring the smallest safe service surface.

## Declare and contain

- Name an incident lead, start an UTC timeline, assign severity and record the affected release, services, clients and projects.
- Stop deployments and Forge execution. Do not delete generated workspaces, containers, logs, audit rows or release records before evidence is captured.
- For suspected admin compromise, disable the identity or increment its session version, invalidate MFA when appropriate, and review `admin_security_audit` plus RBAC denial logs.
- For suspected provider or application-secret exposure, revoke the credential at its provider, replace the server-only value, restart affected services and verify no `NEXT_PUBLIC_*` variable exposed it.
- For generated-code concerns, stop previews and sandbox containers, preserve workspace/evidence hashes, and keep `generated-sites` private. Do not run the workspace locally.
- For client-data exposure, identify exact client IDs and query paths. Do not copy unrelated client rows into the incident workspace.

## Diagnose

1. Record `ERROR_MONITORING_RELEASE`/Git commit, active and previous release IDs, image digests and Nginx upstream state.
2. Capture bounded application, Nginx, PostgreSQL and release-manager logs. Redact secrets and client form bodies before sharing.
3. Verify public and token-protected admin health endpoints from the host.
4. Check migration history, failed transactions, Forge activity logs, deployment-candidate hashes, release-gate decisions and AI budget reservations.
5. For SSRF or prompt-injection concerns, retain the source URL/artifact identifiers and safe hashes; do not paste untrusted page content into operational prompts.

## Recover

- Prefer the atomic application rollback in [Canary release and rollback](canary-release-and-rollback.md). Validate the previous slot before switching.
- Restore PostgreSQL only when application rollback cannot safely read the migrated schema. Follow [Production backup and restore](backup-and-restore.md): take a fresh forensic bundle first where safe, restore into an explicitly confirmed isolated database, compare both journals, review the evidence/RTO, and record the exact recovery point before any production replacement.
- Restore `generated-sites` separately from its backup and verify ownership, canonical paths and candidate hashes before allowing Forge access.
- Never install the bundle's `.env`, Nginx archive, release state, or image selection directly from the automated drill root. Promotion is a separate incident-lead decision with checksum and ownership verification.
- Rotate `AUTH_SECRET` only with an explicit all-session revocation plan. Preserve `MFA_ENCRYPTION_KEY` and `ANALYTICS_CREDENTIAL_ENCRYPTION_KEY` unless compromise requires rotation; losing them makes stored ciphertext unreadable.
- Re-enable Forge/provider calls only after budget reservations, sandbox runner, dependency/release gates and provider credentials are verified.

## Verify and close

- Exercise admin authentication/MFA, RBAC denial, portal client scoping, quote submission, Forge read-only views and health endpoints.
- Confirm monitoring, structured logs, backups and alerting are receiving current-release signals without sensitive payloads.
- Document impact, root cause, containment, data/client scope, credential rotations, recovery evidence and follow-up owners.
- Notify affected clients or regulators only through the approved legal/incident process; do not infer reporting obligations from this technical runbook.
- Add a regression test or operational check for the failure mode and set a dated review for every deferred action.

## Emergency contacts and access

Keep the incident lead, VPS/Cloudflare/PostgreSQL/provider account owners and legal contact in the private operations vault, not this repository. Emergency owner recovery is documented in [Admin identity](admin-identity.md); use it only from an audited host session and clear temporary recovery variables immediately.
