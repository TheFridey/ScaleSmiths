# Operation Expansion architecture

Baseline: 2026-11-17, master `3db74a091d481e03e5fed9ea7a6837624e317a41`; implementation branch `feature/operation-expansion`.

## Discovered architecture

Two independently installed Next.js 15.5.28 apps share PostgreSQL with separate, checksum-locked migration histories and a root migration planner. Docker Compose and host Nginx are canonical; PM2 and SMTP2GO are assumptions unsupported by the inspected configuration. Web owns public acquisition and client portal tables. Admin owns CRM, invoicing, Auth.js identities, MFA, RBAC, and delivery. Existing internal roles have global data scope and must never be assigned to external partners. Issued invoices preserve immutable snapshots but invoice paid status is not a partial-payment ledger.

## Integration decisions

- Public `/partners` in web uses official brand assets, existing site chrome, exact illustrative arithmetic and a disabled-by-default application gate. Web owns `partner_applications`; admin reads and reviews those records.
- `/partner` on the existing admin origin is an external-only operating area, using existing Auth.js credentials, password hashing, durable login throttling and session revocation. No new hostname, process, auth stack or deployment is required. `independent_partner` has one scoped capability and an explicit deny boundary for every internal route. Internal `/expansion` requires a dedicated founder capability.
- Partner identity is an extension of `admin_users`; one profile binds identity to applicant/agreement and a hashed, expiring, single-use invitation. Activation follows separately recorded founder prerequisites. There is no public signup.
- Canonical `prospects`, `clients`, and `invoices` remain authoritative. New partner opportunity metadata references canonical prospects; no second client database or billing engine.
- Approved, immutable contracts snapshot versioned rates and qualifying milestone limits. Verified VAT-exclusive collection events reference issued invoices and create append-only commission deltas transactionally. Payout recording is manual, never a transfer.
- Explicit row ownership filters apply to every partner operation. Financial and capacity commands serialize under database locks and use uniqueness constraints. Duplicate registration returns a generic relationship warning.

## Design and boundaries

Use existing ScaleSmiths metallic emblem and wordmark, dark surfaces, readable typography, restrained gold, visible labels, semantic forms, focus states and responsive grids. Approved resources are content projections, never arbitrary filesystem paths. No generated-site access, uploads, paid AI, website crawling, external mail or live transfer is enabled by this operation.

## Verification and deployment

Run baseline app unit, lint, TypeScript and production builds, migration gates before schema work, focused financial and authorization tests, database-backed concurrency and workflow tests where available, then browser checks at desktop/tablet/mobile. Dependency installation damage is baseline environment debt, not an application regression. Use root `npm run db:migrate` only against explicitly isolated test databases; never mutate the configured database without proving it is a disposable test target. Production deployment, legal terms, privacy approval and accounting decisions remain founder gates.

## Risks and tradeoffs

External users on the admin origin share authentication infrastructure but must have zero internal capabilities; exhaustive denial tests are mandatory. Web application access remains off until privacy and operations approval. Lead protection duration and refund entitlement are contractual decisions and must remain explicit configuration/approvals, not invented binding promises. A full national programme exceeds a single screen: phase acceptance is the complete tested commercial journey, not UI availability.
