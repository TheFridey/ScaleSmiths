# Controlled migration execution

Forge creates a migration deployment candidate only from the current approved `site_inventory` and `migration_analysis` artifacts. `POST /api/forge/projects/{projectId}/migration-execution` freezes the old-to-new mapping into a versioned `migration_candidate` artifact and records its SHA-256 mapping hash.

## Candidate contents

The candidate classifies target content as migrated, rewritten from approved copy, or newly generated. It records source URLs, approved fact inputs, unsupported high-risk claims, preserved high-value URLs, proposed Nginx redirects, internal-link/canonical/metadata coverage, old-URL coverage, assets awaiting migration, redirect chains and loops, conflicts, blockers, provenance, and a final validation checklist.

Source content remains evidence rather than an authoritative fact. Contact-data conflicts, business-fact conflicts, unsupported claims, redirect loops/chains, orphaned old URLs, broken mapped links, and incomplete asset migration prevent approval where applicable.

## Approval sequence

`PATCH /api/forge/projects/{projectId}/migration-execution` accepts an artifact ID, reason, and one of:

- `redirect_export`: requires `forge.approve`, a blocker-free candidate and an intact mapping hash.
- `deployment`: requires `deployments.execute`, prior redirect-export approval and an intact mapping hash.
- `rollback`: requires `forge.approve` and creates a new version from a historical candidate with both approvals reset.

Approval changes metadata and the checklist but never changes the frozen mappings. Redirect configuration remains draft until approved and is never installed by this workflow. Deployment approval is recorded separately; this endpoint does not deploy.

## Rollback and provenance

Rollback is append-only. It creates a new candidate referencing the historical candidate and source artifact hash through normal artifact provenance. Historical mappings, approval history and deployment candidates remain available for audit.

Apply `0033_migration_candidate.sql` before enabling the workflow.
