# Forge AI cost attribution and run context

Status: current  
Applies to: `forge_ai_usage`, `forge_runs`, `forge_run_steps`, `forge_jobs`

## Why this exists

Forge AI spend used to be attributed to runs and steps by **time window**. That is not
sound: two AI jobs on the same project can overlap, so each window captures the other's
spend, and a retry captures the whole attempt history. This document records the exact
attribution model that replaced it, and the run-context rules for downstream
invalidation.

## Identifier availability (audited 2026-07-31)

Where an AI provider call can know each identifier, before this change:

| Call path | projectId | runId | runStepId | jobId | taskId |
| --- | --- | --- | --- | --- | --- |
| Forge Run stage job (`forge-run-orchestrator` → `insertForgeJob`) | Yes | In job payload | In job payload | Job row | Sometimes |
| Job handler (`JOB_HANDLERS[kind](projectId, actor, payload)`) | Yes | Payload only | Payload only | **No — not passed** | Sometimes |
| Agent (`runForgeXAgent(projectId, actor)`) | Yes | **No** | **No** | **No** | Sometimes |
| `runForgeAiJson` (`ForgeAiRequest`) | Yes | **No** | **No** | **No** | Yes |
| `recordForgeAiUsage` | Yes | **No** | **No** | **No** | Yes |
| Direct API routes (intake, url-autofill, triage, proposals, reports) | Sometimes | Not applicable | Not applicable | Not applicable | Sometimes |

The orchestrator already wrote `forgeRunId`, `forgeRunStepId` and `forgeRunStage` into
each job payload, but nothing carried them past the job handler boundary, and the job
runner never passed the job's own id to the handler. So the provider call had no way to
know which run or step it belonged to, which is why time windows were used.

## Attribution model

`forge_ai_usage` now carries nullable `run_id`, `run_step_id` and `job_id` foreign keys
alongside the existing `project_id` and `task_id`. All three use `ON DELETE SET NULL`, so
deleting a run, step or job never deletes the spend record — the row degrades to
unattributed rather than disappearing from financial history.

Attribution is resolved **server-side only**, from database rows:

- `job_id` is the claimed job's own primary key in the job runner.
- `run_id` and `run_step_id` are resolved by looking up `forge_run_steps` by that
  `job_id`. `forge_run_steps.job_id` is unique and written only by the orchestrator.
- Client-supplied identifiers are never trusted, and the job payload is not trusted as
  the source of truth for linkage; it is only a hint the orchestrator wrote.

Propagation uses an `AsyncLocalStorage` attribution scope established by the job runner
around the handler call, mirroring the existing `withMonitoringScope` and request-context
pattern. This is per-async-execution scope, not global mutable state: concurrent jobs in
the same process each see their own attribution, which is exactly the property the old
time-window model lacked. `runForgeAiJson` callers may still pass identifiers explicitly,
and an explicit value always wins over the ambient scope.

### Exact aggregation

| Total | Rule |
| --- | --- |
| Run step actual cost | `sum(estimated_cost) where run_step_id = :stepId` |
| Run actual cost | `sum(estimated_cost) where run_id = :runId` |
| Job cost | `sum(estimated_cost) where job_id = :jobId` |

All three aggregate with `coalesce(sum(...), 0)` over the `numeric(12,6)` column in
PostgreSQL, so money is summed in decimal in the database and never through JavaScript
floating point. Values cross the boundary as strings and are only rounded at the
presentation edge.

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

Rows written before this migration have `run_id`, `run_step_id` and `job_id` null. They
are **not** back-filled. Inferring linkage from timestamps would recreate exactly the
misattribution this change removes, and would write guesses into financial records.

Treatment:

- Exact run, step and job totals **exclude** unattributed rows. A legacy row can never be
  silently counted toward a run.
- Project, monthly, budget and dashboard totals **include** them, because those are
  project-scoped or time-scoped questions that were always answerable and must not
  regress.
- `loadForgeRunCostBreakdown` exposes `unattributedProjectCost` as a separate, clearly
  labelled figure so an operator can see legacy spend without it contaminating run
  accounting.
- The CSV export gains `runId`, `runStepId`, `jobId` and an `attributed` column so the
  distinction survives outside the application.

No time-window attribution is retained for new rows.

## Downstream invalidation context

`invalidateDownstreamForChangedInput` previously loaded stage context with a hardcoded
`mode = "standard"` and `policy = {}`, regardless of the run actually executing. Every
mode-sensitive and policy-sensitive decision was therefore evaluated against the wrong
run for redesign, refresh and migration runs.

It now loads the run and uses its real `mode` and `policy_json`, including
`skipStages`, `migrationProject`, `requireClientReview` and the deployment-readiness
signals. Invalidation additionally refuses to invalidate a step when the only difference
is an absent optional or policy-skipped upstream stage, so a successful stage is not
reset merely because an optional stage did not run.
