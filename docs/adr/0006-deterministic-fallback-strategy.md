# ADR 0006: Deterministic Fallback Strategy

- Status: Accepted
- Date: 2026-07-13

## Context

Forge must remain usable in local, CI, and degraded-provider situations without spending provider credits or blocking every workflow. The repository already uses deterministic mock/fallback outputs for AI-disabled mode, tests, demos, benchmarks, proposal generation fallbacks, and some triage flows.

## Decision

Keep deterministic fallback output as an explicit, labelled mode. Fallback output must be recorded as fallback or requiring review, not treated as equivalent to validated provider output.

## Alternatives Considered

- Hard-fail all AI-dependent work when providers are disabled.
- Silently substitute mock output.
- Use live providers in all tests and demos.

## Consequences

The system remains deterministic and low-cost for CI/demo/development. The tradeoff is that fallback output can look plausible, so UI and workflow rules must make its quality state visible.

## Security Implications

Fallbacks reduce provider exposure and spend but can conceal degraded quality if not labelled. Deployment and publication gates must block or require explicit human approval for degraded/fallback dependencies.

## Operational Implications

Fallback use should appear in task quality, artifacts, economics reports, activity logs, and benchmark reports. Operators must not use fallback output as proof of live-provider quality.

## Related Code or Documentation

- `admin/src/lib/forge-ai.ts`
- `admin/src/lib/forge-artifacts.ts`
- `admin/src/app/api/forge/projects/[id]/tasks/[taskId]/quality-approval/route.ts`
- `docs/architecture/forge-workflow.md`
- `docs/operations/forge-benchmark-suite.md`
- `docs/testing/forge-end-to-end.md`
