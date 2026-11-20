# Empower security model (proposed)

**Status: DRAFT.** Extends [../SECURITY-MODEL.md](../SECURITY-MODEL.md) and the B0 hardening work. Nothing here changes authentication.

## 1. Assets

| Asset | Sensitivity | Why |
|---|---|---|
| Partner-only content (commission references, objection playbooks, escalation routes) | Internal | Leakage could be read as a commercial offer or misused by competitors |
| Client-facing content | Low once approved; high while draft | A leaked draft could be presented to a client as approved |
| Approval records | Integrity-critical | They are the evidence that content was approved |
| Partner progress | Personal data | Could be used to monitor or direct partners, which bears on independent status |
| Search logs | Personal data (low) | Reveal what an individual partner is working on |

## 2. Roles and capabilities

No new role or capability is required.

| Actor | Capability | Can | Cannot |
|---|---|---|---|
| Independent partner | `expansion.partner` | Read published, in-review-window content for their audience; search; record own progress; request a meeting from an entry | See drafts, approvals, other partners' progress, founder notes or search logs; write content |
| Founder | `expansion.manage` + `expansion.founder` | Draft, review, approve, publish, supersede, archive; see aggregate progress; preview as partner | Approve their own draft when two founders are active (decision `AP-GOV-04`); delete versions |
| Owner, administrator | per `admin/src/lib/rbac.ts` | Whatever their existing capabilities allow | They never hold `expansion.partner`, so they cannot act as a partner |
| Anonymous | none | Nothing | Reach any Empower route (the admin origin requires sign-in) |

## 3. Controls

### 3.1 Audience separation

- Audience is set on the **item**, cannot change, and is checked in SQL on every read.
- Partner-only items carry a "Partner only: do not share" ribbon and no copy button. Client-facing items carry an approval ribbon with the version and date.
- A lint rule in the content service refuses to move a `client_facing` version to `in_review` if its body contains blocked terms (commission, basis points, payout, withdrawal, referral reward, founder-only, internal) unless a founder explicitly overrides with a reason. This is a safety net, not a guarantee.

### 3.2 Publication integrity

- Immutable versions, enforced by a trigger (same approach as `expansion_resource_lifecycle`).
- Approval is a separate, append-only row recorded by a founder, with a reference and a review-by date.
- Publication fails closed: an expired review date, a missing approval or a disabled flag means the item is not served.
- Every transition writes an audit row with the actor and the version id.

### 3.3 Rendering safety

- Restricted Markdown, raw HTML disabled, server-side rendering, then sanitising.
- Links are limited to internal routes and an allow-list of external domains (for example `ico.org.uk`, `gov.uk`). Founders manage the allow-list.
- No file uploads in this scope, so there is no malware-scanning or storage requirement. Photographs remain unsupported, as in B0.

### 3.4 Input handling

- Every write goes through the existing command endpoint pattern with length limits (B0 uses 200 for titles and 30,000 for content).
- `fields` JSON is validated against a schema per `kind` on the server.
- Search input is length-limited (200 characters), passed as a bound parameter to `websearch_to_tsquery`, and rate-limited per partner (the public site's `web/src/lib/rate-limit-policy.ts` is the model; an admin-side equivalent was not verified).

### 3.5 Independence and privacy

- Progress is private to the partner by default. Founders see aggregates only, unless the partner chooses to share (decision `AP-GOV-03`).
- No progress, completion or knowledge-check data is joined to commission, allocation, recognition or achievements. A test should assert that no such query exists.
- Knowledge-check answers are not stored.
- Search logs: query text and a hashed partner id, retained for a founder-approved period (decision `AP-PRIV-02`). The privacy notice must mention them (decision `AP-PRIV-01`).

## 4. Threats and mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| A partner presents a draft as approved | Partners never receive drafts; every rendered item shows approval metadata | A partner could paraphrase from memory; covered by the Professional Conduct course and the partner agreement |
| Partner-only commission information reaches a client | Audience on item, lint check, ribbons, no copy button | A partner can still screenshot; agreement and training cover this |
| A stale price or policy is quoted | Review-by dates fail closed; commercial figures embedded by reference to programme constants | A partner may have saved an old copy; versions show "updated since" |
| A founder approves their own mistake | Second-founder approval rule; audit trail | Single-founder periods need an explicit override with a reason |
| Stored XSS through content | No raw HTML, server rendering, sanitiser, link allow-list | Renderer dependency must be kept patched |
| Progress used to direct or monitor partners | Private by default, no joins to commercial tables, voluntary framing | Requires founder discipline and solicitor review (`AP-GOV-02`) |
| Search probing reveals hidden content | Search runs only over published, permitted rows; zero results look the same whether content is hidden or absent | None identified |
| Enumeration of other partners' data | All partner queries keyed by the authenticated actor via `partnerGuard` | None identified |

## 5. Verification expected at implementation

- Service tests for every lifecycle transition, including refusals.
- Real-PostgreSQL tests for the trigger and the one-published-version index, as B0 does for its guards.
- Role tests: a partner cannot reach any founder content action; an owner cannot reach partner routes.
- A browser test that a partner sees no draft, no expired item and no client-facing copy control on partner-only items.
- A test asserting progress tables are not referenced by commercial queries.
