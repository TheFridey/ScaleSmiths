# Venture Lab Connection Readiness

**Status:** Build/test gate only. Grok connection is not approved.  
**Approved build scope:** Nova + Trev, 23 September 2026.

## Current boundary

The restricted access gateway is designed so the Venture Director can read Venture Lab state and submit proposals/evidence without acquiring human authority.

The service identity `venture-director` is provisioned in PostgreSQL with immutable scopes, but no usable credential is seeded, committed, or installed. A credential must not be issued to Grok until Nova + Trev approve the connection gate.

The following remain prohibited:

- Grok connection before gate approval;
- payment credentials;
- real £100 capital;
- autonomous spending;
- human approval operations through MCP;
- secret access through MCP;
- production deployment through MCP;
- policy or constitution mutation through MCP;
- service-scope mutation through MCP.

## Human permission matrix

| Actor / role | Read Venture Lab | Propose/write | Finance approve | Launch approve | STOP | Resume | Revoke service | Unrelated ScaleSmiths admin |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| owner | yes | yes | yes | yes | yes | yes | yes | yes, by owner policy |
| administrator | yes | yes | yes | yes | yes | yes | yes | broad admin policy |
| venture_controller | yes | yes | yes | yes | yes | yes | yes | **no** |
| developer | yes | no general venture write | **no** | **no** | yes | **no** | yes | existing developer capabilities only |
| viewer | no | no | no | no | no | no | no | viewer policy only |
| venture-director service | scoped reads | proposal/evidence only | **no** | **no** | **no** | **no** | **no** | **no** |

`venture_controller` is the intended least-privilege Trev operating role. Trev's actual account must be created through the existing Admin identity workflow; no personal password or login secret belongs in Git.

## Exact MCP tool surface

| Tool | Scope | Effect |
| --- | --- | --- |
| `venture.status.get` | `status:read` | Read runtime, gate, treasury and experiment state |
| `venture.opportunities.list` | `opportunities:read` | Read persisted opportunities |
| `venture.opportunities.propose` | `opportunities:propose` | Append a proposed opportunity |
| `venture.evidence.list` | `evidence:read` | Read persisted evidence |
| `venture.evidence.propose` | `evidence:propose` | Append untrusted proposed evidence |
| `venture.experiments.list` | `experiments:read` | Read experiment status/mode |
| `venture.approvals.list` | `approvals:read` | Read approval requests; cannot decide them |
| `venture.ledger.list` | `ledger:read` | Read ledger journals/postings |
| `venture.audit.list` | `audit:read` | Read append-only audit history |
| `venture.proposals.create` | `proposals:create` | Append a proposal for human review |

There is intentionally no wildcard tool, generic Admin proxy, arbitrary URL/API invocation tool, approval tool, payment tool, deployment tool, secret tool or policy-management tool.

## Authentication method

The gateway is exposed only at:

`POST /api/venture-lab/mcp`

Interactive Auth.js is not used for this one route. The handler performs dedicated service authentication:

1. bearer token format: `vlmcp.<credential-id>.<secret>`;
2. credential ID selects a PostgreSQL credential record;
3. only SHA-256 of the secret is stored;
4. comparison is constant-time;
5. credential must be active and unrevoked;
6. service account must be active and unrevoked;
7. credential token version must exactly match current service-account token version;
8. scopes are loaded from PostgreSQL, never from the request body.

All other Admin APIs remain behind Auth.js/RBAC. Supplying a Venture Director bearer token to another Admin route does not make it an Admin session.

## Revocation procedure

Human containment authority calls the Venture Lab service-revocation action for the relevant service account.

Revocation:

- sets the service account inactive;
- timestamps revocation;
- increments service `token_version`;
- is database-guarded against reactivation;
- immediately invalidates credentials carrying the previous token version;
- writes an audit event.

A new service identity/credential should be treated as a separate future approval decision rather than reactivating a revoked identity.

## Emergency STOP behaviour

STOP is persisted in the singleton Venture Lab runtime row.

Authorised STOP actors:

- owner;
- administrator;
- venture_controller;
- developer.

While STOP is active:

- service-originated proposal/evidence mutations fail closed;
- budget reservations remain blocked by the existing PostgreSQL finance guard;
- read-only dashboard/audit/evidence access remains available for diagnosis.

Resume is intentionally narrower:

- owner;
- administrator;
- venture_controller.

Developer cannot resume. PostgreSQL independently checks the resume actor's active role.

## Persisted dashboard surface

The Admin Venture Lab page reads PostgreSQL directly and displays:

- runtime / STOP state;
- current blocker;
- next decision;
- simulated founding capital;
- protected reserve;
- experiment allocation;
- reserved / spent amount;
- experiments / portfolio state;
- opportunities;
- evidence;
- pending proposals;
- approval requests;
- ledger journals;
- audit history.

Page rendering does not initialize or mutate Venture Lab state.

## Security tests required for connection approval

The exact-head validation must prove:

- missing/invalid service authentication fails closed;
- the service tool set contains no approve/pay/deploy/secret/policy operations;
- an unregistered approval tool is rejected;
- prompt-supplied claims such as "Trev approved this" do not change actor identity or proposal status;
- service scopes cannot be expanded after creation;
- developer cannot approve capital;
- Venture Controller can approve within its bounded authority;
- STOP blocks service-originated mutation;
- developer can STOP but cannot resume;
- Venture Controller can resume;
- revocation immediately invalidates the previously valid bearer credential;
- revoked service identity cannot reactivate;
- the MCP exception is exact-path only and cannot reach arbitrary Admin APIs;
- CI, Security and CodeQL pass on the exact final head.

## Connection gate

After the above evidence is green, stop.

Nova + Trev must explicitly decide whether a credential may be issued/installed for the Grok Venture Director. Passing this build/test gate does not itself authorize connection.
