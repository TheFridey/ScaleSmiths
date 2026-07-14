# Error monitoring and alerting

ScaleSmiths uses provider-neutral, server-side monitoring contracts with a concrete Sentry adapter in both independently built Next.js applications. Admin and Forge use `admin/src/lib/server/monitoring.ts`; web uses `web/src/lib/server-monitoring.ts`. `src/instrumentation.ts` is the single startup registration point in each application. Capture remains a safe no-op when monitoring is disabled or misconfigured, and adapter failures are contained.

## Configuration

Runtime configuration is server-only:

```dotenv
ERROR_MONITORING_PROVIDER=sentry
ERROR_MONITORING_DSN=
ERROR_MONITORING_RELEASE=
ERROR_MONITORING_ENVIRONMENT=staging
ERROR_MONITORING_SAMPLE_RATE=1
MONITORING_SELF_TEST_TOKEN=
```

`ERROR_MONITORING_RELEASE` must be the approved full Git SHA (40 hexadecimal characters; a reviewed 64-character content SHA is also accepted). Production startup deliberately leaves monitoring misconfigured rather than attaching an ambiguous mutable release. The operational release/slot identifier remains `SS_RELEASE_ID`; health endpoints expose it separately.

For source-map upload during a release build, export these only in the release-manager process environment:

```dotenv
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_WEB_PROJECT=
SENTRY_ADMIN_PROJECT=
```

Do not put the Sentry auth token in either runtime container. Compose explicitly clears `SENTRY_AUTH_TOKEN` and `LOG_SHIPPING_TOKEN` inside application containers. The release manager passes the Sentry token to Docker BuildKit as a secret, while organisation/project/release identifiers are non-secret build arguments. The Sentry build plugin uploads source maps, deletes them from the built assets after upload, and disables source-map generation/upload when complete build credentials are absent. Never expose the auth token through an `ARG`, image layer, build log, `NEXT_PUBLIC_` variable, or checked-in environment file.

## Data boundary

The neutral layer recursively redacts sensitive keys and secret-shaped values. The Sentry adapter then uses an allowlist: application, environment, release, request/correlation ID, actor ID, project/task/stage, provider/model, artifact/job IDs, safe operation/category, retry/fallback, duration and status fields. The final `beforeSend` hook strips request headers, cookies, query strings, bodies, extras, source context and generated-workspace frames. Only an authenticated account identifier may be sent as actor context; login email submissions are not actor IDs.

Never add prompts, AI request or response objects, provider bodies, generated code, workspace files, contact/client form bodies, database rows, credentials, cookies, authorisation headers, MFA/encryption keys, `process.env`, or command stdout/stderr. Sentry project-side data-scrubbing rules are additional defence, not a replacement for the code allowlist.

Both applications generate or propagate `x-request-id` and return it on responses. Web quote and client-request email failures include it; admin request scopes add actor/project/task/stage identifiers when available. Sentry events carry `application`, `environment`, `release` and the safe correlated fields as tags.

## Staging verification

1. Create separate Sentry projects for web and admin, enable provider-side secret scrubbing, restrict project membership, and set the approved retention period.
2. Build both images through `scripts/release-manager.mjs` with the approved SHA and the BuildKit source-map variables above. Inspect the resulting image and public static assets to confirm no `.map` files or upload token are present.
3. Deploy to staging with `ERROR_MONITORING_PROVIDER=sentry`, the project DSN, approved SHA, `ERROR_MONITORING_ENVIRONMENT=staging`, and a random self-test token of at least 32 characters.
4. Confirm `/api/health` reports `monitoring.status=ready` for web and the token-protected admin endpoint.
5. Send a non-crashing self-test to each application:

   ```bash
   curl --fail-with-body -X POST -H "x-monitoring-self-test-token: $MONITORING_SELF_TEST_TOKEN" https://staging.example/api/monitoring/self-test
   curl --fail-with-body -X POST -H "x-monitoring-self-test-token: $MONITORING_SELF_TEST_TOKEN" https://admin-staging.example/api/monitoring/self-test
   ```

6. Require HTTP `202` and record the returned event ID. Verify the event has the correct application/environment/release and request ID, then inspect its raw payload to prove there are no headers, cookies, query values, forms, prompts, provider bodies, source context or code.
7. Temporarily block outbound access to the Sentry ingest host in staging and repeat an ordinary request. The request must retain its normal application result. Because SDK capture is queued, the self-test can still return `202`; absence of that event in Sentry is the delivery-failure evidence. A synchronous adapter exception returns `503 delivery_failed`.
8. Repeat the self-test after every SDK/configuration change and after the production traffic switch. The self-test is an informational monitoring event and never intentionally throws.

## Alert policy

Create alerts in Sentry or the durable log destination and link each to an owned runbook. Start with the following thresholds, then tune from measured staging/production baselines without suppressing single critical integrity events.

| Signal | Suggested trigger | Primary evidence and response |
| --- | --- | --- |
| Repeated 5xx | Five server errors for one application/route in five minutes, or an error-rate anomaly | Sentry `application`, `routePath`, `errorCategory=unhandled_request`, release and request ID; check health, database and latest release. |
| Quote email delivery | Any `emailOperation=quote_notification` and `errorCategory=email_delivery`; warning after two configuration events | Confirm the stored quote remains present, inspect Resend status without copying form content, and arrange manual follow-up. |
| Failed Forge jobs | Any failed job event; page after three in ten minutes or one deployment/QA integrity job | Use `projectId`, `taskId`, `jobId`, `forgeStage` and release; keep task quality and release gates blocked. |
| Exhausted AI budgets | Any `errorCategory=budget_exceeded`; warn at configured dashboard threshold before exhaustion | Verify database reservations/reconciliation and intended limits. Never raise a hard limit during incident triage without authorised approval. |
| Sandbox failures | Any `sandboxRunner` failure; page on repeated failures across projects | Inspect bounded QA logs and host capacity. Never switch production from Docker to local execution. |
| Deployment failure | Any non-zero release-manager operation, failed health/Nginx validation, or missing success record after a scheduled change | Preserve the previous slot, deployment log and images; follow canary rollback. |
| Database connectivity | Two failed internal health/database checks in one minute, or clustered `database_transaction`/connection events | Check PostgreSQL container/volume/network and connection saturation; do not run ad-hoc migrations. |
| Backup failure | Any `BACKUP_FAILURE_HOOK` event, missed verified point beyond RPO, off-host failure, or overdue restore drill | Follow backup/restore runbook; do not claim recovery until an isolated restore is evidenced. |

Alert notifications must contain identifiers and links, not event bodies or client data. Route paging to the current operator/owner, define a secondary contact, test notification delivery quarterly, and review noisy alerts with a recorded threshold change.

## Durable logs

Monitoring events do not replace structured operational logs. Follow [Structured application logging](logging.md) to install the provider-neutral Vector shipping example, configure searchable/archive retention, alert on ingestion failure, and keep the Docker socket out of the collector. Container stdout alone is not a recovery or audit record.

## Disabled and failure behaviour

`ERROR_MONITORING_PROVIDER=none` is an intentional no-op. Any other unsupported provider, a missing DSN/release, or a non-SHA production release reports `misconfigured` without preventing application startup. Provider initialisation/capture failures never alter authentication, Forge, email, proposal, or public request control flow. Treat a production `misconfigured` health result as an operational release blocker.
