# ADR 0007: Generated-Code Sandboxing

- Status: Accepted
- Date: 2026-07-13

## Context

Forge generates client-site workspaces under `generated-sites/` and can run install, typecheck, lint, build, preview, QA, and repair flows. Generated code is untrusted relative to the ScaleSmiths host repository and production secrets.

## Decision

Keep generated workspaces isolated from the host repository and run generated-site validation/preview through controlled local or Docker sandbox utilities. Prefer Docker sandboxing in production with secret-free environments, resource limits, dropped capabilities, no-new-privileges, and restricted network modes.

## Alternatives Considered

- Run generated code directly in the admin process.
- Store generated workspaces inside the main app tree.
- Expose generated workspaces as static public roots.
- Allow unrestricted shell commands.

## Consequences

Sandboxing reduces filesystem, secret, process, and network risk. It adds operational complexity around Docker availability, workspace ownership, dependency installation, preview ports, and cleanup.

## Security Implications

Generated code must not access host secrets, Docker socket, parent directories, private networks, or unrestricted outbound network. Path canonicalisation, command allowlists, symlink checks, file allowlists, and log/output limits remain critical controls.

## Operational Implications

Production should set reviewed sandbox env vars and run a generated-site QA job after deployment changes. Operators must keep `generated-sites/` private and writable only by the admin container user.

## Related Code or Documentation

- `generated-sites/.gitignore`
- `admin/src/lib/forge-sandbox.ts`
- `admin/src/lib/server/forge-workspace.ts`
- `admin/src/lib/server/forge-qa-agent.ts`
- `docs/architecture/security-boundaries.md`
- `docs/architecture/generated-site-implementation-agent.md`
- `README.md#forge-vps-deployment-preparation`
