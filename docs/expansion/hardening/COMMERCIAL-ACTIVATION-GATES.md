# Commercial activation gates

| Mode | Runtime settings and approvals |
| --- | --- |
| Local demonstration | Use a disposable local database and synthetic records. Explicitly opt in to local intake or activation as necessary for a test. Keep integrations and real transfer activity off. |
| Deployed but closed | Separately approve deployment and informational page publication. Set `PARTNER_APPLICATIONS_ENABLED=false`, `PARTNER_ACTIVATION_ENABLED=false` and `PARTNER_RETENTION_EXECUTION_ENABLED=false`. |
| Recruitment open | Approve the public notice, period, data handling and review owner. Set the valid privacy version and retention days, then explicitly enable intake. Keep activation closed. |
| Controlled commercial pilot | Resolve partner terms, privacy, accounting, lead protection, resources, marketing and delivery gates. Approve the exact pilot scope before enabling invitation issuance and activation. Record the individual founder confirmations and agreement version for each partner. |

Invitation issuance and token consumption both require the admin activation switch. Existing authenticated partners are managed through individual revocation. Turning the new-activation switch off does not revoke those accounts. Keep a dated release decision reference for the mode transition. The existing onboarding confirmations record agreement, legal review, independent status and operational review independently, with a founder and timestamp for each saved review. Record the source agreement, commercial decisions, account setup checks and individual acceptance evidence in the controlled onboarding record. Configuration and founder confirmation fields cannot verify an adviser's decision by themselves.

## Founder decisions

Rhys and Trev can record the decision, date, owner, approved option and source reference against each row. The listed owners are proposed for review.

| Decision | Owner or adviser | Options and risk to resolve | Blocks |
| --- | --- | --- | --- |
| Independent status and agreement | Founders, employment solicitor | Assess the working arrangement. Agree obligations, boundaries, acceptance evidence and versioning. Incorrect classification or an unrecorded agreement creates exposure. | Activation |
| Commission entitlement | Trev, solicitor and accountant | Approve collection basis, eligible milestones and exceptions. Use explicit prospective versions for bespoke terms. Ambiguity leads to disputes. | Activation, finance |
| Lead protection and attribution disputes | Trev and Rhys | Set start, expiry, reassignment, canonical customer priority, evidence and dispute owner. An indefinite claim can stall opportunities. | Activation |
| Refund eligibility and previously paid adjustments | Trev, solicitor and accountant | Require agreement-backed review. Determine when a refund changes entitlement and whether already-paid commission can be netted, disputed or pursued. Preserve history. | Finance |
| Clawback, settlement and external recovery | Trev and solicitor | Default to no automated recovery. Decide any exceptional manual process, evidence and approval authority. | Finance |
| Partner invoices and VAT | Accountant and Trev | Define invoice checks, tax treatment, VAT-inclusive payment and evidence handling for registered and unregistered partners. Require separate approval for any self-billing. | Finance |
| Payout frequency and authority | Trev and accountant | Choose a manual cycle, invoice cut-off, reconciliation evidence and standing approval ownership. Incomplete checks create double-payment risk. | Finance |
| Applicant notice, lawful basis and retention | Rhys and privacy adviser | Approve fields, versions, category durations, holds, rights contact and erasure after restore. A missing decision delays intake. | Recruitment, activation |
| Marketing process | Trev and privacy adviser | Approve permitted channels, acquisition source, screening evidence, opt-out handling and training. Keep unsolicited outreach on hold until the process is approved. | Activation |
| Approved resources | Trev and Rhys | Review claims, partner-only and client-facing classifications, expiry and publication owner. | Activation |
| Initial capacity and partner limit | Trev and delivery owner | Set an assessed delivery allocation and explicit cohort cap. Review before commitments and expansion. | Activation |
| Operational ownership | Both founders | Name recruitment, privacy, finance, monitoring, delivery, incident and recovery owners and deputies. | Recruitment, activation, finance |
| Deployment approval | Named release approver | Approve exact reviewed SHA, check results, backup and rollout windows. | Deployment |
| Public recruitment launch | Both founders | Decide between closed informational publication and controlled intake after review staffing and privacy sign-off. | Recruitment |

## Marketing and suppression

Canonical duplicate and suppression checks are registration controls. Treat each prospect as **not assessed for outreach** until an authorised person checks the evidence for the proposed channel. Record provenance, date, operator, subscriber type and objection outcome in the approved private process. For live UK B2B marketing calls, the ICO directs organisations to check TPS, CTPS and their own do-not-call lists, subject to applicable permissions and exceptions. Electronic marketing rules vary by subscriber type and channel. Make objections and opt-outs available to partners without exposing unrelated prospect data. [ICO business-to-business marketing guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/)

No live TPS/CTPS integration or completed screening is established by this change. Determine the approved screening account and access process, the source of objection updates and a named person responsible for prompt suppression. Use an approved correction process when a partner disputes a duplicate or suppression.
