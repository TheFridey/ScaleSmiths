# Forge human edit tracking

Forge tracks meaningful artifact saves and approvals, not keystrokes. The purpose is to understand which generated stages need the most human correction and whether certain providers or models correlate with more factual or quality fixes.

## What is recorded

Artifact metadata can include `humanEditTracking` and append-only `humanEditHistory` entries containing:

- generated version;
- human-edited version;
- final approved version;
- editor;
- timestamp;
- reason for change;
- edit categories;
- approximate edit distance;
- time from generation to approval;
- whether the edit corrected factual or quality problems;
- provider, model, and stage where available.

Categories are:

- factual correction;
- tone;
- design preference;
- layout;
- conversion;
- SEO;
- compliance;
- client request;
- technical issue;
- generic output;
- missing content.

The edit distance is a deterministic text-level approximation between the generated artifact content and the approved saved content. It is not intended to be a legal diff or authorship detector.

## Reporting

`GET /api/forge/human-edits` returns aggregate correction reporting by stage, provider, and model. `GET /api/forge/human-edits?projectId=:id` scopes the same report to one project.

Reports intentionally omit raw artifact content so client data stays isolated. Artifact-level details remain available only inside that project artifact history.

## Privacy boundary

The system does not record keystrokes, cursor movement, draft typing, or editor dwell events. It records only meaningful save/approval moments that already change Forge artifact state.
