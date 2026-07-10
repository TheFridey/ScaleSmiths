# Security boundaries

## Trust zones

```mermaid
flowchart LR
  Internet[Untrusted internet] --> Nginx[Host/container Nginx]
  Nginx --> Public[Public web routes]
  Nginx --> AdminBoundary[Auth.js middleware]
  Public --> PortalBoundary[Portal JWT + clientId check]
  AdminBoundary --> Admin[Admin and Forge APIs]
  Admin --> AI[External AI providers]
  Admin --> WorkspaceBoundary[Workspace path/content policy]
  WorkspaceBoundary --> Sandbox[Local or constrained Docker execution]
  Public --> Email[Resend]
  Public --> DB[(PostgreSQL)]
  Admin --> DB
```

## Public application boundary

The marketing site is public. Quote submission is untrusted input and is protected by body limits, validation, honeypot/rate-limit logic, normalized fields, database persistence, and fail-aware Resend delivery status. The public app receives the shared root environment, so server/client separation in Next.js remains important; only `NEXT_PUBLIC_*` variables may enter browser bundles.

Portal login accepts untrusted credentials, uses bcrypt for stored accounts, database-backed login limits, and an HTTP-only, SameSite=Lax, production-secure JWT cookie. Every portal resource is filtered by the session client ID. Internal request messages are excluded from client-visible queries. Demo authentication is an explicit environment override and must remain disabled in production.

## Admin boundary

Admin has no signup. A single environment-configured identity is authenticated by Auth.js credentials and an eight-hour JWT session. Middleware denies unauthenticated pages and APIs. Production depends on a strong `AUTH_SECRET` and bcrypt `ADMIN_PASSWORD`; plaintext admin passwords remain accepted outside an enforced production check, so operations must follow `.env.example` guidance.

Forge mutation/task rate limiting is an in-memory map in middleware. It is per process, resets on restart, and is not globally effective across replicas. It is a safety throttle, not a durable abuse-control boundary.

## AI boundary

Prompts and upstream artifacts are untrusted provider inputs. Provider code is `server-only`; API keys never belong in project records or generated output. Responses must satisfy a declared JSON schema. Safety prompts prohibit secrets, telemetry, destructive commands, and unknown outbound calls. Safe error messages avoid returning provider bodies. Usage and costs are persisted without credentials.

Remaining risks:

- prompt injection can influence semantically valid structured output;
- schema validation guarantees shape, not business correctness;
- provider pricing is hard-coded and estimates may understate current cost;
- the in-memory daily ledger is process-local, though database project/monthly checks provide an additional control.

## Generated workspace boundary

Generated files are untrusted until they pass path, filename, content, and executable checks. Paths must remain under `generated-sites/<project slug>`, with allowlisted top-level content. Writes use resolved paths and reject traversal. Generated source is scanned for server-secret access, private keys, destructive shell patterns, and obvious unknown outbound calls.

Production should use `FORGE_SANDBOX_RUNNER=docker`. Docker commands mount only the selected workspace, drop all capabilities, enable `no-new-privileges`, constrain CPU/memory, pass a small secret-free environment, and default QA/build networking to `none`. Install and preview networking are separately configurable. The local runner does not provide this OS isolation.

Pattern scanning is not a complete code-security proof. Obfuscated code, dynamic URLs, package lifecycle scripts, and dependency compromise remain risks. Package installation with bridge networking is therefore an operational trust decision.

## Preview and publication boundary

Preview defaults to `127.0.0.1`, and non-loopback configuration is ignored unless public previews are explicitly enabled. Host Nginx exposes only web/admin services. `generated-sites` is bind-mounted into admin and is never configured as an Nginx document root. Forge export returns reviewed archives; deploy readiness does not imply public exposure.

## Database boundary

Both apps use the same database credential and therefore have database-level access beyond their logical ownership. Isolation is implemented in application queries, not PostgreSQL roles or row-level security. Admin and web independently declare shared tables and run separate migration histories. A migration collision or schema drift can affect both applications.

## Email and integration boundaries

The public app sends quote and client-request notifications through server-only Resend credentials. Forge stores non-secret Resend project configuration and represents the key as environment-owned/redacted. Generated sites refer to `RESEND_API_KEY` only from generated server routes. WhatsApp V1 produces `wa.me` integration behaviour; future Cloud API variables are documented but not a current browser credential path.

## Security controls not currently automated

- no CI scan for dependency vulnerabilities, containers, secrets beyond real `.env` filenames, or generated-code policy bypasses;
- no integration test for host-Nginx headers/TLS/routing;
- no database role separation or row-level security;
- no distributed admin/Forge rate limiter;
- no automated restoration/reconciliation of orphaned preview processes or containers;
- no end-to-end authorization matrix test across admin and portal APIs.

