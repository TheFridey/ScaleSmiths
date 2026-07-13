# ADR 0012: Adaptive Workflow Boundaries

- Status: Accepted
- Date: 2026-07-13

## Context

Forge has evolved from a mostly fixed sequence into a controlled adaptive workflow planner. It can recommend next tasks, detect missing/contradictory facts, react to QA/review failures, and create repair or clarification paths. It must not bypass approval, deploy autonomously, or invent missing client facts.

## Decision

Allow adaptive workflow recommendations inside explicit state-machine and policy boundaries. Recommendations must explain evidence and reasoning, respect dependencies, approval policies, loop/cost/runtime limits, and terminal conditions.

## Alternatives Considered

- A fully fixed stage sequence.
- A fully autonomous planner with deployment authority.
- Manual operator-only task selection.

## Consequences

Adaptive planning makes Forge more resilient to weak input and quality failures. It increases policy complexity and requires loop detection, clear blocked states, and careful UI explanation.

## Security Implications

The planner cannot override required approvals, release gates, RBAC, budget limits, sandbox policy, or human clarification requirements. Missing facts must become questions, not fabricated content.

## Operational Implications

Operators receive recommended next actions and blocked reasons. Workflow changes require exhaustive transition and policy tests so UI ordering does not become the only enforcement mechanism.

## Related Code or Documentation

- `admin/src/lib/server/forge-workflow.ts`
- `admin/src/lib/server/forge-workflow-planner.ts`
- `admin/src/lib/forge-workflow-planner.ts`
- `admin/src/app/api/forge/projects/[id]/workflow-plan/route.ts`
- `docs/architecture/forge-state-machine.md`
- `docs/architecture/forge-adaptive-workflow.md`
- `docs/architecture/forge-clarification-queue.md`
