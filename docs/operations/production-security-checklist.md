# Production security checklist

This checklist is a release gate for the supported Docker Compose and host-Nginx topology. Record evidence and an owner for every exception. Cloudflare-specific detail remains in [Cloudflare Access and admin origin hardening](cloudflare-access.md#production-security-checklist).

## Before deployment

- [ ] CI, security workflows, migration verification, web/admin lint, tests and production builds pass for the exact commit.
- [ ] The real PostgreSQL integration suite passes with web then admin migrations against a disposable empty database.
- [ ] `npm audit --omit=dev --audit-level=high` reports no high or critical production vulnerabilities; reviewed lower findings are recorded.
- [ ] `npm run check:dependency-governance` passes; critical pins, lockfile changes, accepted advisories and Docker digest updates follow the [dependency-governance process](dependency-governance.md).
- [ ] `AUTH_SECRET`, `PORTAL_SECRET`, `MFA_ENCRYPTION_KEY`, `ANALYTICS_CREDENTIAL_ENCRYPTION_KEY`, database, email and provider credentials are generated values in the secret store—not example values.
- [ ] Bootstrap/recovery passwords have been removed from long-lived environment configuration after use.
- [ ] Owner and administrator MFA enforcement is active; any bootstrap grace deadline is short, documented and scheduled for removal.
- [ ] Cloudflare Access protects admin, origin firewall rules are active, forwarding headers are overwritten by trusted Nginx, and the public site remains reachable.
- [ ] `FORGE_SANDBOX_RUNNER=docker`; Docker socket is not mounted; generated sites are private; network/resource limits match the threat model.
- [ ] Forge AI hard limits, database reservations, provider keys and fallback behavior are configured and tested without live client data.
- [ ] Immutable deployment candidate hashes and all server-side release gates pass. No dependency-policy, security, accessibility or fallback override is implicit.
- [ ] The complete [backup scope](backup-and-restore.md) has an encrypted off-host recovery point within the RPO; the latest isolated restore evidence matches both journals, meets RTO, and has human approval.
- [ ] A server-side monitoring adapter is registered and a staging synthetic event includes release/request context without secrets or prompts.
- [ ] Release notes, backward-compatible migration plan, rollback plan, actor and observation window are approved.

## Deployment and verification

- [ ] Run web migrations then admin migrations; never run the two histories concurrently.
- [ ] Prepare the inactive release, validate both internal health endpoints and inspect bounded container logs.
- [ ] Test Nginx configuration before the atomic switch; preserve the previous healthy slot.
- [ ] After switching, verify public routes, admin login/MFA, portal isolation, quote/contact flow and critical Forge read-only screens.
- [ ] Confirm release metadata in logs/monitoring, migration state, budget reservations and background jobs.
- [ ] Keep the previous release and database backup until the observation window closes.

## Incident readiness

- [ ] Operators can access [Production incident response](incident-response.md) and [Canary release and rollback](canary-release-and-rollback.md) without relying on the failing application.
- [ ] Provider/VPS/Cloudflare/database account ownership and escalation contacts are current in the private operations vault.
- [ ] Audit and release logs have retention and backup appropriate to the incident policy.
- [ ] The backup failure hook, daily timer, monthly restore timer, off-host object lock/lifecycle, recovery-key owner, and drill database owner have been tested without exposing secrets.
