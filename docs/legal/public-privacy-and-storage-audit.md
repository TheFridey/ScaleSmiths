# Public privacy, consent, and storage audit

Date: 2026-07-18  
Public notice version: 1.0

> **Internal publication gate:** the public privacy notice and website terms are implementation-ready UK-focused drafts. They **require professional legal review before final publication**. Confirm ScaleSmiths' complete legal identity and service address, controller/processor contracts, actual production provider regions, international-transfer mechanisms, retention ownership, and insurance/contract alignment. Do not represent this repository review as formal legal approval.

## Audited implementation

| Flow | Actual repository behaviour | Data and recipients | Retention/deletion position |
| --- | --- | --- | --- |
| Normal quote | `web/src/app/quote/page.tsx` posts to `/api/quote`; server validation requires `consent === true` | Qualification fields and brief are stored in PostgreSQL; Resend receives internal and acknowledgement email content | No automated quote deletion exists. Closed enquiries need an owned review/deletion schedule. |
| Interactive V2 quote | `V2ConversionLayer` posts the selected journey context to the same route | Name, email, optional phone, business context, goals, budget/timeline and generated journey summary | Consent was formerly hardcoded. It is now an explicit required checkbox and persists through the common validated insert mapping. |
| Marketing | No marketing field, list subscription, or marketing send exists in either form | No marketing permission is inferred from the enquiry consent | Any future marketing requires a separate specific choice and unsubscribe process. |
| Portal accounts | Email plus bcrypt password hash; signed HTTP-only session cookie contains client ID | PostgreSQL, authorised ScaleSmiths staff, and client-visible portal routes | Session expires after eight hours. Account, request, message, timeline, and report deletion is not automated. Contract/offboarding retention needs ownership. |
| Experience analytics | First-party endpoint stores allowlisted journey events; client and server honour GPC/DNT and `ss_analytics_opt_out` | Random session ID, path, coarse device, preference, journey fields, referrer host, campaign labels, safe metadata; no form bodies or raw IP in the analytics row | Internal dashboard queries 30 days, but event-level pruning is not automated. This must be resolved or explicitly approved during legal/operational review. |
| Rate limits | IP and identifier values are SHA-256-derived before database storage | Hashed keys, counter, reset and update timestamps | Enforcement windows are ten minutes. Expired-row housekeeping is not automated. |
| Resend | Quote and portal-notification emails are server-side and fail open after record persistence | Relevant recipient address and email body | Provider retention and region must be verified against the production account and DPA. |
| Monitoring | Sentry adapter is server-side and optional; double redaction/allowlists remove form bodies, cookies and secrets | Safe error details, release/environment, request ID and approved operational IDs | Production Sentry retention must be explicitly configured and recorded. |
| PostgreSQL/backups | Application records use separate least-privilege runtime roles; backup framework encrypts recovery bundles | Hosted database and operator-controlled encrypted backup destination | Backup retention is separately documented. Record deletion does not instantly remove data from already-created recovery points. |
| Hosting/Cloudflare | Docker/VPS with host Nginx; Cloudflare may proxy and protect public/admin origins | Network metadata such as IP, request headers and security events | Confirm actual Cloudflare plan/log settings and host log retention before publication. |
| Client analytics | Admin ingests daily aggregate metrics only after per-client consent/configuration | Provider attribution, aggregate metrics, encrypted connection credentials | Configurable 30–730 days, default 395. The schema stores the policy but scheduled pruning is not implemented. |

## Browser storage inventory

| Key | Mechanism | Purpose | Lifetime | Classification/control |
| --- | --- | --- | --- | --- |
| `ss-client-session` | Secure production HTTP-only cookie | Authenticate an explicitly requested portal session | 8 hours | Strictly necessary. |
| `ss_experience_preference` | Cookie | Keep server rendering consistent with explicit normal/interactive choice | Up to 1 year | Appearance/function preference; reset control and privacy-page clear action. |
| `scalesmiths.experience` | localStorage | Remember explicit experience choice in the client | Until reset/clear | Appearance/function preference; reset control and privacy-page clear action. |
| `scalesmiths.v2.industry` | localStorage | Remember chosen interactive industry | Until clear | Appearance/function preference; privacy-page clear action. |
| `scalesmiths.analytics.session` | sessionStorage | Anonymous event grouping | Browser tab/session | Statistical purpose; GPC/DNT and visible opt-out suppress it. |
| `scalesmiths.analytics.sent` | sessionStorage | Duplicate-event prevention | Browser tab/session | Statistical purpose; GPC/DNT and visible opt-out suppress it. |
| `ss_exp_id`, `ss_exp_variant` | Cookies | Stable controlled A/B assignment | Up to 90 days | Statistical purpose; only set while enabled, and suppressed/cleared on objection. |
| `ss_analytics_opt_out` | Cookie | Remember objection | Up to 1 year | Preference record necessary to honour the objection. |
| `scalesmiths.e2e.disableCanvas` | localStorage | Test-only deterministic canvas switch | Test harness only | Must not be deliberately set for ordinary production visitors. |

No third-party advertising cookie, social tracker, or cross-site analytics beacon was found. A generic banner was not added. The implementation instead uses the statistical and appearance exceptions described in current ICO storage guidance, with clear public information and a free objection control. Professional review must confirm that the actual production use and retention stay inside those narrow exceptions; otherwise consent must be obtained before optional storage runs.

## Draft lawful-basis map

- Enquiry response: requested pre-contract steps and legitimate interests; checkbox records specific permission for storage/contact, not marketing.
- Contracted portal and delivery records: contract and legitimate interests.
- Security, abuse prevention, troubleshooting, and legal records: legitimate interests and legal obligations where applicable.
- Privacy-minimised service analytics: legitimate interests plus the narrow PECR statistical-purpose storage exception, subject to clear information, objection, aggregation, and deletion controls.
- Optional future marketing: not currently implemented; would need a separate assessment and permission route.

## Required professional and operational decisions

1. Confirm full legal/trading identity and an appropriate service address.
2. Approve or amend the lawful bases and mandatory enquiry checkbox wording.
3. Verify Resend, Sentry, Cloudflare, host, backup, and any client-analytics processor contracts and data locations.
4. Record applicable UK adequacy routes, IDTA/Addendum safeguards, and data protection tests.
5. Implement and evidence event, rate-limit, enquiry, portal, analytics, log, monitoring, and backup retention/deletion schedules.
6. Confirm the statistical/appearance exceptions remain applicable under the live configuration; introduce prior consent if the purposes expand into profiling, advertising, or non-exempt storage.
7. Confirm client contracts allocate controller/processor responsibilities for client-site analytics and portal content.

## Primary guidance reviewed

- [ICO: storage and access technology exceptions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/)
- [ICO: privacy information requirements](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)
- [ICO: international transfers](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/international-transfers/a-brief-guide-to-international-transfers/)
- [ICO: data protection complaints](https://ico.org.uk/for-the-public/how-to-make-a-data-protection-complaint)
