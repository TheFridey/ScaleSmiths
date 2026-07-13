# ADR 0009: Artifact Provenance

- Status: Accepted
- Date: 2026-07-13

## Context

Forge artifacts are versioned records used by downstream stages, approval flows, QA, deployment candidates, rollback, and reporting. Outputs can depend on provider/model, prompt/schema versions, upstream artifacts, hashes, quality state, and human approvals.

## Decision

Store first-class artifact provenance and version lineage on Forge artifacts. Rollbacks create new versions based on historical artifacts instead of destructively overwriting history.

## Alternatives Considered

- Store only the latest artifact content.
- Use Git commits alone as provenance.
- Keep provenance only in activity logs.

## Consequences

Provenance makes downstream dependency checks, fallback warnings, diffs, rollback, and audit trails possible. It increases metadata volume and requires consistent writes from all artifact-producing agents.

## Security Implications

Hashes and lineage help detect mismatches and obsolete dependencies. Provenance must not include secrets, raw provider credentials, private prompts, or excessive client-sensitive context.

## Operational Implications

Admins can inspect artifact history and compare versions. Deployment candidates can freeze approved artifact versions and verify workspace/content hashes before release.

## Related Code or Documentation

- `admin/src/lib/forge-artifacts.ts`
- `admin/src/lib/server/forge-artifacts.ts`
- `admin/src/components/forge/ForgeArtifactTabs.tsx`
- `admin/src/app/api/forge/projects/[id]/artifacts/[artifactId]/route.ts`
- `docs/architecture/artifact-provenance.md`
- `docs/architecture/forge-deployment-candidates.md`
