# ADR 0011: Multi-Perspective Review

- Status: Accepted
- Date: 2026-07-13

## Context

Forge output quality cannot be judged by one generic review. The system includes a review council with perspectives such as creative director, conversion strategist, frontend engineer, accessibility specialist, SEO strategist, security reviewer, performance engineer, industry expert, and skeptical prospective customer.

## Decision

Use structured multi-perspective review and a synthesis stage for approved project state. Reviewers must use canonical approved facts, stay within remit, cite evidence, and record uncertainty. Synthesis deduplicates findings, preserves high-risk dissent, and separates automatic fixes from human decisions.

## Alternatives Considered

- Single generic AI evaluator.
- Human-only ad hoc review with no structured findings.
- Automatic repair of all review findings.

## Consequences

The council improves breadth of review and exposes conflicting recommendations. It adds compute cost, latency, and complexity around evidence management and synthesis.

## Security Implications

Security review findings are advisory unless tied to release gates, but high-risk dissent must not be discarded. Reviewers must not invent client facts or leak one client’s private content into another project.

## Operational Implications

Review outputs are versioned artifacts and should feed human planning, repair loops, and approval decisions. Live-provider runs should be budgeted; deterministic fixtures support tests.

## Related Code or Documentation

- `admin/src/lib/forge-review-council.ts`
- `admin/src/lib/server/forge-review-council-agent.ts`
- `admin/src/app/api/forge/projects/[id]/review-council/route.ts`
- `docs/architecture/forge-review-council.md`
- `docs/architecture/cross-artifact-consistency.md`
