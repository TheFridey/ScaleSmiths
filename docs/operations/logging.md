# Structured application logging

The admin application and Forge use `admin/src/lib/server/logging.ts` for server-side structured logs. Production logs are one JSON object per line; development logs are readable text followed by JSON context.

## Levels and context

Use `debug` for detailed development/runtime state, `info` for completed lifecycle events, `warn` for recoverable degradation or retries, and `error` for failed operations requiring investigation.

```ts
const log = requestLogger({
  component: "forge-agent",
  projectId,
  taskId,
  forgeStage: "research",
})

log.info("Forge task completed", { durationMs, artifactId })
```

Supported context is intentionally open but common fields are `requestId`, `actorId`, `projectId`, `taskId`, `jobId`, `forgeStage`, `provider`, `model`, `artifactId`, `durationMs`, `errorCategory`, `retryCount`, `fallbackUsed`, and `environment`.

## Request correlation

Admin middleware accepts a syntactically safe `x-request-id` or generates a UUID. It forwards that ID to route handlers and returns it on responses, including redirects and authorization/rate-limit failures. Node route handlers can establish an async context with `withRequestLogContext`; nested job/provider logs then inherit the request and actor IDs. Background work without an active request receives a generated operation correlation ID.

Do not accept arbitrary correlation values: `normalizeRequestId` rejects whitespace, control characters, oversized values, and unsupported punctuation.

## Redaction

Every log entry is recursively redacted before output. Redacted keys include passwords, secrets, authorization, cookies, sessions, credentials, API/private/access keys, and authentication token fields. Common full form/body/payload keys are suppressed by default. Secret-shaped API keys, bearer values, and private-key blocks are also removed from free text. Circular objects, excessive depth, long strings, and very large arrays are bounded.

Redaction is a final safety control, not permission to log raw request/provider objects. Log identifiers, counts, statuses, timings, and safe summaries. Never attach provider response bodies, headers, client forms, generated source, or process environments.

## Error handling

`normalizeUnknownError` separates internal diagnostics from `safeMessage`:

- `message`, name, code, stack, cause, category, and retryability are retained for internal logs after redaction;
- `safeMessage` is the only message suitable for API responses;
- AI provider failures are logged with provider/model/project/task, retry, duration, and category, but never with response bodies or credentials.

Existing Forge error classes continue to control user-facing status and safe messages. Logging must not replace or broaden those responses.

## Production operations

JSON output is written to stdout/stderr for collection by Docker. Container output is transport, not retention. The reviewed provider-neutral shipping example is [`ops/monitoring/vector.yaml.example`](../../ops/monitoring/vector.yaml.example), with a hardened systemd unit at [`ops/systemd/scalesmiths-log-shipping.service`](../../ops/systemd/scalesmiths-log-shipping.service). It tails Docker JSON logs read-only, persists an outage buffer under `/var/lib/scalesmiths-vector`, and sends HTTPS batches to an operator-owned endpoint. It never mounts the Docker socket.

Install Vector from its verified upstream package, copy the example to `/etc/scalesmiths/vector.yaml`, put only `LOG_SHIPPING_ENDPOINT` and `LOG_SHIPPING_TOKEN` in root-owned mode-`0600` `/etc/scalesmiths/log-shipping.env`, create the buffer directory, validate the configuration, and then enable the unit. Set destination retention explicitly (recommended operational starting point: 30 days searchable and 90 days restricted archive) and document the actual value and deletion owner. The disk buffer tolerates destination outages; it is not the archive of record. Alert on stopped/failed collectors, a blocked/full buffer, ingestion lag over five minutes, and destination rejection.

Restrict destination access by role and application/client scope. Do not ship Nginx query strings or new unstructured application fields until their privacy impact is reviewed. Useful alert dimensions are `level`, `component`, `errorCategory`, `forgeStage`, `provider`, and `fallbackUsed`. Request, project, task, job, and artifact IDs are operational identifiers and still follow access-control and retention policy.
