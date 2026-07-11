# Forge prompt and schema registry

The source-controlled registry is `admin/src/lib/forge-prompt-registry.ts`. It owns stable prompt and schema identifiers, active versions, retained historical versions, compatibility notes, change descriptions, deprecation state, and compact test fixtures.

Provider execution requires an exact registry reference at compile time. Agents obtain it with `getForgeAgentRegistryReference`; the provider abstraction stores it with structured task output. Migration `0020_prompt_schema_registry.sql` adds prompt/schema identifiers and versions to tasks and artifacts, backfills known metadata, and keeps future rows synchronized. Unidentifiable historical records are honestly marked `forge.legacy` / `legacy`.

Versions are immutable. To change behavior, add a new version entry, retain the previous object, update `activeVersion`, describe compatibility and change details, and add/update its fixture. Deprecation marks a historical version unavailable for new selection but does not delete it.

The registry test contains the required historical identifier/version inventory. Deleting or renaming a historical reference, changing active versions without updating the reviewed inventory, or omitting fixtures causes the test suite to fail. Prompt renderer and JSON-schema implementations remain ordinary source modules referenced by registered agents; no external prompt service or runtime credential is involved.
