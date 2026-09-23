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

## External agent boundary

Grok receives only a scoped service identity and narrow MCP methods. Human approval operations, policy mutation, secret access, payment execution and production deployment are not exposed to Grok.

## Emergency STOP

A global pause control must fail closed for agent-originated mutating actions. Rhys and Trev may activate STOP. STOP revokes or blocks Grok/MCP execution while preserving read-only audit visibility.

STOP does not alter ledger history, approvals already recorded or capital ownership. Resume must be an explicit authenticated human action and must create an audit event.

## Payment boundary

Experiment #000 is fully simulated.

Experiment #001 may track real ring-fenced capital, but agents continue to have £0 direct real-money execution authority. Human execution remains mandatory until a future separately approved payment-automation phase.
