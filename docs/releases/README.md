# Release evidence

This directory indexes immutable or reproducible release evidence. It does not authorise deployment.

## Current report

- [Release candidate — 2026-07-14](rc-2026-07-14.md) — latest production-readiness decision and manual approval checklist.
- [Machine-readable candidate manifest](rc-2026-07-14.json).
- [Web SPDX SBOM](rc-2026-07-14-web.spdx.json) and [admin SPDX SBOM](rc-2026-07-14-admin.spdx.json).

## Historical reports

- [Production-readiness and security audit — 2026-07-13](../audits/production-readiness-final.md) — superseded by the release candidate above and retained for its findings and validation evidence.

When a newer report is added, update this index and mark its predecessor as historical. Historical files that must quote obsolete topology can be granted a narrow rule-specific exception in `scripts/production-topology-allowlist.json`; active runbooks and configuration must never be allowlisted.
