# ADR 0014: Nova Venture Lab as an Admin bounded domain

- Status: Accepted
- Date: 2026-09-22

## Context

Nova Venture Lab tests whether a governed human + AI operating system can identify genuine customer problems, validate demand cheaply, create useful digital products only when evidence justifies doing so, measure outcomes, protect capital, kill weak experiments and reinvest profits.

ScaleSmiths already provides the hard platform primitives this experiment needs: authenticated Admin, MFA, capability-based RBAC, PostgreSQL, Drizzle migrations, durable Forge job patterns, database-authoritative budget controls, audit/activity logging, sandboxing, rate limiting, backups, release gates and CI security controls.

Creating a standalone Venture Lab application, database, worker and deployment stack would duplicate those controls and increase the attack surface before the business hypothesis is proven.

## Decision

Implement Nova Venture Lab as a distinct bounded domain inside `admin/`.

Venture Lab owns its own tables, domain services, state machine, financial simulation, approvals, audit events and routes. It may reuse proven ScaleSmiths infrastructure and patterns, but Forge and Venture Lab remain semantically separate domains.

Chats, model memory, Grok files and Cursor history are not authoritative state. PostgreSQL-backed Nova Core state is authoritative.

Experiment #000 is mandatory before any real Venture Lab capital is introduced. Experiment #001 is the first experiment allowed to use the real ring-fenced £100.

## Authority

- Trev is final business and capital authority.
- Nova leads venture strategy, business challenge, portfolio reasoning and decision support.
- Jarvis leads technical challenge, architecture, implementation and engineering integrity.
- Rhys is technical authority and has emergency STOP authority: he may immediately pause Venture Lab, revoke Grok or disable MCP/integrations when suspicious behaviour is observed. This does not permit release of protected capital unless Trev explicitly delegates it.
- Grok is an execution/research actor only and cannot approve its own consequential actions.

## Financial boundary

MVP contains no autonomous real-money execution. Grok may request spend. Trev approves or rejects. A human executes approved purchases. Agent direct real-money authority remains £0.

## Consequences

The initial implementation is smaller, cheaper and inherits existing ScaleSmiths operational controls. A future extraction into a separate service requires measured isolation, scaling or ownership needs rather than architectural preference.

## Related documents

- `docs/venture-lab/constitution.md`
- `docs/venture-lab/architecture.md`
- `docs/venture-lab/financial-rules.md`
- `docs/venture-lab/security.md`
- `docs/venture-lab/experiment-000.md`
