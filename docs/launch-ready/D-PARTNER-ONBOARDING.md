# Operation Launch Ready: partner onboarding report

## Lifecycle

The existing lifecycle already covered the directive's journey; one state was added (`information_requested`). Transitions are enforced in the database (`partner_application_transition_allowed()` and its trigger, migration 0095) and in the service (`admin/src/lib/partner-lifecycle.ts`, same map, checked by a test that parses the SQL).

| From | Allowed next states |
|---|---|
| submitted (Application received) | under review, declined, withdrawn, archived |
| under review | information requested, conversation arranged, assessment in progress, approved in principle, declined, withdrawn, archived |
| information requested | under review, conversation arranged, assessment in progress, declined, withdrawn, archived |
| conversation arranged / assessment in progress | each other, under review, information requested, approved in principle, declined, withdrawn, archived |
| approved in principle | assessment in progress, agreement pending, declined, withdrawn, archived |
| agreement pending | approved in principle, onboarding, declined, withdrawn, archived |
| onboarding (Ready to invite) | agreement pending, **activated (only by the partner accepting the agreement)**, declined, withdrawn, archived |
| declined, withdrawn | under review, archived |
| activated, archived | terminal |

Extra database rules: `onboarding` needs all four founder confirmations; `activated` needs an activated partner with a recorded agreement acceptance.

Mapping to the directive: application received = `submitted`; additional information required = `information_requested`; conditionally approved = `approved_in_principle`; agreement pending = `agreement_pending`; agreement accepted and account activated = `activated` (one atomic step); founder approval complete = the four confirmations plus a two-founder-approved published agreement; onboarding in progress and active partner = the partner workspace's first-login steps. Suspension is `revoke_partner` (sessions ended, sign-in refused, history kept).

## Permissions

| Actor | Can | Cannot |
|---|---|---|
| Founder (`expansion.manage`) | review, request information, decline, invite with a published agreement, reissue, suspend, read the register, audit and any accepted copy | skip lifecycle steps, invite with an unpublished or free-text agreement, activate anyone, edit a published agreement or an acceptance |
| Invitation holder (token in URL fragment) | read the issued agreement, accept it and set a password, once, within 48 hours | accept a different version, accept withdrawn or out-of-date text, reuse the link |
| Active partner (`expansion.partner`) | read and download their own agreement, accept a reissued version | read or accept another partner's agreement, reach founder pages or APIs |
| Suspended partner, viewer, anonymous | nothing in the partner area | everything above (403, or redirect to sign-in) |

## Agreement workflow

1. A founder drafts an agreement in Content studio (type `agreement`): partner-only, 3-month review cadence, full text, and at least one `legal:` source citing the legal review it relies on.
2. Submit; a second founder approves (or the recorded sole-founder reason applies, as for all B1.1 content); publish. A published version cannot be edited; changes create a new version, and publishing it supersedes the old one.
3. The invitation issues one published version (`expansion_partners.agreement_content_version_id`).
4. The applicant reads the full text (acceptance unlocks at the end), types their legal name, ticks the acceptance, and sets a password. The request carries the version and SHA-256 they were shown. The server refuses if the issued text changed, was withdrawn or passed its review date, and consumes nothing.
5. The database writes the acceptance: version, title, SHA-256 of the exact text and the time all come from the database, never from the request. It is append-only and bound to the partner and identity it was issued to. Activation in the same transaction is refused unless that acceptance exists.
6. Reissue: a founder issues a newer published version to an active partner, who keeps access and accepts it on `/partner/agreement`. Earlier acceptances stay on record.
7. Copies: the partner and founders download a plain-text copy whose digest is recomputed and must match before it is served.

### Electronic signature assessment

The system records a click-to-accept with a typed name, an email-possession proof (the single-use invitation), a server timestamp and a content digest. This is a simple electronic signature with a tamper-evident record. It is **not** a qualified electronic signature, and the product says so wherever acceptance happens. Whether this is sufficient for the ScaleSmiths partner agreement is a legal decision: **AP-LR-01** asks a solicitor to confirm it, or to require an external e-signature provider (identity verification and a completion certificate). No legal sufficiency is claimed here.

### Commercial terms

No commission calculation, eligibility, timing, refund, chargeback, tax, territory, exclusivity, termination or governing-law rule was added or changed. The agreement text is founder content, so none of those terms is invented in code. The advertised 30% figure stays as it was on the public site. **AP-LR-02**: founders confirm the authoritative commercial specification before an agreement containing commercial terms is published.

## Founder approval gates (enforced server-side)

| Gate | Where enforced | Test |
|---|---|---|
| No activation without the issued, current agreement accepted by that partner | DB trigger on `expansion_partners` and on acceptances; service | PGlite and real PostgreSQL |
| No agreement publication without approval | B1.1 lifecycle (two founders or recorded sole-founder reason) | B1.1 suites; onboarding suite publishes through it |
| No invitation without all four confirmations, an approved market and a published agreement | service and DB (`onboarding` transition) | both |
| No lifecycle skipping, including by direct SQL as the runtime role | DB trigger | real PostgreSQL |
| No cross-partner read or forged acceptance | service scoping plus DB identity check | real PostgreSQL |
| No duplicate acceptance or activation from retries | unique constraint, single-use token under row lock | concurrent tests |
| Fail closed when the agreement is withdrawn or out of date | DB `partner_agreement_current()` at issue, acceptance and activation | both |
| Suspended partner loses access | `revoke_partner`, then `partnerGuard` | real PostgreSQL |

## Audit

- `expansion_audit`: application reviews (actor, from, to, confirmations, applicant message), invitations (agreement version, emailed or not), reissues, revocations. Shown to founders as "Recruitment audit history".
- `admin_security_audit`: invitation issued, partner activated (acceptance id, version, digest), reissued agreement accepted.
- `partner_agreement_acceptances` (append-only) and `partner_notifications` (outcomes move forward only; never deleted).

## Email notifications

Off by default (`PARTNER_EMAIL_ENABLED`). Templates live in `domain/partner-email.ts`: application received, information requested (founder-written applicant message only), declined, invitation, activated, and updated agreement. Founders opt in per decision. Mail is sent after the decision commits and never changes it, and the founder sees the outcome. Each attempt is logged with an idempotency key and a recipient hash. Greetings drop anything that isn't plainly a name, and links are limited to ScaleSmiths HTTPS origins.

## First-login experience

The partner overview opens with "Your next steps": the agreement (done or action needed), then the Academy, Resource Centre and Knowledge Base only if their switches are on, then "Register your first business". Commission figures are not restated; the existing Commission centre stays the source.
