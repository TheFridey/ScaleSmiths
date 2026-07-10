# Forge workflow

ScaleSmiths Forge is an authenticated subsystem inside `admin`; it is not a separate service. Projects, orchestration state, artifacts, usage, and audit records are persisted in PostgreSQL, while generated source files live under `generated-sites/`.

## Lifecycle

The persisted project status enum is:

`intake -> research -> strategy -> sitemap -> copy -> design -> build -> qa -> integrations -> preview -> client_review -> ready_to_deploy -> deployed -> archived`

Not every status has a dedicated agent. “Strategy” is represented across intake/research/sitemap/design decisions. Integrations and preview are configuration/runtime steps. Status changes are enforced by domain helpers and route/agent actions rather than a standalone workflow engine.

```mermaid
flowchart TD
  UI[Authenticated Forge UI] --> API[Forge route handler]
  API --> Mode{job mode}
  Mode -->|development default| Inline[execute inline]
  Mode -->|production default| Queue[(forge_jobs)]
  Queue --> Worker[/api/forge/jobs/run]
  Inline --> Agent
  Worker --> Agent[server-only agent]
  Agent --> Task[(forge_tasks)]
  Agent --> AI[AI provider abstraction]
  Agent --> Artifact[(versioned forge_artifacts)]
  Agent --> Memory[(forge_memories)]
  Agent --> Activity[(forge_activity_logs)]
  Agent --> Workspace[generated-sites/project-slug]
  AI --> Usage[(forge_ai_usage)]
```

`FORGE_JOBS_MODE` can force `inline` or `background`. Otherwise development is inline and production is background. Background API calls create a `forge_jobs` row; the worker route claims and dispatches it through `server/forge-job-runner.ts`. Jobs track attempts, timestamps, payload, result, and error. Domain agents also create `forge_tasks`, so jobs represent execution requests while tasks represent auditable project work.

## Agents and outputs

| Agent/module | Inputs | Principal output |
| --- | --- | --- |
| Intake | project and structured brief | `handover_doc` intake artifact |
| URL autofill | bounded fetch of up to four pages | proposed intake fields |
| Research | intake and project | structured research report |
| Sitemap | intake and research | sitemap strategy, with approval path |
| Copy | intake, research, sitemap | structured copy document |
| Design | upstream strategy/copy and animation pack | design direction |
| Component spec | design/copy/sitemap | component specification |
| Frontend code | approved artifacts and integrations | generated code artifact plus workspace files |
| SEO | intake/sitemap/copy/workspace | SEO pack and generated metadata files |
| Visual critique | design/copy/spec/code | critique, approval, safe-fix actions |
| QA | workspace and artifacts | command results and QA report |
| Repair | failed QA plus workspace | bounded structured patches, syntax checked before application |
| Visual QA | running generated app | viewport screenshots/metrics, console and Lighthouse results |
| Proposal/handover | accumulated project artifacts | proposal or handover artifact |
| Export | workspace/artifacts | ZIP/export metadata; environment hygiene is checked |
| Deploy | QA, integrations, export and readiness signals | readiness/deployment notes; no generic automatic public deploy |
| Command chat | operator message and project state | routed safe action, optionally requiring confirmation |

All AI-facing agents request a declared JSON schema. Provider responses are parsed and validated before domain use. Selected agents can fall back to validated deterministic mock data on schema mismatch; this is explicit per request.

## AI provider abstraction and budgets

`server/forge-ai.ts` is the only provider transport. It supports OpenAI Responses, Anthropic Messages, and deterministic mock. `FORGE_ENABLE_AI=false`, missing credentials, or an unavailable configured provider resolves to mock. Credentials are read only in server-only code.

Controls are layered:

1. Per-task requested token ceiling.
2. Process-memory daily token and USD ledger.
3. Database-backed project and monthly estimated-cost ceilings.
4. Persisted `forge_ai_usage` rows containing provider, model, token counts, estimated cost, latency timestamps, and project/task links.
5. Retry limits, request timeout, safe error messages, secret-safe system prompt, and strict schema validation.

Usage views and CSV export are authenticated admin endpoints. Cost values are estimates based on hard-coded pricing and can drift from provider billing.

## Artifact lifecycle

Artifacts have a project, enum type, conventional title, content, JSON metadata, version, size, retention policy, and supersession timestamp. `server/forge-artifacts.ts` creates versions, enforces configured content limits, trims large QA logs, and retains a bounded number of versions. Agents commonly find upstream data by `(projectId, type, title)` and inspect metadata `kind` values.

This gives history but creates hidden coupling: artifact titles, metadata shapes, and memory keys are de facto APIs without a central registry or database constraint.

## Workspace and preview lifecycle

Workspace metadata is persisted in `forge_memories` under `generated_site_workspace`. The server resolves every path beneath the configured repository root and `generated-sites`, rejects traversal and core-app targets, allowlists root files/directories, rejects credential/key filenames, scans content for secrets, destructive shell, and unknown outbound calls, and requires explicit allowance for executable files.

Frontend generation writes a Next.js/TypeScript/Tailwind project. Preview state is stored under `generated_site_preview`. Local mode starts a local Next dev process; Docker mode starts a constrained container. Preview hosts are forced to loopback unless `FORGE_ALLOW_PUBLIC_PREVIEWS=true`. The admin container bind-mounts workspaces, but Nginx never serves that directory.

QA runs install/typecheck/lint/build and integration checks with command timeouts. Repair attempts are bounded by `FORGE_MAX_REPAIR_ATTEMPTS`; patches have structured schemas, path/content checks, and syntax validation. Visual QA can use Playwright/Lighthouse and degrades to explicit unavailable/skipped results when those tools are absent.

## Operational limitations

- The background worker is invoked through an authenticated API route; there is no separate durable worker service in Compose.
- Job claiming is persisted, but process interruption and retry semantics deserve dedicated integration tests.
- Local sandbox mode executes generated project commands on the host and is intentionally less isolated than Docker mode.
- Preview state stores PID/container identifiers in generic memory JSON rather than a dedicated lease table; stale runtime state requires reconciliation.
- Agent orchestration is distributed across route handlers and agent modules, making global stage invariants difficult to prove.

