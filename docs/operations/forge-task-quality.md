# Forge task result quality

Forge task execution status and result quality are independent. A task may be `completed` while its result is `fallback`, `degraded`, or `requires_review`.

Quality states are `validated`, `degraded`, `fallback`, `requires_review`, and `failed`. New and ambiguous tasks default to `requires_review`; validation must be positively established before `validated` is stored. Provider/model, retries, validation evidence, optional score, fallback reason, downstream permission, approval requirement and publication blocking are first-class task fields.

Deterministic mock output is fallback output. It can support downstream drafting, but is never equivalent to validated provider output. Degraded and fallback output requires a named reviewer and a meaningful reason before publication. Deployment readiness and deployment both fail closed when any project task is failed, requires review, or has unapproved degraded/fallback quality.

Migration `0018_forge_task_quality.sql` classifies historical failed tasks as `failed`, completed mock-provider tasks as `fallback`, and all other ambiguous history as `requires_review`. It deliberately does not infer `validated` from execution completion.

Approvals are recorded through `POST /api/forge/projects/:id/tasks/:taskId/quality-approval` and mirrored into the Forge activity log. Approval changes publication permission; it does not rewrite the original quality classification.
