# Forge multi-perspective review council

The council runs through `POST /api/forge/projects/:id/review-council` for users with `forge.execute`. It is a queued Forge QA job and requires at least one approved artifact.

## Canonical input

Every reviewer receives the same immutable snapshot of current approved, non-superseded project artifacts. The snapshot contains artifact IDs, exact versions, quality states and output hashes, plus facts extracted only when they have approved artifact evidence. Its hash is recorded on every reviewer report. Reviewers cannot add facts to this bundle.

## Reviewer contracts

The creative director, conversion strategist, senior frontend engineer, accessibility specialist, SEO strategist, security reviewer, performance engineer, industry business expert and skeptical prospective customer each have an explicit remit, allowed finding categories and relevant score dimensions. Findings outside the assigned category allowlist, without evidence, or without artifact/version references fail validation.

Each finding includes severity, category, evidence, affected artifact IDs and versions, ranked recommendation, score impact, confidence, uncertainty, automatic-fix eligibility, human-decision requirement and high-risk-dissent status. An empty review states that absence of evidence is not proof of absence.

## Synthesis

The synthesis stage groups and deduplicates categories, merges compatible recommendations, identifies differing recommendations or fix modes as direct conflicts, preserves critical dissent, and produces a severity-ranked action plan. Conflicts and any action affecting client facts remain human decisions. Automatic fixes are separated explicitly and never inferred from a human-required finding.

Reviewer and synthesis model versions, prompt/schema registry versions, canonical snapshot hash, task, actor, upstream artifact IDs/hashes and source release are stored in the immutable `council_review` artifact provenance. A later council run creates a new version rather than overwriting history.

The current deterministic implementation provides stable local and CI behaviour. A future provider-backed implementation must validate against the same contracts before synthesis and must not receive secrets, generated source code, or facts outside the canonical approved bundle.
