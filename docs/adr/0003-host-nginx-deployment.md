# ADR 0003: Host-Nginx Deployment

- Status: Accepted
- Date: 2026-07-13

## Context

ScaleSmiths supports multiple Compose variants, but the reviewed VPS path uses Docker Compose for app/database containers and host-managed Nginx for public routing. The public app binds to a loopback port and admin binds separately. Recent release work added blue/green-style release preparation and rollback scripts for the host-Nginx path.

## Decision

Preserve the host-Nginx deployment path as the primary production topology for the existing VPS. Host Nginx terminates TLS and routes `scalesmiths.co.uk` to web and `admin.scalesmiths.co.uk` to admin, while Docker Compose manages app containers and PostgreSQL.

## Alternatives Considered

- Container-owned Nginx as the only production topology.
- Platform-as-a-service hosting.
- Kubernetes or another orchestrator.
- PM2-only Node process management.

## Consequences

The deployment remains compatible with an existing VPS where host Nginx already owns ports 80 and 443. The tradeoff is more manual operational setup: Nginx snippets, certificates, loopback ports, Compose services, migrations, and rollback state must stay aligned.

## Security Implications

Admin and Forge exposure depends on correct host-Nginx server blocks, TLS, Cloudflare Access/origin hardening where used, and loopback-only app bindings. Generated workspaces must never be served directly by Nginx.

## Operational Implications

Operators must test Nginx config before reload, run migrations in the documented order, preserve previous releases for rollback, and verify health endpoints after traffic switches.

## Related Code or Documentation

- `docker-compose.host-nginx.yml`
- `docker-compose.release.yml`
- `nginx/host-scalesmiths.conf`
- `nginx/host-scalesmiths-http.conf`
- `scripts/release-manager.mjs`
- `docs/architecture/deployment-topology.md`
- `docs/operations/canary-release-and-rollback.md`
- `docs/operations/cloudflare-access.md`
