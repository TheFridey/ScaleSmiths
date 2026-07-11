# Generated-code execution threat model

## Trust boundary

Forge-generated source and dependency content is untrusted. Production must set `FORGE_SANDBOX_RUNNER=docker`; the local runner is a developer convenience and cannot enforce kernel resource, filesystem, PID, capability, or network isolation.

## Enforced controls

| Threat | Control |
|---|---|
| Host secrets | Generated processes receive an allowlisted environment with no application/provider/database or Docker-control variables. Containers receive only three fixed non-secret variables. |
| Filesystem/parent escape | Lexical path normalization, generated-root containment, canonical `realpath` containment, workspace ownership validation, and recursive symlink rejection run before QA/preview. Only the project workspace is mounted writable. |
| Docker socket | No socket or other host path is mounted; Docker environment endpoints are removed from generated environments. |
| Host services/metadata/outbound | Build/QA network defaults to `none`. Install network is separately controlled and defaults to `none`. Unknown literal outbound requests are rejected during generated-file validation. |
| Fork/process bombs | Docker PID limit, `nproc` ulimit, `--init`, non-root user, and dropped capabilities. |
| CPU/memory exhaustion | Docker CPU and memory hard limits; bounded tmpfs. |
| Infinite commands | Parent-side build, install, QA, and preview readiness timeouts terminate work. |
| Log flooding | QA stdout/stderr is bounded while streaming and retained logs are truncated; preview logs cap entries and bytes. |
| Dependency scripts | `npm install --ignore-scripts` prevents dependency lifecycle scripts in QA and preview setup. Auditing/lockfile policy remains a separate supply-chain control. |
| Privilege escalation | Numeric non-root user, all capabilities dropped, `no-new-privileges`, read-only root filesystem, no privileged mode. |
| Public preview | Default preview host is loopback; public binding requires the explicit existing opt-in. Docker publishing uses the resolved host. Generated workspaces remain outside public app roots. |

The Docker profile also limits open files, uses `--rm`, does not inherit host environment variables, and mounts `/tmp` and the container home as size-limited `noexec,nosuid,nodev` tmpfs locations. Workspace content remains writable because Next.js and package tooling require build output.

## Network modes

`FORGE_SANDBOX_NETWORK=none` is mandatory for ordinary builds and QA. `FORGE_SANDBOX_INSTALL_NETWORK` should remain `none` when dependencies are already present or supplied from a controlled cache. Enabling bridge mode permits general outbound access because Docker bridge is not a domain allowlist. Preview bridge mode is required for host loopback publishing but must not be treated as outbound isolation.

Cloud metadata endpoints are unreachable with network `none`. When bridge networking is enabled, block link-local metadata ranges and private management networks at the host/container firewall; the application cannot express destination allowlists using Docker's basic network flag.

## Operational requirements

- The configured `FORGE_SANDBOX_USER` must exist in the image and own the generated workspace. Default: `1000:1000` for the Node image.
- Do not mount `/var/run/docker.sock`, the repository root, home directories, SSH directories, or secret files into sandbox containers.
- Pin and periodically rebuild `FORGE_SANDBOX_DOCKER_IMAGE`; image tags and npm dependencies are supply-chain inputs.
- Keep public previews disabled and host-Nginx routes away from generated preview ports.
- Run expired-container/workspace cleanup and monitor timeout, OOM, PID-limit, and rejected-workspace events.

## Residual risks

- The local runner has the permissions of the admin process. It is unsuitable for adversarial generated code.
- Docker shares the host kernel; a container-runtime or kernel vulnerability remains in scope. A microVM/gVisor/Kata boundary would reduce this risk but is not part of the current architecture.
- Bridge-mode installs/previews can make unexpected outbound requests and may reach networks allowed by the host firewall.
- `--ignore-scripts` does not make package source trustworthy: build tooling can execute imported package code later.
- The workspace must be writable, so generated code can corrupt its own project. Lineage/versioning and regeneration provide recovery, not prevention.
- Timeouts terminate the launched process/container, but host failure during cleanup can leave a container until operational cleanup runs.
- Static outbound/secret scanning is defense in depth and cannot recognize every obfuscated behavior.

## Automated fixtures

`forge-sandbox-security.test.ts` harmlessly simulates traversal, environment-secret access, outbound code, package scripts, log flooding, unsafe Docker flags, socket exposure, and public binding. Existing Forge tests cover preview host defaults, file allowlists, destructive commands, and resource configuration.
