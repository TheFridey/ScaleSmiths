# Venture Lab Connection Readiness

**Status:** Build/test gate only — Grok is not connected.  
**Approved scope:** Nova + Trev, 23 September 2026.  
**External boundary:** no Grok connection, no payment credentials, no real £100, no autonomous spending.

## Human authority

### Venture Controller

The dedicated Admin role is `venture_controller`.

It is authenticated through the existing ScaleSmiths Admin identity stack. It does not create a parallel login or identity system.

Reviewed capabilities:

- `venture.read`
- `venture.write`
- `venture.finance.read`
- `venture.finance.approve`
- `venture.experiment.manage`
- `venture.launch.approve`
- `venture.integration.manage`
- `venture.emergency_stop`
- `venture.audit.read`

It does **not** receive generic ScaleSmiths finance write, Admin-user management, Forge execution, deployment, claims, sales, client-management or settings-management authority.

Generic `owner` and `administrator` roles do not receive Venture Lab finance or launch approval authority. PostgreSQL independently requires an active `venture_controller` identity before a Venture Lab financial approval can transition to `APPROVED`.

Production MFA is mandatory for `venture_controller`. MFA enrolment is a self-service identity operation bound to the current session and does not grant broader settings authority. The existing tightly bounded `ADMIN_MFA_BOOTSTRAP_GRACE_UNTIL` mechanism is used for initial privileged-account enrolment.

No Trev credentials are seeded by migration or source code. A real Trev account must be provisioned by an authorised human using his real email, temporary password and MFA enrolment.

## Experiment #000 capital boundary

The existing PostgreSQL controls remain unchanged:

- simulated founding capital: £100;
- protected reserve: £75, immutable and non-spendable;
- experiment allocation: £25, immutable;
- Experiment #000 mode: `SIMULATED`, immutable.

The Venture Controller can approve exact spend requests inside the existing £25 envelope. This phase does not add an API or tool that can raise the allocation, make the reserve spendable or switch Experiment #000 to real money.

## Human control surface

Authenticated Admin routes:

| Operation | Route | Capability | Database enforcement |
| --- | --- | --- | --- |
| Approve exact spend request | `POST /api/venture-lab/approvals/:id/approve` | `venture.finance.approve` | active Venture Controller, request state, expiry, exact payload |
| Emergency STOP / resume | `POST /api/venture-lab/runtime` | `venture.emergency_stop` | singleton runtime state + audit |
| Revoke service identity | `POST /api/venture-lab/service-accounts/:id/revoke` | `venture.integration.manage` | irreversible active→revoked transition + token-version increment |

The persisted `/venture-lab` dashboard exposes these controls only when the signed-in role has the required capability. Server/API/database enforcement remains authoritative even if UI controls are bypassed.

## Persisted dashboard

`/venture-lab` reads PostgreSQL-backed state for:

- experiment state and mode;
- runtime STOP state;
- £100 / £75 / £25 treasury state;
- opportunities;
- evidence;
- proposals;
- approval requests;
- ledger journals and debit/credit totals;
- audit history;
- service identities;
- current blocker;
- next human decision.

PostgreSQL is the source of truth. Chats, model memory, prompt content and external documents are not authority.

## Restricted MCP endpoint

Endpoint:

`POST /api/venture-lab/mcp`

Authentication:

1. `Authorization: Bearer <VENTURE_DIRECTOR_MCP_TOKEN>`;
2. constant-time token comparison;
3. fixed logical service identity `venture-director`;
4. service account must be active and not revoked;
5. Venture Lab emergency STOP must be inactive;
6. checks repeat before each tool execution.

The environment variable is declared empty in `.env.example`. It must remain unset in production until Nova + Trev approve the connection gate.

The endpoint is not an Admin API proxy. A caller cannot supply a route, URL, capability, user id or arbitrary operation to escape the allowlist.

## Exact MCP tool surface

| Tool | Class | Allowed effect |
| --- | --- | --- |
| `venture.dashboard.read` | read | Read the persisted Experiment #000 snapshot |
| `venture.opportunities.list` | read | List persisted opportunities |
| `venture.opportunities.propose` | proposal | Create a proposed opportunity + pending proposal |
| `venture.evidence.list` | read | List bounded evidence |
| `venture.evidence.submit` | proposal/data | Persist bounded evidence as untrusted data |
| `venture.proposals.list` | read | List proposals |
| `venture.experiment.propose` | proposal | Create a simulated experiment proposal for human review |

There are no MCP tools for:

- human approval;
- capital release;
- launch approval;
- payment execution;
- credentials or secrets;
- deployment;
- policy/constitution changes;
- service permission changes;
- arbitrary Admin API access.

Unexpected argument keys are rejected rather than ignored. Prompt-supplied fields such as `approvedBy`, `role`, `actorUserId`, `adminPath` or payment credentials therefore cannot become authority.

## Revocation procedure

Human operator with `venture.integration.manage`:

1. open the Venture Lab dashboard;
2. record a reason;
3. revoke the `venture-director` service identity.

The database transition:

- sets `active=false`;
- records `revoked_at`;
- increments `token_version`;
- cannot be reversed;
- writes an audit event.

Both MCP authentication and every tool execution re-check current service state. A revoked service therefore loses access immediately even if it still possesses the old bearer token.

A new service identity requires an explicit future provisioning decision; revocation is not undone by toggling the old identity back on.

## Emergency STOP behaviour

When STOP is active:

- MCP authentication fails closed;
- MCP tool execution re-checks STOP and fails closed;
- existing financial reservation guards remain blocked;
- the persisted dashboard shows `EMERGENCY STOP`.

STOP does not require Grok cooperation and does not depend on prompt content.

## Security tests

Required evidence before connection approval:

- non-allowlisted finance-approval tool rejected;
- prompt-supplied authority field rejected;
- valid proposal is persisted as a proposal, not an approval;
- MCP audit actor is the service identity, not Trev;
- STOP blocks MCP authentication;
- service revocation blocks both authentication and subsequent tool execution;
- Controller MFA requirement passes;
- Controller RBAC has no unrelated ScaleSmiths privileges;
- owner/administrator cannot substitute for the Venture Controller at the database financial-approval boundary;
- migration history/checksum/shared-order checks pass;
- full CI, Security and CodeQL pass on the exact final head.

## Connection gate

Building and testing this boundary does not authorise connection.

Before Grok is connected, return:

1. exact final commit;
2. full CI/Security/CodeQL results;
3. MCP tool list;
4. role/capability matrix;
5. authentication method;
6. revocation evidence;
7. STOP evidence;
8. adversarial security-test evidence.

Then stop.

Nova + Trev make the next formal decision.

**The system does not get trusted because we designed it carefully. It earns trust by surviving attempts to break it.**
