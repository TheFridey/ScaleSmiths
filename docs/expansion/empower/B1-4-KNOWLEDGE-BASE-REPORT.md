# Operation Empower B1.4: Knowledge Base report

Recorded 2026-11-20. Agent work only; no human review. "Implemented", "tested", "approved", "enabled" and "published" are reported separately.

## Scope delivered

| Capability | Implemented | Tested | Approved | Enabled | Published |
|---|---|---|---|---|---|
| Approved knowledge entries (governed content, required fields) | Yes (B1.1 model) | Unit, PostgreSQL, browser | No | No | No |
| Deterministic search with exact alias or question match first, synonyms, topic filter | Yes | PostgreSQL, browser | n/a | No | n/a |
| Partner Knowledge Base page (search-first, client line and copy, limitation, escalation, sources, related resources) | Yes | Browser, axe, 5 widths | No | No | No |
| "Request help" through the existing meeting request; no-answer state | Yes | Browser and SQL check | n/a | No | n/a |
| 32 planned entries imported as drafts | Yes | Parser, imports | `AP-KB-02` and each entry open | n/a | No |

No migration: B1.4 reuses the B1.1 content model and the B1.3 search document and synonyms. New switch `PARTNER_KNOWLEDGE_BASE_ENABLED` (default `false`). The partner identity boundary now also admits exactly `/partner/knowledge`.

## A correction to the planning package

The package summary and the content review register said 33 knowledge entries. `KNOWLEDGE-BASE.md` contains 32, and the per-topic counts in the register also total 32. The register is corrected, and the importer now requires exactly 32.

## Verification

| Check | Result |
|---|---|
| Admin lint, full unit suite | Clean; 167 files, 1,271 passed, 4 skipped (pre-existing) before the review fixes; parser suite 11 passed after them |
| Empower PostgreSQL suites (content, Academy, Resource Centre, Knowledge Base) | 28 passed as the restricted admin role |
| Knowledge Base integration (4) | Switch and identity refusals; alias and question matches rank first and repeat identically; full entry shape; partner-only entry without a client line; topic allow-list; drafts and withdrawn entries excluded; related published resources |
| Parser | All 32 entries parse, resolve their client explanations (objection lines, pricing boundary, "as answer") and pass submission, including the client-facing audience check, with no override |
| Browser (production build, disposable database) | All three journeys pass: B1.1/B1.2, B1.3 and the new B1.4. Founder drafts an entry with an alias [UI]; second founder approves and publishes [UI]; partner opens the Knowledge Base from the workspace with the search box focused [UI], searches the way a client asked and gets the entry first with its client line and copy control [UI]; requests help [UI] and a normal meeting request exists, not confirmed [SQL check]; an unanswered question offers help [UI]; withdrawal removes the entry [UI]. axe clean of serious issues; no overflow at 320 to 1440 px; screenshots in `evidence/b1-4/` |
| Independent model review | No critical or high findings. Fixed: an entry naming two escalation routes is now refused instead of silently keeping the first (KB-SEC-01 reworded, `AP-KB-02`); entries with no client explanation are partner-only whatever their topic; a stray empty file removed. Accepted: exact matching ignores only trailing punctuation |

## Limitations

- Exact alias matching normalises case and trailing punctuation, not inner spacing.
- Searches are not logged, so founders cannot yet see unanswered questions (`AP-PRIV-02`).
- The objection-handling workspace (B1.5) is not built; the objection playbook is available as resource R08.

## Outstanding approvals

`AP-KB-01` (switch on), `AP-KB-02` (KB-SEC-01 wording), `AP-PRIV-01` and `AP-PRIV-02`, and approval of each entry through the studio.
