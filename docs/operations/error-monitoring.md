# Error monitoring integration

ScaleSmiths exposes a vendor-neutral, server-side monitoring contract. Admin/Forge uses `admin/src/lib/server/monitoring.ts`; the independently built web image uses the smaller equivalent in `web/src/lib/server-monitoring.ts`. Neither application sends events until a provider adapter is registered and `ERROR_MONITORING_PROVIDER` is not `none`.

## Capabilities

The admin contract supports exception and message capture, actor context, project/task/stage context, breadcrumbs, scoped async context, release metadata, and deployment environment. Provider failures are contained and never change application control flow. The web contract covers privacy-safe quote and client-request email failures.

Current integration boundaries are:

- Forge AI provider attempts, retry/fallback context, provider and model;
- Forge job/task queue, execution and database transaction failures;
- workspace creation and file-write failures without file contents;
- local/Docker QA sandbox command failures and preview startup failures;
- admin authentication rejection, rate limiting, and internal verification failures;
- sales proposal AI failures that trigger deterministic fallback;
- public quote and client-request Resend configuration/delivery failures.

## Privacy controls

Events are sanitised before reaching an adapter. Passwords, authorization, cookies, sessions, credentials, tokens, API/private/access keys, forms, request bodies, prompts, provider response bodies, generated source, file contents, and workspace file collections are removed. Secret-shaped values in messages and stacks are redacted. Integrations send identifiers, stages, categories, status, retry counts, timings, and safe operation names—not client submissions or generated code.

Adapters must apply their own `beforeSend`/event-processor allowlist as defence in depth. Do not attach `process.env`, HTTP bodies, provider request/response objects, prompts, workspace archives, command stdout/stderr, or database rows.

## Environment

```dotenv
ERROR_MONITORING_PROVIDER=none
ERROR_MONITORING_DSN=
ERROR_MONITORING_RELEASE=
ERROR_MONITORING_ENVIRONMENT=production
ERROR_MONITORING_SAMPLE_RATE=1
```

All values are server-owned. Never prefix the DSN or monitoring configuration with `NEXT_PUBLIC_`. Although some vendors describe browser DSNs as public identifiers, this implementation is server-only and treats configuration as private operational data.

## Registering a production adapter

Install the provider SDK in each application that will emit events, then register a thin adapter during server instrumentation/bootstrap. Keep vendor imports inside that adapter. For Sentry, the adapter maps the neutral event to an isolated scope:

```ts
registerErrorMonitoringProvider({
  captureException(error, event) {
    Sentry.withScope((scope) => {
      scope.setUser(event.actor ?? null)
      scope.setContext("scalesmiths", event.context)
      scope.setTag("environment", event.environment)
      if (event.release) scope.setTag("release", event.release)
      for (const breadcrumb of event.breadcrumbs) scope.addBreadcrumb(breadcrumb)
      Sentry.captureException(error)
    })
  },
  captureMessage(message, event) {
    Sentry.withScope((scope) => {
      scope.setContext("scalesmiths", event.context)
      Sentry.captureMessage(message, event.level === "warning" ? "warning" : event.level)
    })
  },
})
```

The example is intentionally adapter code, not an application dependency. Configure the SDK DSN, release, environment, sample rate, transport, and shutdown flush in the bootstrap. Register the web adapter separately with `registerWebErrorMonitoringProvider` because web and admin are separate Docker build contexts.

## Production checklist

1. Create a server-only project in the selected monitoring provider.
2. Install and lock the provider SDK in `admin` and, if email monitoring is required, `web`.
3. Implement adapters using the contracts above and register them from server instrumentation.
4. Set the five environment variables in the root VPS `.env`; use an immutable release identifier such as the Git SHA.
5. Add provider-side scrubbing and retention rules.
6. Trigger a synthetic server error in staging and verify project/task/request context without prompts, credentials, client forms, or generated source.
7. Verify monitoring outages do not alter authentication, Forge, proposal, or email behaviour.

With no registered adapter or `ERROR_MONITORING_PROVIDER=none`, capture calls remain no-ops. A production adapter should also refuse to initialise when its required DSN/configuration is missing.
