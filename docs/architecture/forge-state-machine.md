# Forge workflow state machine

The authoritative transition policy is `admin/src/lib/forge-state-machine.ts`; persisted prerequisite evaluation and audit metadata live in `admin/src/lib/server/forge-workflow.ts`.

Project states are `intake`, `research`, `strategy`, `sitemap`, `copy`, `design`, `build`, `qa`, `integrations`, `preview`, `client_review`, `ready_to_deploy`, `deployed`, and `archived`. `deployed` and `archived` are terminal. Normal forward transitions follow the production sequence, with explicit QA-to-build and client-review-to-build loops for remediation.

Task states are `queued`, `running`, `completed`, `failed`, and `cancelled`. Completed tasks are terminal. Failed and cancelled tasks can be requeued; other backward transitions are rejected.

Server-side prerequisite checks require an approved, current sitemap before build; a current generated build before QA or repair; passing QA before readiness or deployment; and no unresolved failed prerequisite. Deployment also retains the task-quality gate described in `docs/operations/forge-task-quality.md`.

Owners and administrators may override non-terminal project safeguards only with a reason of at least ten characters. Overrides do not bypass terminal states. Transition activity metadata records previous state, new state, actor (activity row), timestamp, reason, and whether an override was used.

Invalid transitions return conflict responses with a safe explanation and stable code where invoked through the project API. Artifact approvals must operate on the current unsuperseded version; the central policy rejects an explicitly obsolete artifact.
