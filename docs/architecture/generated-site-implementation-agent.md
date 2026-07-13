# Repository-aware generated-site implementation agent

The implementation agent applies reviewed, structured file changes to one assigned Forge workspace. It is not a general shell or autonomous deployment system.

## Workflow

1. The caller supplies the issue, a non-empty plan, affected files, complete replacement contents, reasons, and requested validation commands.
2. Forge resolves and canonicalises the recorded workspace, rejects symlinks and ownership mismatches, and inventories its files.
3. Every change passes the existing generated-workspace path, filename, secret, outbound-request, and executable-content controls.
4. Forge records the task and each file modification with before/after SHA-256 hashes.
5. Validation runs in the hardened Docker sandbox with no network. Only `npm run typecheck`, `npm run lint`, and `npm run build` are accepted.
6. Command output is bounded, resource limits come from the existing Forge sandbox configuration, and every result is recorded.
7. A successful run finishes as `requires_review`, with downstream use disabled and publication blocked until human approval.

The endpoint is `POST /api/forge/projects/:id/implementation-agent` and requires the server-side `forge.execute` capability.

## Security boundary

The workspace is the only read/write mount. Docker runs with a non-root UID/GID, dropped capabilities, `no-new-privileges`, a read-only container filesystem, PID/CPU/memory limits, bounded temporary filesystems, and no network for agent commands. The host environment is replaced by the existing secret-free generated-process environment. The Docker socket is neither mounted nor exposed to the container.

Package manifests cannot be modified through this agent because executable/script-bearing files require a separate approval path. Dependency installation is not an allowed command. Deployment is not an agent capability.

## Audit and failure behaviour

Activity records cover inspection/start, each modification, each command result, terminal failure, and the approval wait state. Task output contains the plan, diff summary, hashes, validation evidence, risks, and configured repair ceiling. Provider response bodies, secrets, and host paths are not recorded.

The endpoint accepts an already-structured plan and replacement contents from the controlling Forge workflow. It does not independently call an AI provider. Optional pre-planned repair patch sets are validated before execution, applied only after a failed validation batch, audited separately, and capped at three attempts. Exhausted failures remain failed and cannot proceed.

## Operations

Set `FORGE_SANDBOX_RUNNER=docker`. `FORGE_CODING_AGENT_COMMAND_TIMEOUT_MS` defaults to 180 seconds and is capped at 300 seconds. Existing `FORGE_SANDBOX_*` CPU, memory, PID, user, image, and network controls remain authoritative.
