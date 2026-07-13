# ADR 0004: Forge Structured-Output Architecture

- Status: Accepted
- Date: 2026-07-13

## Context

Forge agents create research, sitemap, copy, design, component specification, generated code, QA, review, proposal, and deployment artifacts. These stages depend on structured outputs, schema validation, task records, artifact metadata, and activity logs rather than free-form chat transcripts alone.

## Decision

Keep Forge as a structured-output pipeline. Agents request validated JSON-shaped outputs, persist task and artifact state, store prompt/schema/version metadata where available, and separate generated content from human-approved content.

## Alternatives Considered

- Free-form AI text stored directly as final output.
- One monolithic agent that owns the whole project.
- External prompt-management or workflow orchestration service.

## Consequences

Structured output makes Forge outputs auditable, testable, and easier to connect to approval gates and downstream generation. It also increases schema maintenance burden and requires careful migration/version handling.

## Security Implications

Structured validation reduces accidental unsafe output but does not make AI trustworthy. Provider credentials remain server-only, prompts must avoid secrets, and generated artifacts still require human review and sandboxed execution.

## Operational Implications

Schema changes require tests and migration notes. Failures should produce safe user-facing errors and internal diagnostics without leaking provider responses or client-sensitive prompt content.

## Related Code or Documentation

- `admin/src/lib/server/forge-*-agent.ts`
- `admin/src/lib/forge-prompt-registry.ts`
- `admin/src/lib/server/forge-job-runner.ts`
- `docs/architecture/forge-workflow.md`
- `docs/architecture/prompt-schema-registry.md`
- `README.md#admin-forge`
