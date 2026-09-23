# Nova Venture Lab Architecture

## Boundary

Venture Lab is an Admin-owned bounded domain inside the existing ScaleSmiths modular monolith.

It does not create a third Next.js application, a second PostgreSQL database or a separate deployment pipeline for MVP.

```text
Trev
 └─ final business/capital authority
    Nova
     └─ strategy / challenge / recommendations
        Nova Core (ScaleSmiths Admin)
         ├─ Venture state
         ├─ Evidence
         ├─ Experiments
         ├─ Budgets / ledger
         ├─ Approvals
         ├─ Metrics
         └─ Audit
            ├─ Admin dashboard
            └─ restricted MCP adapter
                 └─ Grok Venture Director

Jarvis / Rhys
 └─ architecture, implementation, security and emergency technical STOP
```

## Source of truth

PostgreSQL-backed Nova Core state is authoritative.

The following are not authoritative operational state:

- ChatGPT memory;
- Grok memory;
- Cursor history;
- local agent files;
- chat transcripts.

They may create recommendations or evidence submissions, but authority and durable state live in Nova Core.

## Domain modules

Initial code should remain under Admin:

```text
admin/src/app/(protected)/venture-lab/
admin/src/app/api/venture-lab/
admin/src/lib/venture-lab/
admin/src/lib/server/venture-lab/
docs/venture-lab/
```

## Core entities

- actors;
- service accounts;
- ventures;
- opportunities;
- evidence;
- experiments;
- experiment decisions;
- tasks;
- agent runs;
- metrics;
- budget envelopes;
- ledger accounts;
- ledger journals;
- ledger postings;
- approval requests;
- approval events;
- recommendations;
- gate checks;
- audit events.

## Venture lifecycle

```text
DISCOVERED
  -> RESEARCHING
  -> VALIDATION_CANDIDATE
  -> VALIDATING
  -> VALIDATED
  -> BUILD_APPROVED
  -> BUILDING
  -> QA
  -> LAUNCH_APPROVAL
  -> LIVE
  -> MEASURING
  -> SCALE | MAINTAIN | KILL
```

There is no generic unrestricted status update. Transitions are explicit server-side domain actions that validate prerequisites.

## Human-control boundary

`venture_controller` is the least-privilege authenticated role intended for Trev's Venture Lab operating identity. It receives Venture Lab finance/launch approval, experiment-management, integration-management, STOP and audit authority without inheriting unrelated ScaleSmiths client, Forge, deployment, settings, general finance-write or admin-user-management capabilities. Production MFA is mandatory for this role.

Rhys's `developer` identity retains technical containment: it may activate STOP and revoke Venture Lab service access, but it cannot approve capital or launch proposals and cannot resume Venture Lab after STOP.

## External agent boundary

The dedicated service identity is `venture-director`. Its scopes are persisted in PostgreSQL and immutable after creation. The service identity is provisioned without a credential until a later Nova + Trev connection gate.

The only gateway route is `POST /api/venture-lab/mcp`. It authenticates a version-bound bearer credential whose secret is never stored; only its SHA-256 hash is persisted. The credential resolves service identity and scopes from PostgreSQL. Request bodies and prompts cannot select or impersonate a human actor.

The current MCP tool surface is read/propose only:

- `venture.status.get`;
- `venture.opportunities.list`;
- `venture.opportunities.propose`;
- `venture.evidence.list`;
- `venture.evidence.propose`;
- `venture.experiments.list`;
- `venture.approvals.list`;
- `venture.ledger.list`;
- `venture.audit.list`;
- `venture.proposals.create`.

There is no MCP tool for human approval, capital release, payment, secret access, production deployment, policy mutation, constitution mutation, STOP/resume or service-permission changes. SPEND and LAUNCH items submitted by the service are proposals only and require separate authenticated human resolution.

## Emergency STOP

A global pause control fails closed for service-originated mutating actions while preserving read-only audit visibility. Owner, administrator, Venture Controller and developer identities may activate STOP for containment.

Resume is intentionally asymmetric: only owner, administrator or Venture Controller may resume. The PostgreSQL runtime-state trigger independently enforces that asymmetry and records the human transition actor. A developer identity cannot restart the system after containing it.

STOP does not alter ledger history, approvals already recorded or capital ownership. Service credentials can also be revoked independently; service-account revocation advances token version and cannot be reversed.

## Payment boundary

Experiment #000 is fully simulated.

Experiment #001 may track real ring-fenced capital, but agents continue to have £0 direct real-money execution authority. Human execution remains mandatory until a future separately approved payment-automation phase.
