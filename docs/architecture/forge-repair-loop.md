# Forge controlled repair-loop engine

Forge repair loops share one deterministic policy implementation in `admin/src/lib/forge-repair-loop.ts`. The engine supports TypeScript, ESLint, build, accessibility, visual-layout, performance, broken-link, metadata, schema, content-contradiction, responsive, and dependency-policy repairs.

Each loop records its original failure identifiers, declared file scope, maximum attempts, cost and runtime, minimum confidence, escalation rule, and mandatory human-review state. Every attempt contains its failure classification, before/after evidence, snapshot hash, changed files, validation output, confidence, cost, duration, and status.

## Terminal rules

A loop stops when it succeeds, reaches an attempt/cost/runtime limit, falls below its confidence threshold, changes an unrelated file, repeats an earlier snapshot, recreates an earlier failure, or exhausts validation. Success is possible only when validation no longer reports any of the original failure identifiers.

Circular snapshots and recreated failures are distinct: a circular repair repeats an earlier after-state hash, while a recreated failure causes a previously observed before-failure set to return after a later change.

## Persistence and approval

Integrations store the complete loop state in task output and validation metadata, emit activity records for every repair and stop decision, and save a versioned `qa_report` artifact with provenance. Successful repair output remains `requires_review`, unapproved, downstream-disabled, and publication-blocked until an authorised human approves it.

The generated-site implementation agent is the first consumer. Other Forge evaluators can reuse the pure state engine while supplying category-specific evidence and validation functions; they must not invent success or bypass their existing workflow preconditions.
