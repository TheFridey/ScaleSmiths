# Operation Empower B1.3: Resource Centre report

Recorded 2026-11-20. Agent work only; no human review. "Implemented", "tested", "approved", "enabled" and "published" are reported separately.

## Scope delivered

| Capability | Implemented | Tested | Approved | Enabled | Published |
|---|---|---|---|---|---|
| Resources as governed content (category, summary, related items) | Yes | Unit, PostgreSQL, browser | No | No | No |
| Deterministic PostgreSQL full-text search with ranking and filters | Yes | PostgreSQL, browser | n/a | No | n/a |
| Founder-managed synonyms | Yes | PostgreSQL, browser | `AP-RES-02` open | No | n/a |
| Partner Resource Centre (list, search, view, copy, download) | Yes | Browser, axe, 5 widths | No | No | No |
| Related lessons and resources, both directions | Yes | PostgreSQL | No | No | No |
| Frozen B0 library shown read-only (`AP-ENG-01`) | Yes | PostgreSQL | Approved (`AP-ENG-01`) | No | n/a |
| 13 resource drafts imported as drafts | Yes | Parser, two imports | `AP-PUB-02`, `AP-RES-03` open | n/a | No |

Not in B1.3: knowledge-base entries and their search page (B1.4), the objection workspace (B1.5), zero-result search logging (`AP-PRIV-02`), typo tolerance, PDF export.

## Design

See [ARCHITECTURE.md](ARCHITECTURE.md) section 7c and [SECURITY-MODEL.md](SECURITY-MODEL.md) section 3.4c. Migration `0094_empower_resource_search` adds `empower_search_document(title, body, fields)` with a GIN index on published rows, and `empower_search_synonyms`. No existing table changes. Switch: `PARTNER_RESOURCE_CENTRE_ENABLED` (default `false`), independent of the Academy and the founder studio. The partner identity boundary admits exactly `/partner/resources` and `/partner/resources/<slug>`.

## Verification

| Check | Result |
|---|---|
| Admin typecheck, lint, full unit suite | Clean; 167 files, 1,268 passed, 4 skipped (pre-existing) |
| Empower PostgreSQL suites (content, Academy, Resource Centre) | 24 passed as the restricted admin role; sole-founder 2 passed |
| Independent model review | No critical or high findings. Fixed: two stray empty files removed before commit; strict UUID check for legacy slugs; only the newest version of each legacy title listed; founder synonym expansions can no longer add exclusions or operators. Not changed: course audience (already forced partner-only by 0092) |
| Resource Centre integration (7) | Switch and identity refusals; published-only listing; category and audience filters; hostile query syntax; deterministic ranking; synonym add, use, switch-off, rewrite and delete refused, audited; related lessons only when the Academy is on; download text; withdrawal; legacy partner rows only; web role refused |
| Migration gates | Pass (0091–0094); privilege verification passes |
| Browser (production build, disposable database) | B1.1/B1.2 journey and the new Resource Centre journey both pass; axe clean of serious issues; no overflow at 320, 390, 768, 1024, 1440 px; screenshots in `evidence/b1-3/` |
| Parser | All 13 resources parse with their audience and pass submission, including the client-facing audience check, with no override |

Browser steps: founder drafts a client-facing guide [UI]; second founder approves and publishes [UI]; second founder adds a synonym [UI]; partner-only reference published [API set-up]; partner opens the Resource Centre from the workspace [UI], finds the guide through the synonym [UI], reads it with Markdown rendered [UI], sees the copy control [UI] and downloads the approved text [UI]; partner-only resource has no copy control [UI]; founder withdraws the guide [UI] and partners can no longer find or open it [UI].

A real defect the parser tests caught: R08's audience text ("Partner only, with client-facing lines marked") was read as client-facing. The audience lint then refused the commission wording; the parser now classifies by the start of the cell.

## Limitations

- Exact alias ranking, zero-result logging and per-partner search rate limits are not built.
- No load test of the search target (p95 under 200 ms at 1,000 entries).
- No `/` keyboard shortcut to focus search.
- Copy for a client copies the whole approved body; resources meant for copying should be written entirely as client text.

## Outstanding approvals

`AP-RES-01` (switch on), `AP-RES-02` (synonyms), `AP-RES-03` (R13 audience), `AP-PUB-02` (publication order), and approval of each resource through the studio. B1.4 has not started.
