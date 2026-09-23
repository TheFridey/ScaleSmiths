# Nova Venture Lab Security

## Security objective

Agent intelligence must never imply agent authority.

All consequential permissions are enforced by authenticated server-side code and PostgreSQL-backed policy, not prompts.

## Threats and required controls

### Prompt injection
External content is untrusted data. It cannot alter permissions, policy, budgets, approvals or state-machine gates.

### Grok/service token compromise
A compromised Grok credential may at most perform its explicitly scoped read/proposal operations. It must not approve spend, release reserve, change policy, read secrets or deploy production changes.

### Agent impersonation
Actor identity is resolved from the authenticated credential/session. Request bodies cannot choose a more privileged actor.

### Approval replay
Approvals have lifecycle state, expiry, exact payload binding and one-time consumption.

### Parameter substitution
Canonical payload hashing binds approval to exact consequential parameters.

### Concurrent overspend
Budget reservation/consumption is transactional and database-authoritative.

### Credential exfiltration
No MCP response returns secrets. Provider keys, database URLs, SSH credentials, payment credentials and recovery material remain outside agent-readable state.

### Audit destruction
Venture Lab audit and ledger records are append-oriented. Runtime permissions should avoid UPDATE/DELETE on immutable financial/audit history where practical.

### Emergency containment
Rhys and Trev may activate global STOP immediately. STOP blocks agent-originated mutation and integration execution. Grok/service credentials can be revoked independently.

## Evidence preservation

Where practical, evidence records retain:

- source URL;
- source title;
- evidence type;
- claim;
- summary;
- supporting excerpt;
- observed/published date when known;
- captured_at;
- content hash;
- submitting actor.

The supporting excerpt must be short and purpose-limited. Do not copy entire webpages into the database merely for provenance.

A content hash proves what captured evidence payload informed the decision; it does not prove the external source itself was truthful.

## Logging

Consequential events should identify:

- timestamp;
- actor;
- venture;
- experiment;
- action;
- reason summary;
- input/result metadata;
- evidence references;
- approval ID when applicable;
- ledger journal ID when applicable;
- request/idempotency identifiers.

## Experiment #000 security gate

Experiment #000 must deliberately attempt malicious prompts, fake approvals, replay, reserve attacks, parameter changes, duplicate execution, status bypass and self-escalation.

Experiment #001 is blocked until all mandatory #000 security and finance invariants pass.
