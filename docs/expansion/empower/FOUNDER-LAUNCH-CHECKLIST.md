# Founder launch checklist (Operation EMPOWER B2.10)

One list. Items 1–4 block onboarding a real partner; the rest can follow. Every item names the exact action.

## Launch blockers

| # | What is required | Why | Recommended decision | Exact action | Blocks onboarding? | Can it wait? |
|---|---|---|---|---|---|---|
| 1 | **The final partner agreement text** | An invitation cannot be issued without a published, current agreement version (`assertIssuableAgreement`). Production has 0 acceptances and no published agreement (B2.9 certification). No "V4.1" document exists in the repository; the AEGIS review also found none. | Supply the solicitor-reviewed final V4.1 document. Do not paste it by hand; do not publish a draft. | Follow [AGREEMENT-PUBLICATION-WORKFLOW.md](AGREEMENT-PUBLICATION-WORKFLOW.md): fingerprint the file, import it byte for byte as a draft, submit, **the other founder approves** with the legal reference, publish, and confirm the published fingerprint equals the file's. | **Yes** | No |
| 2 | Resend credentials present on the VPS | Application, invitation and activation emails | Use the existing `hello@scalesmiths.co.uk` sender | Confirm `RESEND_API_KEY` and `RESEND_FROM` exist in the canonical `.env` (presence only), set `PARTNER_EMAIL_ENABLED=true`, then run one controlled test application to a founder-owned address | No (links can be shared by hand) but strongly recommended | Briefly |
| 3 | Approve the B2.10 release and the activation switches | Deploying changes production | Approve rows 2–7 of the [activation matrix](PRODUCTION-FEATURE-MATRIX.md) | Follow [PARTNER-ACTIVATION-RUNBOOK.md](PARTNER-ACTIVATION-RUNBOOK.md) | **Yes** | No |
| 4 | Confirm `GB` is the approved market | Invitation and contract gates | Keep UK-first | Founder workspace → Commission centre → Markets: confirm GB is `approved` with all four reviews | **Yes** | No |

## Content to approve (one review session)

All drafts are in the Content Studio once imported (runbook step 5). They arrive as **drafts**; nothing is approved for you. Use **Founder workspace → Content → Review queue**: the author founder ticks items under *Drafts to submit*; the other founder reads each item, enters one review reference and approves under *Awaiting your approval*; then publishes under *Approved, ready to publish* (lessons go before courses automatically). Every content item was checked for accuracy against the published prices and programme terms; see [CONTENT-PUBLICATION-REGISTER.md](CONTENT-PUBLICATION-REGISTER.md).

| # | What | Recommended | Blocks onboarding? |
|---|---|---|---|
| 5 | Academy courses C01–C06, C08–C10, C13 (C07, C11, C12 stay blocked) | Approve C01 *Welcome to ScaleSmiths* first: it is the recommended first course | No (learning is optional) |
| 6 | Resources R01, R03–R07, R09, R10, R13 | Approve; R11 pricing after checking the published prices | No |
| 7 | Knowledge base: the 14 new partner-programme entries (KB-PROG-01–12, 14) plus confirmed-published service entries | Approve the `CONFIRMED` ones; leave `BLOCKED` ones unpublished | No |
| 8 | Objection responses (12) | Approve | No |

## Commercial decisions (do not block onboarding; content stays unpublished until made)

| # | Decision | Why | Recommended |
|---|---|---|---|
| 9 | Withdrawal frequency, minimum, invoicing and VAT (KB-COMM-02) | Commission guide R12 and course C11 depend on it | Decide with your accountant before the first commission becomes payable |
| 10 | Refund and cancellation treatment of commission (KB-COMM-03, KB-PROG-13) | As above | Same |
| 11 | Prospect protection period (KB-PROG-04) | Belongs in the agreement | Settle in item 1 |
| 12 | Marketing process for partners (C07) | Privacy adviser decision | Keep "unsolicited outreach" on hold |
| 13 | Referral and achievement reward terms | Shown as planned and conditional today | No change needed to launch |

## Optional enhancements (safe to wait)

- Industry website demonstrations (none exist today; partners can request one through Meetings & support).
- Partner pack of approved logos, brand guidelines and case studies.
- Generated digital business card page; CircleCard integration.

Done in B2.10 and no longer open: partner self-service password recovery and applicant self-withdrawal (both need `PARTNER_EMAIL_ENABLED` and Resend credentials to deliver their links).
