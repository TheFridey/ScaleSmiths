# ADR 0001: Two Next.js Applications

- Status: Accepted
- Date: 2026-07-13

## Context

ScaleSmiths is implemented as two independently built Next.js App Router applications: `web/` for the public site and client portal, and `admin/` for internal CRM, operations, and Forge. The apps share PostgreSQL but have separate package manifests, Dockerfiles, route trees, middleware, builds, and CI jobs.

## Decision

Keep public and internal concerns split into two Next.js applications. Public acquisition, quote capture, portal routes, and experience-selection logic stay in `web/`. Admin identity, RBAC, client operations, Forge, provider calls, generated workspaces, and deployment controls stay in `admin/`.

## Alternatives Considered

- Single Next.js monolith with public and admin route groups.
- Separate repositories for public and admin apps.
- A shared package/workspace architecture for cross-app code.

## Consequences

The split keeps public and privileged runtime surfaces easier to reason about, but shared data models can drift because the apps duplicate some schemas and migration histories.

## Security Implications

Admin and Forge code, credentials, and generated workspaces are not bundled into the public web app. Security boundaries still depend on correct admin middleware, route-handler checks, Docker/Nginx routing, and database discipline.

## Operational Implications

CI, builds, Docker services, migrations, and deploy health checks must treat `web` and `admin` separately. Operators must deploy both when shared schema or public/admin contracts change.

## Related Code or Documentation

- `web/src/app`
- `admin/src/app`
- `web/package.json`
- `admin/package.json`
- `docs/architecture/system-overview.md`
- `docs/architecture/security-boundaries.md`
- `README.md`
