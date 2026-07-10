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

JSON output is written to stdout/stderr for collection by Docker. Configure the host log driver or collector for rotation and retention; the application does not write log files. Useful alert dimensions are `level`, `component`, `errorCategory`, `forgeStage`, `provider`, and `fallbackUsed`. Request, project, task, job, and artifact IDs are operational identifiers and should still follow access-control and retention policy.

