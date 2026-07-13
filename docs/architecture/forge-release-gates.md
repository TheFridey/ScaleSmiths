# Forge preview, approval and release gates

Release gates are evaluated centrally on the server against one immutable deployment candidate. The UI renders the same result returned by the server, but it is not a security boundary. Both `mark_ready` and `mark_deployed` independently require an approved candidate, re-verify its workspace and artifact hashes, and run the full gate policy.

## Gate policy

| Gate | Evidence | Override |
| --- | --- | --- |
| Workspace and artifact integrity | Recomputed workspace SHA-256 and captured artifact ID/version/hash | Never |
| Build, typecheck and lint | Frozen QA command results | Never |
| Accessibility | Frozen accessibility report with no critical blocker | Owner only |
| Security | Frozen security scan with no critical finding | Owner only |
| Content and design approval | Approved artifact versions captured by the candidate | Never |
| Fallback/degraded warning | Candidate dependency-quality snapshot | Owner only |
| Visual QA | Frozen visual QA result | Owner only |
| Client approval | Candidate-specific manual approval | Never treated as an override |
| Release authorisation | Approved candidate, approved through `deployments.execute` | Never |
| Dependency policy | Frozen dependency-policy evidence | Owner only |
| Migration plan | Required only when migration requirements exist | Explicit approval or owner override |

Missing automated evidence blocks the corresponding gate. The result names every blocked gate and its evidence-derived reason.

## Decisions and revocation

`forge_release_gate_decisions` records candidate, workspace hash, gate, decision, actor, role, timestamp and mandatory reason. Only the `owner` role may create an override, and only for the allowlisted categories above. Fundamental integrity, build, typecheck, lint, content, design and release-authorisation checks reject override attempts server-side.

Approvals are candidate-specific. Creating a new candidate does not inherit decisions. Decisions are also ignored if their stored candidate workspace hash differs from the candidate hash. Submitted candidates are immutable, so any relevant workspace or artifact change fails integrity verification and requires a new candidate and fresh approvals.

Revocation writes a replacement `revoked` decision and an activity-log entry. All decisions use the existing `deployments.execute` API capability; reads require `forge.read`. Direct calls to deployment endpoints run the same policy and cannot bypass the UI.

## Migration

Apply `admin/drizzle/0041_forge_release_gates.sql` after `0040_forge_deployment_candidates.sql` using the repository migration process.

Until security and dependency-policy evidence is present in a candidate snapshot, those gates deliberately remain blocked. An owner can record a reasoned, audited override, but ordinary administrators and developers cannot.
