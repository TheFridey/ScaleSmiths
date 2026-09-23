# Nova Venture Lab Security

## Security objective

Agent intelligence must never imply agent authority.

All consequential permissions are enforced by authenticated server-side code and PostgreSQL-backed policy, not prompts.

## Threats and required controls

### Prompt injection
External content is untrusted data. It cannot alter permissions, policy, budgets, approvals or state-machine gates.

### Grok/service token compromise
The Venture Director service account has immutable PostgreSQL scopes limited to explicit read/proposal operations. Credentials are version-bound bearer tokens; only a SHA-256 hash is stored. Authentication requires the credential and service account to both remain active and to share the same token version.

A compromised credential must not approve spend, release reserve, change policy or constitution, read secrets, alter its own scopes, resume Venture Lab, execute payments or deploy production changes. Revoking the service account immediately invalidates every credential bound to its prior token version.

### Agent impersonation
Actor identity is resolved from the authenticated credential/session. Request bodies and prompt content cannot choose a more privileged actor. Agent-created opportunities, evidence and proposals are stamped with the authenticated service identity even if the payload claims to be Trev, Nova, Rhys or another human.

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
Owner, administrator, Venture Controller and developer identities may activate global STOP immediately. STOP blocks service-originated mutation and integration execution but leaves read-only evidence/audit access available. Only owner, administrator or Venture Controller may resume, and PostgreSQL independently validates that role. Service credentials can be revoked independently and revoked service accounts cannot reactivate.

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
