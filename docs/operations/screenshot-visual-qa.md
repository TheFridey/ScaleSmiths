# Screenshot-based Forge visual QA

The existing Visual QA action now starts the site through Forge's approved preview runner. In production, configure the hardened Docker sandbox; the same preview security controls, secret-free environment, resource limits, and network policy apply. Screenshots are stored outside generated workspaces under `FORGE_VISUAL_EVIDENCE_ROOT` (default `generated-sites/.forge-evidence`) and are never served by the public application.

For up to twelve generated routes, Forge captures full-page desktop (1440x900), tablet (820x1180), and mobile (390x844) images with reduced motion and animations disabled. Each record preserves route, viewport, section, timestamp, relative private path, SHA-256 hash, task, project, evaluator version, and the versioned Visual QA artifact provenance.

Deterministic browser checks cover horizontal overflow, clipping, contrast, small typography, weak CTAs, header/navigation and footer landmarks, animation-hidden content, responsive width, and layout shift. Structured findings and proposed repair tasks are advisory, require explicit approval, are non-blocking, and set `deployAutomatically` to false. Approved client facts are not rewritten.

Run Visual QA again after an approved repair to create a new version. `compareVisualRuns` provides the deterministic before/after outcome while both screenshot sets and hashes remain retained. Vision-provider evaluation is optional: integrations must send only screenshots and approved design context, never source code, credentials, prompts containing secrets, or unapproved client data. Provider findings must retain the same advisory and approval-required flags.
