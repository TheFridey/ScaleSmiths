# ADR 0008: Human Approval Gates

- Status: Accepted
- Date: 2026-07-13

## Context

Forge can generate research, sitemap, copy, design, code, QA, proposals, migration candidates, and deployment candidates. Several outputs can be degraded, fallback, obsolete, or dependent on missing approvals.

## Decision

Require explicit human approvals for sensitive workflow progress, artifact acceptance, degraded/fallback output, deployment candidates, and release gates. Server-side gate evaluation must decide whether deployment is blocked; hidden buttons alone are not sufficient.

## Alternatives Considered

- Fully autonomous deployment from Forge.
- UI-only approval ordering.
- Treat all completed tasks as deployable.

## Consequences

Human gates slow the workflow but create accountability, auditability, and safer release decisions. Owner overrides exist only for permitted categories and must include actor, time, and reason.

## Security Implications

Approval gates prevent fallback/degraded or unreviewed artifacts from becoming live changes by accident. Fundamental integrity checks such as mismatched workspace hashes must not be overrideable.

## Operational Implications

Admins need clear blocked reasons and must record approval context. Candidate changes revoke relevant approvals by creating a new immutable candidate.

## Related Code or Documentation

- `admin/src/lib/forge-release-gates.ts`
- `admin/src/lib/server/forge-deployment-candidates.ts`
- `admin/src/components/forge/ForgeDeployPanel.tsx`
- `docs/architecture/forge-release-gates.md`
- `docs/architecture/forge-deployment-candidates.md`
- `docs/testing/forge-end-to-end.md`
