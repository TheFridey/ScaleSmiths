# B2.11 founder action register

These are the outstanding founder decisions and approvals. Nothing here can be recorded by an agent: each needs a founder's own identity, approval, or explicit go-ahead. They are listed in the order that unblocks onboarding.

| # | Action | Why | Blocks onboarding? | Where | Exact action | Recommendation | Unlocks |
|---|---|---|---|---|---|---|---|
| 1 | Approve the **GB market** | Activation requires an approved market. The DB check needs `legal_reviewed`, `accounting_reviewed`, `privacy_reviewed`, `operations_reviewed`, an `approval_reference`, `approved_by` (a founder) and ≥1 plan key. Production has 0 market rows. | **Yes** | Founder admin → Commission Centre → Markets | Create `GB / United Kingdom`. Tick the four reviews that have genuinely happened. Enter your review reference. Select the standard plan, then approve. | Approve GB only. Keep every other country (including ZA) `under_review` until it has its own legal and tax review. | Item 4 (enabling `PARTNER_ACTIVATION_ENABLED`) |
| 2 | Approve the **withdrawal policy** | Production has 0 policy rows, so no partner can withdraw. The row needs `approval_reference` and `approved_by`. | No (commission accrues without it) | Commission Centre → Withdrawal policies | Create the policy: enabled, minimum £50 (if V4.1 says so), invoice requirement as the contract states, approval reference. | Match the V4.1 wording exactly. State only the payment method you actually operate (manual bank transfer). | Withdrawal requests |
| 3 | Authorise the **curriculum import** and name the **author founder** | The importer writes drafts only, and only into a real database with `--allow-database=<db>`, which records your permission. The named founder becomes the author of every imported draft and therefore cannot approve them; the other founder reviews. | Not for activation; yes for the Academy, resources and knowledge modules | VPS: `admin/scripts/import-empower-curriculum.mjs` (dry run first) | Reply with: (a) permission to import into production, and (b) which founder authors. A dry run is shown before anything is committed. | Author: the founder who did *not* write the content. Reviewer: the other founder, in one Content Studio session. | Publishing, then switches 8–12 |
| 4 | Approve **deploying B2.11** and the **switch changes** | Production still serves a hand-edited compiled stylesheet, and the canonical checkout is on 8cf5c71 with an uncommitted edit. Deploying replaces both with committed source. | Yes (scroll fix and activation) | VPS (agent runs the runbook) | Say "deploy B2.11", and which switches to turn on now. | Deploy. Turn on `PARTNER_PIPELINE_ENABLED`, `PARTNER_QUALIFICATION_ENABLED`, `PARTNER_PERFORMANCE_ENABLED` and `DELIVERY_HANDOFF_ENABLED` (none needs content). Turn on `PARTNER_ACTIVATION_ENABLED` only after item 1. | Permanent scroll fix live; the pipeline, performance and handoffs modules |
| 5 | Allow **clean-up** on the VPS | `releases/b210-scroll-hotfix` (1.1 GB, unused) and two empty stray files in the canonical checkout. The canonical checkout should be reset to `master` with the hotfix edit discarded, because its replacement is committed. | No | VPS | Say "clean up". | Delete after the B2.11 deploy is verified, so the rollback pair stays intact. | ~1.1 GB disk |

**Status 25 Nov 2026:** item 4 is **done**. B2.11 was deployed with the four content-free switches on; see the deployment record in [B2-11-LAUNCHPAD-FINAL-REPORT.md](B2-11-LAUNCHPAD-FINAL-REPORT.md) section 7. Item 5 (clean-up) can now go ahead. Items 1–3 remain open.

**Status 25 Nov 2026 (later):** item 3 is **done (import only)**. With founder authorisation, `import-empower-curriculum.mjs` imported 175 drafts into `scalesmiths`, authored by the administrator trev@scalesmiths.co.uk:

| Content | Count |
|---|---|
| Courses | 13 |
| Lessons | 91 |
| Resources | 13 |
| Knowledge Base entries | 46 |
| Objection responses | 12 |

- **Backup:** `/var/backups/scalesmiths/pre-curriculum-import-20261125T145425Z-cf6fecfb`, checksums verified.
- **Dry run before the import:** 175 to create, 0 problems.
- **Database check after the import:**
  - all 175 versions are `draft`, with 0 approval rows;
  - items, versions and `empower_imported` audit rows are all attributed to the author (175 each);
  - the published agreement is unchanged.
- **Re-run dry run:** 175 unchanged.

**Next step:** the author submits in Content → Review queue, and the *other* founder approves and publishes. The importer flagged four objection responses for founder decisions:

| Response | Decision needed |
|---|---|
| AP-OBJ-01 | Refers to a proposed policy that is not yet approved. |
| AP-OBJ-05 | The escalation route was left blank for a founder to decide. |
| AP-OBJ-08 | Has no discovery question; add one or confirm none is needed. |
| AP-OBJ-10 | Has no discovery question, and is BLOCKED on AP-GOV-05. Do not submit it. |

C07, C11, C12 and R12 stay unpublished until their dependencies are resolved. The Academy, Resource Centre, Knowledge Base and Objection-handling switches stay off until content is published.
