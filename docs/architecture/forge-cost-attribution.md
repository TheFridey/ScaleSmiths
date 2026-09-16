# Forge AI cost attribution and run context

Status: current  
Applies to: `forge_ai_usage`, `forge_runs`, `forge_run_steps`, `forge_jobs`

## Why this exists

Forge AI spend used to be attributed to runs and steps by **time window**. That is not
sound: two AI jobs on the same project can overlap, so each window captures the other's
spend, and a retry captures the whole attempt history. This document records the exact
attribution model that replaced it, and the run-context rules for downstream
invalidation.

Admin migration `0049_forge_ai_usage_exact_attribution` already landed on master. This
document describes the application rules that write and read those columns.

## Attribution model

`forge_ai_usage` carries nullable `run_id`, `run_step_id` and `job_id` foreign keys
alongside the existing `project_id` and `task_id`. All three use `ON DELETE SET NULL`, so
deleting a run, step or job never deletes the spend record — the row degrades to
unattributed rather than disappearing from financial history.

Attribution is resolved **server-side only**, from database rows:

- `job_id` is the claimed job's own primary key in the job runner.
- `run_id` and `run_step_id` are resolved by looking up `forge_run_steps` by that
  `job_id`. `forge_run_steps.job_id` is unique and written only by the orchestrator.
- Client-supplied identifiers are never trusted, and the job payload is not trusted as
  the source of truth for linkage. The orchestrator-written `forgeRunStepId` hint is used
  only in the window before `forge_run_steps.job_id` is committed, and only after the step
  is re-read and checked to belong to the claimed job's project.

Propagation uses an `AsyncLocalStorage` attribution scope established by the job runner
around the handler call (`runWithForgeAttribution`). This is per-async-execution scope,
not global mutable state: concurrent jobs in the same process each see their own
attribution. `recordForgeAiUsage` resolves identifiers through `resolveForgeAttribution`:
an explicit value always wins over the ambient scope, and non-positive or non-integer ids
are stored as null.

### Exact aggregation

| Total | Rule | Used for |
| --- | --- | --- |
| Job cost | `sum(estimated_cost) where job_id = :jobId` | Current attempt / retry isolation (`sumForgeJobCost`, persisted step `actual_cost_usd`) |
| Run step reporting total | `sum(estimated_cost) where run_step_id = :stepId` | All attempts on that step (`sumForgeRunStepCost`) |
| Run actual cost | `sum(estimated_cost) where run_id = :runId` | Run totals (`sumForgeRunCost`, persisted run `actual_cost_usd`) |

Persisted `forge_run_steps.actual_cost_usd` is the **current job attempt**, updated by
`updateRunStepActualCost(stepId, jobId)`. That keeps a retry from absorbing earlier
attempts on the displayed step cost. `sumForgeRunStepCost` still reports the full step
history for reconciliation.

All three aggregate with `coalesce(sum(...), 0)` over the `numeric(12,6)` column in
PostgreSQL, so money is summed in decimal in the database and never through JavaScript
floating point.

### Consistency invariant

For any run:

```
sum(step exact costs) <= run exact cost
```

Run-linked usage that is not attributable to a single step — recorded with `run_id` set
and `run_step_id` null — is the documented difference. `assertForgeRunCostConsistency`
returns `stepTotal`, `runTotal` and `nonStepRunTotal` and asserts
`stepTotal + nonStepRunTotal == runTotal` within a 0.000001 tolerance, matching the
column scale.

## Historical rows

Rows written before migration 0049 have `run_id`, `run_step_id` and `job_id` null. They
are **not** back-filled. Inferring linkage from timestamps would recreate exactly the
misattribution this change removes.

Treatment:

- Exact run, step and job totals **exclude** unattributed rows.
- Project, monthly, budget and dashboard totals **include** them.
- `loadForgeRunCostBreakdown` exposes `unattributedProjectCost` as a separate figure.
- The CSV export includes `runId`, `runStepId`, `jobId` and an `attributed` column.

No time-window attribution is retained for new rows.

## Downstream invalidation context

`invalidateDownstreamForChangedInput` loads the run and uses its real `mode` and
`policy_json`. The decision itself is `selectStagesToInvalidate`, which refuses to
invalidate a step when:

- the run policy skipped that stage
- the changed stage does not produce an artifact the step requires
- the step is optional and legitimately absent under the run's mode/policy
- the step is not in a settled `completed` / `awaiting_approval` state

A successful stage is therefore not reset merely because an optional or policy-skipped
upstream stage did not run, and redesign / refresh / migration runs are judged against
the run that is actually executing.
