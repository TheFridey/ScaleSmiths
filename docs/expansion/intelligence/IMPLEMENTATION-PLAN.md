# Implementation plan and status

| Checkpoint | Scope | Status |
|---|---|---|
| B0.1 | Header/footer/Partner Login, Scale Your Future page, calculator, disclosures | **Delivered** (see FINAL-REPORT.md) |
| B0.2 | Versioned twelve-month terms, flexible schedules, retainer-only, bespoke, discounts, existing-customer sales | **Delivered in checkpoint 2 (2A, 2B)**: persisted, integrated into contract acceptance, migrations 0073/0074. Founder UI written but not browser-verified. Market and exclusivity acceptance gates depend on 2E |
| B0.3 | Withdrawals, market and exclusivity gates | **Delivered in checkpoint 3 (3B, 3E gates)** |
| B0.3 (checkpoint 4) | Achievements, referrals, toolkit, meetings, legacy-path and structured gates, integrity closure | **Delivered** (4A, 4B, 4C partial, 4D) |
| B0.3 remainder | Researched prospect allocation, Founding Partner recognition, personal profiles, applicant/activation/allocation market gating | **Not started** |
| B1 | Knowledge, resources, Academy | Not started |
| B2 | Website Intelligence | Not started (security design required first) |
| B3 | Sales Studio | Not started |
| B4 | Meeting prep, proposals, agreements, handover | Not started |
| B5 | Ask ScaleSmiths | Not started (live AI stays disabled) |
| B6 | Support and operations | Not started |

Recommended next step: wire `standard-v2` terms into scope approval and contract acceptance behind a founder-approved plan-version setting, with a migration and PostgreSQL concurrency test, before any B0.3 reward feature.
