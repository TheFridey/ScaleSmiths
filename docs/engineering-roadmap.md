# Engineering roadmap

This roadmap groups the current engineering-risk backlog into delivery stages. GitHub issues are the live source of status, ownership, and discussion; inclusion here does not mean that work is scheduled or complete.

Priorities have the following meaning:

- **P0:** release or recovery control that needs immediate closure;
- **P1:** material security, operational, or product risk;
- **P2:** bounded hardening or maintainability work that should follow the risk closures it supports.

## 1. Repo lockdown

| Priority | Issue | Outcome | Dependencies |
| --- | --- | --- | --- |
| P0 | [#52 Enable and verify strict protection for master](https://github.com/TheFridey/ScaleSmiths/issues/52) | GitHub enforcement matches the committed branch-protection contract. | Repository administrator access. |
| P1 | [#54 Enable GitHub secret scanning, push protection and security updates](https://github.com/TheFridey/ScaleSmiths/issues/54) | GitHub blocks and reports credential exposure in addition to repository-side checks. | GitHub plan and organisation capabilities. |
| P1 | [#53 Purge committed Freebuff desktop state from Git history](https://github.com/TheFridey/ScaleSmiths/issues/53) | Historical developer-machine state is removed from every reachable ref. | Coordinate after #52 so the temporary rewrite procedure is controlled. |
| P2 | [#74 Add executable environment-variable ownership validation](https://github.com/TheFridey/ScaleSmiths/issues/74) | Environment ownership and server/public boundaries become machine-checked policy. | Incorporate the decisions from #60 where they affect production services. |

## 2. Engineering-risk closure

| Priority | Issue | Outcome | Dependencies |
| --- | --- | --- | --- |
| P1 | [#57 Design canonical tenant identity mapping and extend database isolation](https://github.com/TheFridey/ScaleSmiths/issues/57) | Portal, report, request, and Forge tenant boundaries can be enforced consistently at the database layer. | Schema design precedes policy rollout; coordinate with #62. |
| P1 | [#58 Eliminate DNS rebinding risk in Forge outbound fetches](https://github.com/TheFridey/ScaleSmiths/issues/58) | Outbound validation and connection use the same approved destination. | None. |
| P1 | [#59 Review and exit the Auth.js v5 beta risk acceptance](https://github.com/TheFridey/ScaleSmiths/issues/59) | Authentication no longer relies indefinitely on a time-limited beta exception. | Upstream Auth.js release/migration options. |
| P1 | [#60 Resolve legal entity, subprocessor and production privacy decisions](https://github.com/TheFridey/ScaleSmiths/issues/60) | Legal and privacy text reflects approved production reality rather than unresolved TODOs. | Business/legal decisions; informs #56. |
| P1 | [#61 Implement enforceable analytics retention and deletion jobs](https://github.com/TheFridey/ScaleSmiths/issues/61) | Configured retention periods are actually enforced and auditable. | Confirm retention decisions under #60. |
| P2 | [#62 Create a shared contract boundary for cross-app tables and triage rules](https://github.com/TheFridey/ScaleSmiths/issues/62) | Web/admin shared concepts stop drifting across duplicate definitions. | Align with the tenant identity design in #57. |
| P2 | [#63 Replace stringly typed Forge artifact and memory dependencies](https://github.com/TheFridey/ScaleSmiths/issues/63) | Forge workflow contracts become versioned and migration-safe. | Sequence before major Forge workflow expansion. |
| P2 | [#64 Add component and accessibility coverage for critical admin workflows](https://github.com/TheFridey/ScaleSmiths/issues/64) | Critical admin UI behaviour gains direct regression and accessibility coverage. | Prefer the stable contracts from #62 and #63 where relevant. |
| P2 | [#73 Evaluate a hardened runtime boundary for untrusted Forge builds](https://github.com/TheFridey/ScaleSmiths/issues/73) | The residual shared-kernel and bridge-egress risk has an evidence-backed treatment decision. | Current sandbox threat model and operational constraints. |
| P2 | [#75 Retire the development-only Drizzle Kit moderate advisory chain](https://github.com/TheFridey/ScaleSmiths/issues/75) | The accepted development dependency advisory is upgraded away or explicitly re-evaluated. | Compatible Drizzle Kit release. |

## 3. Client lifecycle completion

| Priority | Issue | Outcome | Dependencies |
| --- | --- | --- | --- |
| P1 | [#68 Replace clipboard portal passwords with secure invitation and reset flows](https://github.com/TheFridey/ScaleSmiths/issues/68) | Portal account enrolment and recovery no longer depend on administrators copying temporary passwords. | Email delivery and authentication decisions; coordinate with #59. |
| P1 | [#69 Publish real client project milestones and progress to the portal](https://github.com/TheFridey/ScaleSmiths/issues/69) | Static progress placeholders are replaced by authorised project data. | Canonical tenant mapping in #57. |
| P1 | [#70 Add secure document and asset publication to the client portal](https://github.com/TheFridey/ScaleSmiths/issues/70) | Clients can access explicitly published files through an ownership-checked boundary. | Tenant mapping in #57 and storage/security design. |
| P1 | [#71 Unify portal Messages with live request-thread communication](https://github.com/TheFridey/ScaleSmiths/issues/71) | The Messages experience uses the existing authenticated thread capability instead of a placeholder route. | Confirm the intended product model; reuse existing request-thread controls. |
| P1 | [#72 Add end-to-end browser coverage for the authenticated client lifecycle](https://github.com/TheFridey/ScaleSmiths/issues/72) | Login, ownership, requests, reports, invoices, logout, and new lifecycle features are protected end to end. | Cover current flows first, then extend as #68–#71 land. |

## 4. Operational automation

| Priority | Issue | Outcome | Dependencies |
| --- | --- | --- | --- |
| P0 | [#55 Complete and approve a production-derived backup restore drill](https://github.com/TheFridey/ScaleSmiths/issues/55) | Real recoverability and achieved RPO/RTO are evidenced, not inferred from synthetic CI. | Authorised backup access and an isolated restore target. |
| P1 | [#56 Operationalise Sentry and durable log shipping in staging and production](https://github.com/TheFridey/ScaleSmiths/issues/56) | Existing adapters and shipping configuration become an approved, verified production capability. | Privacy/subprocessor decision in #60. |
| P1 | [#65 Add external post-release synthetic smoke monitoring](https://github.com/TheFridey/ScaleSmiths/issues/65) | Releases are checked from outside the host for public and authorised critical paths. | Monitoring destination and escalation ownership from #56. |
| P1 | [#66 Surface Forge queue, lease, retry and preview health in admin operations](https://github.com/TheFridey/ScaleSmiths/issues/66) | Operators can diagnose durable Forge state without direct database inspection. | Stable queue/artifact contracts; coordinate with #63 and #76. |
| P2 | [#67 Define archival and retention policy for Forge jobs and dead letters](https://github.com/TheFridey/ScaleSmiths/issues/67) | Forge operational data has explicit lifecycle, evidence-retention, and deletion rules. | Privacy decisions in #60 and observability requirements in #66. |
| P2 | [#76 Separate Forge worker execution into a dedicated service and database role](https://github.com/TheFridey/ScaleSmiths/issues/76) | Background execution and database privilege are isolated from the admin web process. | Operational visibility in #66 and deployment/topology review. |

## 5. Future expansion

Future product or platform expansion should begin only after its relevant P0/P1 foundations above are closed. Near-term candidates are richer client collaboration built on #68–#72 and broader Forge execution capacity built on #63, #66, #67, #73, and #76. New roadmap entries need a validated current-code gap, an owner, and measurable acceptance criteria; aspirational features should not be mixed with residual-risk closure.

## Retired stale findings

The review validated older audit claims against current executable sources. The following are not open backlog items because the current repository already implements them:

- Generated-site dependency admission and per-site SBOM generation are fail-closed and covered by release checks.
- Monitoring adapters and log-shipping configuration exist; only environment activation and evidence remain under #56.
- Backup scheduling, integrity checks, retention scripts, and synthetic restore tests exist; only the production-derived drill remains under #55.
- Database roles are separated and analytics row-level security exists; the remaining mixed tenant-identity/RLS work is consolidated under #57.
- Committed migrations are checksum-locked and corrected through forward migrations.
- Forge end-to-end orchestration coverage, durable jobs, database-backed rate limits, and managed previews are implemented.
- Production dependency audits currently report no known vulnerabilities; the remaining moderate advisory is development-only and tracked by #75.
- Host-Nginx topology has executable configuration and integration coverage.

These retirements describe the reviewed repository state, not production activation. Operational claims still require the evidence requested by their linked issues.
