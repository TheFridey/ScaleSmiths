# Forge V2 production validation

This checklist is an operator record, not evidence until completed, timestamped, and linked to retained outputs. Never mark a check passed from CI alone.

## Pre-deployment

- [ ] Record change authorisation, maintenance window, exact application SHA, immutable image digests, operators, approver, and communications channel.
- [ ] Validate production host, DNS, TLS, Cloudflare/origin restrictions, disk/memory, PostgreSQL version/capacity, secret ownership, and required environment variables without printing values.
- [ ] Create and verify an encrypted pre-release backup; confirm off-host copy, provenance, retention, and recovery-key ownership.
- [ ] Complete and approve the production-derived isolated restore drill for that backup.
- [ ] Run the guarded migration verifier on the isolated restore; review web-then-admin journal changes and schema diff.
- [ ] Validate `nginx -t`, inactive release configuration, upstream ports, health endpoints, and rollback target without switching traffic.
- [ ] Confirm rollback image/schema compatibility, previous release health, release-manager state, and named rollback authority.
- [ ] Confirm Sentry project/routing, provider budgets/health, worker monitoring, and queue observability. Do not make destructive or billable provider calls.
- [ ] Review public visual baselines and authenticated admin desktop, 1366×768, tablet, and 390×844 evidence; record human acceptance separately.

## Deployment

- [ ] Reconfirm target environment and exact SHA immediately before change.
- [ ] Place the release in the approved maintenance/write-control state and pause new Forge work without discarding queued evidence.
- [ ] Record pre-change worker heartbeat and queue depth; ensure workers cannot consume jobs during incompatible migration state.
- [ ] Run the shared migrator; capture both journal states and stop on any unexpected delta.
- [ ] Start immutable web/admin images in the inactive slot and validate local health before traffic switching.
- [ ] Run `nginx -t`, switch traffic only through the reviewed release procedure, then verify the effective upstream and TLS path.

## Post-deployment

- [ ] Confirm public and admin health endpoints, application SHA, container digests, database connectivity, and no crash loop.
- [ ] Authenticate with an approved operator account; verify MFA/session behaviour and RBAC denial/allowance with non-destructive actions.
- [ ] Confirm worker heartbeat, expected queue depth/change, retry/dead-letter state, and absence of unexpected restored or historical job processing.
- [ ] Confirm provider-health indicators without sending real email, WhatsApp, payments, or unnecessary AI requests.
- [ ] Perform one authorised non-destructive Forge action, such as opening an existing project/run and preview; do not deploy generated output.
- [ ] Smoke-test public desktop and mobile navigation, quote/contact paths without submission, assets, and approved visual meaning.
- [ ] Trigger the approved safe Sentry test event; confirm receipt, environment, release SHA, alert route, and absence of secrets or personal data.
- [ ] Observe logs, errors, latency, resource use, queue health, provider health, and user-impact metrics for the approved observation period.
- [ ] Attach evidence, defects, timestamps, and named operator/reviewer sign-off. Record human release approval separately.

## Rollback triggers and execution

Rollback is triggered by failed health/auth/RBAC, migration inconsistency, sustained error or latency breach, worker/queue malfunction, provider side effects, data-integrity loss, security-control regression, or inability to observe the release safely.

- [ ] Stop new Forge work and preserve logs, failed jobs, artifact evidence, database state, and the trigger timestamp.
- [ ] Notify the release/incident lead and execute the reviewed traffic rollback to the previous healthy immutable release.
- [ ] Revalidate public/admin health, auth/RBAC, Nginx, worker/queue state, and Forge read-only access.
- [ ] If schema compatibility prevents application rollback, do not improvise a down migration. Follow the authorised recovery decision and tested backup procedure.
- [ ] Record incident reference, rollback SHA/digests, database action, recovery time, residual defects, and sign-off.

## Sign-off record

| Field | Recorded value |
| --- | --- |
| Environment and final SHA | |
| Pre-deployment operator/time | |
| Deployment operator/time | |
| Post-deployment reviewer/time | |
| Observation window | |
| Evidence references | |
| Defects/waivers | |
| Rollback invoked and reason | |
| Human release approver/time | |
