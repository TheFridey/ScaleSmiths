# Forge adaptive workflow planner

The adaptive planner is a deterministic recommendation layer above the authoritative Forge state machine. It never executes tasks, changes project state, grants approval, or deploys. Existing route guards, task-quality gates, artifact approvals, and `forge-state-machine.ts` remain authoritative.

The graph can recommend clarification, targeted research, trust-evidence requests, degraded-upstream review, tone recalibration, compliance review, visual repair, responsive repair, or continuation through the fixed state machine. Every recommendation contains evidence, reasoning, dependencies, an approval policy, and a downstream-blocking flag. Missing or contradictory client facts always result in a human clarification recommendation; Forge does not resolve them itself.

Planner terminal conditions cover deployed/archived projects, exhausted cost or runtime allowance, loop limits, missing human facts, and unresolved approvals. Each adaptive task is capped at three iterations by default and a plan returns at most five recommendations. Cost and runtime limits fail closed. Owners and administrators may record a reasoned loop-limit override, but that audit event does not approve an artifact or execute a task.

`GET /api/forge/projects/:id/workflow-plan` returns the current evidence snapshot and plan. `POST` records an accepted, dismissed, or privileged override decision in `forge_activity_logs`. Accepted recommendations remain proposals: a separately authorised Forge action must create or execute work, preserving state-machine preconditions and approval gates.

The persisted fact adapter derives recommendations from current, unsuperseded artifact metadata and task quality. Integrations adding richer evaluator evidence should use the established metadata keys or extend the adapter explicitly; arbitrary provider reasoning is not trusted as a workflow command.
