# Golden Path Release Test

The Golden Path is deliberately split into two layers so one large browser test does not own every business invariant.

## Domain integration layer

Run `npm run test:golden-path` from the repository root. The runner uses `TEST_DATABASE_URL` when supplied; otherwise it starts a disposable PostgreSQL 16 container. It applies the shared-schema history in its required interleaved order, provisions least-privilege admin and portal roles, and executes production domain services for conversion, portal provisioning, delivery, deployment projection, invoicing and report generation.

The suite asserts retry idempotency, project progress, client approval, timeline/audit events, invoice snapshot immutability, payment as an explicit invoice action, portal publication, tenant isolation and RBAC. Email delivery uses an injected local transport; portal activation uses a test-only password hash; no payment gateway or AI provider is contacted.

## Browser layer

Run `npm run test:e2e:golden-path` from `admin/` after the guarded E2E database prepare/migrate/seed steps. Playwright uses the production-built admin server and authenticated storage state. The small journey creates a won prospect through the authenticated API, performs conversion in the real operator UI, prepares portal access, and opens the resulting delivery workspace. Deeper lifecycle rules stay in the PostgreSQL integration layer.

## CI

`Database and Migrations` runs the domain suite against the PostgreSQL service and retains its log. `Admin Forge E2E` prepares an isolated shared database, builds the production admin app, then runs the Golden Path UI journey in Chromium. Playwright traces, screenshots, video and the HTML report are uploaded on failure.

These tests prove the local/CI business boundaries. They do not certify live email, payment-provider or production deployment credentials.
