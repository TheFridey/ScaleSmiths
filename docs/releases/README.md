# Release evidence

This directory indexes immutable or reproducible release evidence. It does not authorise deployment.

## Current report

- [Release candidate — 2026-07-20](rc-2026-07-20.md) — regenerated from the current clean HEAD (`ab459cc`). **Blocked**: the admin production npm audit fails on a High-severity undici advisory, and image/SBOM/backup/GitHub-native/human evidence is outstanding.
- [Machine-readable candidate manifest](rc-2026-07-20.json).
- **Errata (2026-07-21):** an independent audit at `85a384f` found that this candidate listed a Forge E2E gate that did not exist, and understated the undici finding as WebSocket-only. Both files carry an `errata` block that takes precedence over the original text; the candidate remains blocked.
- SPDX SBOMs are **unavailable** for this candidate (syft not present; images not built) and are intentionally not reused from the previous candidate.

## Historical reports

- [Release candidate — 2026-07-14](rc-2026-07-14.md) — superseded by the candidate above; retained as historical evidence. Its [manifest](rc-2026-07-14.json) and SBOMs ([web](rc-2026-07-14-web.spdx.json), [admin](rc-2026-07-14-admin.spdx.json)) reflect the earlier dirty-tree candidate at commit `e94e14f` and must not be treated as current.
- [Production-readiness and security audit — 2026-07-13](../audits/production-readiness-final.md) — retained for its findings and validation evidence.

When a newer report is added, update this index and mark its predecessor as historical. Historical files that must quote obsolete topology can be granted a narrow rule-specific exception in `scripts/production-topology-allowlist.json`; active runbooks and configuration must never be allowlisted.
