# Forge artifact provenance and lineage

Migration `0019_artifact_provenance.sql` promotes provenance to first-class columns on every artifact row. Historical rows receive deterministic input/output hashes and conservative `requires_review` quality. New versioned writes use SHA-256 canonical hashing.

Each version records its project/type/version, parent artifact, source task, provider/model, prompt/schema/source release versions, upstream IDs and hashes, input/output hashes, actor, validation and quality, approval history, creation time, and superseded time. `ERROR_MONITORING_RELEASE` or `GIT_COMMIT_SHA` supplies the repository/source version when available.

`saveVersionedForgeArtifact` is the append-only write boundary. It supersedes the previous current row, creates the next version with a parent pointer, and records an activity event. Version pruning is disabled because lineage must remain auditable. Large content can still be compacted according to the configured byte limit; its stored-output hash describes the retained content.

The Forge artifact tabs show the version timeline, line differences, source task, parent/upstream dependencies, provider/model, prompt/schema versions, hashes, approval history, superseded status, and degraded/fallback warnings.

`GET /api/forge/projects/:projectId/artifacts/:artifactId` returns the complete same-title lineage and differences. `POST` with `{ "action": "rollback", "reason": "..." }` creates a new unapproved version derived from the selected historical version. Historical content is never overwritten by rollback.

Apply migration `0019` before deploying this application. PostgreSQL `pgcrypto` is enabled by the migration for SHA-256 hashing of compatibility writes.
