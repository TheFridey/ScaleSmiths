# Platform audit: reusable systems for Empower

**Status: DRAFT.** Audited against B0 head `4e713e5` (branch `claude/modest-newton-jo2d95`). Facts below are `CONFIRMED: SYSTEM BEHAVIOUR` unless marked otherwise. Anything not inspected is marked "not verified".

## Summary

The B0 Partner Portal already has the essential primitives for a Resource Centre: a versioned, immutable, audience-tagged resource table with a database-enforced publication lifecycle, a founder publishing form, a partner search box and an onboarding toolkit item reserved for the Academy. What is missing is structure (courses, lessons, knowledge articles with fields), approval evidence (who approved which version, and when it must be reviewed again), progress tracking and a proper search index. Empower should **extend these patterns, not replace them**.

## 1. Partner Portal (admin app, `/partner`)

| Aspect | Finding | Source |
|---|---|---|
| Location | Lives on the existing admin origin. No separate subdomain or authentication stack | `web/src/lib/partner-programme.ts` (`partnerLoginUrl`), `admin/src/app/partner/page.tsx` |
| Role | `independent_partner` holds exactly one capability, `expansion.partner` | `admin/src/lib/rbac.ts:28` |
| Route guard | `/partner` and `/partner/*` map to `expansion.partner`; `/api/partner*` is the only API family that capability reaches | `admin/src/lib/rbac.ts:53`, `:99` |
| Workspace | One client component with tabs: Overview, Prospects & scope, Resource library, Commission centre, Achievements, My web page, Referrals, Onboarding, Meetings | `admin/src/components/expansion/ExpansionWorkspace.tsx:67` |
| Styling | Scoped `ex-*` classes in `expansion.css`: panels, badges, `details`-based resource rows, list rows | `admin/src/components/expansion/expansion.css` |
| Server guard | Partner reads run in a transaction behind `requireCapability("expansion.partner")` and `partnerGuard`, which share-locks the user row | `admin/src/lib/server/expansion-operations.ts:31-52` |

**Reuse:** add Academy and Resource Centre as new workspace areas (or child routes under `/partner`) behind the same capability. **Gap:** the workspace is a single large component; new areas should be separate route segments so they can be code-split and tested independently (see [ARCHITECTURE.md](ARCHITECTURE.md)).

## 2. Founder administration (`/expansion`)

- Route `/expansion` requires `expansion.manage`; founder-only actions use `expansion.founder`. Owner and administrator roles exclude `expansion.partner`, so a founder account never doubles as a partner (`admin/src/lib/rbac.ts:26-27`).
- The founder workspace already includes Recruitment, Programme, Partner operations, Research and allocation, Recognition, Web pages and Delivery capacity tabs.
- Every write goes through one command endpoint (`admin/src/app/api/expansion/route.ts`) and writes an audit row (`audit(tx, actor.id, id, 'resource_created', …)` in `admin/src/lib/server/expansion.ts:279`).

**Reuse:** the founder publishing interface belongs here, as a new "Content" area using the same command and audit pattern.

## 3. Existing resource system

| Aspect | Finding | Source |
|---|---|---|
| Table | `expansion_resources(id, title, category, version, audience ∈ {partner, client}, content, status ∈ {draft, published, archived}, created_by, created_at)` | `admin/drizzle/0068_expansion_foundation.sql:46-51` |
| Immutability | A trigger refuses deletes and any change to content fields. Content changes need a new version | `admin/drizzle/0070_expansion_cancellations.sql:8-15` |
| Lifecycle | Only `draft → published`, `draft → archived` and `published → archived` are allowed, in both the trigger and the service | same, and `admin/src/lib/server/expansion.ts:282-288` |
| Partner read | Only `status='published' AND audience='partner'` rows reach the partner snapshot (filtered on the server) | `admin/src/lib/server/expansion.ts:118` |
| Rendering | Plain text with `white-space: pre-wrap` (`ex-prewrap`). No Markdown or HTML rendering, so no injection surface today | `ExpansionWorkspace.tsx:77` |
| Search | Client-side substring match over title and content, plus a category filter | `ExpansionWorkspace.tsx:28-29`, `:77` |
| Limits | Title 200 characters, category 100, content 30,000 | `expansion.ts:278` |
| Client audience | No consumer of `audience='client'` rows was found in `web/src` (searched for `expansion_resources`). Client-facing resources therefore have no delivery route today | search result, not exhaustively verified |

**Gaps for Empower:**

1. There is no approval evidence: `published` records who created a row, not who approved it, against what source or until when. Empower needs an approval record per version, with reviewer, date, source references and review-by date.
2. There is no `superseded_by` link, so partners cannot tell which version is current within a family of versions.
3. Plain text cannot carry structured lessons, checklists or knowledge-base fields.
4. Client-side substring search will not scale beyond a few dozen items and gives no ranking.
5. There is no expiry. The public-claims registry already models `reviewExpiresAt` and this should be copied.

## 4. Onboarding toolkit

- Fourteen catalogue items, including `academy` ("Partner Academy access"), `brochures`, `pricing_documents`, `commission_documents`, `founder_training` and `technical_assistance` (`admin/src/lib/expansion-operations.ts:7-22`).
- Status per partner is recorded manually by a founder. Evidence is mandatory before an item can be `available` or `completed`, and only a **published partner resource** can be linked (`expansion_toolkit_items.resource_id`, joined in `getToolkit`).

**Reuse:** when a resource such as the partner handbook is published, the founder can link it to the matching toolkit item with no new code. The `academy` item should move to `available` only when Phase 2 of [IMPLEMENTATION-PHASES.md](IMPLEMENTATION-PHASES.md) ships.

## 5. Meetings and escalation

Seven meeting types exist: `joint_sales`, `technical_scoping`, `bespoke_discovery`, `commercial_assistance`, `proposal_review`, `training`, `escalation` (`admin/src/lib/expansion-operations.ts:26`). Meetings have no link to commission.

**Reuse:** the technical escalation guide and every "escalate" note in the knowledge base should point to these meeting types instead of inventing a new escalation channel.

## 6. Commercial programme configuration

| Item | Value in source | Status |
|---|---|---|
| Programme name | "Scale Your Future" | `PROPOSED POLICY` (public page is "Draft, built, not approved") |
| Acquisition commission | 3,000 basis points (30%) on eligible collected, VAT-exclusive payments | `PROPOSED POLICY` |
| Standard example | £2,000 build + £350 first Growth Partnership payment → £600 + £105 = £705 | `PROPOSED POLICY`; arithmetic `CONFIRMED: SYSTEM BEHAVIOUR` |
| Minimum term | 12 months; minimum contract value £6,200 | `PROPOSED POLICY` (`standard-v2`, disabled) |
| Discounted builds | £1,500 / £1,000 / £500 / £0 → £555 / £405 / £255 / £105 | `PROPOSED POLICY`; no allowances approved |
| Bespoke | 30% of eligible collected value unless a different approved rate | `PROPOSED POLICY` |
| Later retainers | Earn no acquisition commission | `PROPOSED POLICY` |
| Plans | `standard-v2`, `growth-only-v1`, `bespoke-v1` all disabled by default | `CONFIRMED: SYSTEM BEHAVIOUR` |
| Achievements and referrals | Implemented; **not payable** | `CONFIRMED: SYSTEM BEHAVIOUR` |
| Withdrawals | Implemented; **not operational** (no approved policy) | `CONFIRMED: SYSTEM BEHAVIOUR` |
| Markets | The market register is fail-closed and starts with no market approved, including the UK; founders approve markets one by one. Live production state not inspected | `CONFIRMED: SYSTEM BEHAVIOUR` (default) |
| Historical plan | `standard-v1`: six-month term, £4,100 minimum; accepted agreements keep their terms and per-milestone rounding | `CONFIRMED: SYSTEM BEHAVIOUR` ([ARCHITECTURE.md](../intelligence/ARCHITECTURE.md), [COMMERCIAL-ACCEPTANCE-MATRIX.md](../intelligence/COMMERCIAL-ACCEPTANCE-MATRIX.md)) |

Sources: `web/src/lib/partner-programme.ts`, [COMMISSION-RULES.md](../COMMISSION-RULES.md), [COMMERCIAL-INTEGRATION.md](../intelligence/COMMERCIAL-INTEGRATION.md), [DISCOUNT-ALLOWANCES.md](../intelligence/DISCOUNT-ALLOWANCES.md), [MARKET-ELIGIBILITY.md](../intelligence/MARKET-ELIGIBILITY.md), [PROGRAMME-ALIGNMENT.md](../intelligence/PROGRAMME-ALIGNMENT.md).

**Implication:** the commercial courses and the commission reference must read from the same source as the engine (`partner-programme.ts` constants), or quote them with a version stamp, so that a figure can never drift from the one the engine calculates.

## 7. Service offerings (public site)

| Offer | Published wording | Source |
|---|---|---|
| Website design and development | From £2,000 | `web/src/lib/published-starting-prices.ts` |
| Growth Partnership | From £350/month; not an unlimited marketing package | same |
| Business Growth Audit | £395; credited against an eligible subsequent build where the published terms apply | same |
| Managed Business Email | From £15/month for three 5GB mailboxes; setup included | same, and `web/src/lib/managed-business-email.ts` |
| Custom platforms and enterprise | "Never sold against a website starting price. Scoped after discovery." | `web/src/lib/engagement-models.ts` |
| Starting-price boundary | `STARTING_PRICE_BOUNDARY` text | `published-starting-prices.ts` |

The FAQ library (`web/src/lib/faq-library.ts`, about 60 answers) is the single best source for approved client-facing explanations. Its header requires every answer to stay consistent with published evidence, and it flags `ownerReview` where founders should confirm practice. The knowledge base in [KNOWLEDGE-BASE.md](KNOWLEDGE-BASE.md) is built from it.

## 8. Case studies and proof

- Published projects in `web/src/lib/data.ts`: Foot Works Podiatry, Confirm-A-Kill, Precision Finish Plastering & Rendering, Glow Tanning, Pinkys Prints, CSDS, The Business Circle, Prymal and VeteranFinder.
- Outcome and quote claims go through the public-claims registry (`web/src/lib/public-claims.ts`): a claim is shown only if it is verified, client-approved (or not required), inside its review window and permitted for that route and component.

**Reuse:** Academy content may describe what was built (as the FAQ library already does). It must not quote outcomes, metrics or testimonials unless the claim is verified in that registry **and** founders approve partner use (register item `AP-PROOF-01`). The claim-selection pattern (permitted placement, review expiry) is the model for the knowledge base approval fields.

## 9. Public programme pages (`web/src/app/partners`)

- `/partners` presents the programme with an earnings calculator and the `FEATURE_AVAILABILITY` table, which already lists "Partner Academy: IN DEVELOPMENT, Optional and voluntary" and "Website Intelligence, Sales Studio, Ask ScaleSmiths: IN DEVELOPMENT, not yet available to partners".
- Its wording on independence ("an independent, commission-only opportunity. There is no salary, guaranteed income, compulsory working hours or sales target") is the source for the Professional Conduct course. The page itself is "Draft, built, not approved".
- Public partner profiles are off unless `PUBLIC_PARTNER_PROFILES_ENABLED=true` (`web/src/lib/partner-profile-public.ts:13`).

**Implication:** nothing in Empower changes the public page. If the Academy ships, the availability label changes only by a separate founder-approved content change.

## 10. Design systems

There are two token sets, both dark-first with gold accents:

| Token | Public site (`web/src/app/globals.css`) | Admin and portal (`admin/src/app/globals.css`) |
|---|---|---|
| Background | `--bg #0b0a08` (warm black) | `--bg #131416` (cool charcoal) |
| Surfaces | `--s1 #141210`, `--s2 #1c1915`, `--s3 #26221c` | `--s1 #1a1b1e`, `--s2 #222428`, `--s3 #2a2d31` |
| Text | `--t1 #f5efe6`, `--t2 #c9bdb0`, `--t3 #95887a` | `--t1 #f1f5f9`, `--t2 #a6b0be`, `--t3 #667085` |
| Accent | `--acc #e8a045` (amber gold) | `--acc #d1b266` (metallic gold) |
| Silver | `--silver #cfc7bc` | none |
| Display type | Syne (self-hosted) | Arial Black fallback under the `--font-syne` name |
| Body type | Inter | Inter |

The Partner Portal also hard-codes some values in `expansion.css` (`#131416`, `#18191b`, `#c3a86c`). [DESIGN-SPECIFICATION.md](DESIGN-SPECIFICATION.md) reconciles these and records a contrast finding: admin `--t3 #667085` is 3.71:1 on `--bg`, below the WCAG AA 4.5:1 threshold for body text.

## 11. Things Empower must not reuse

- **`delivery_resources` in the client portal** (`web/src/lib/schema.ts:223`) belongs to client project delivery. It is tenant-scoped client data and must stay separate from partner content.
- **The public-claims registry** must not be used to store partner training. It governs public marketing claims only. Empower copies its approval pattern instead.
- **AI features.** No AI provider, budget or data-processing agreement is approved ([FOUNDER-DECISIONS.md](../intelligence/FOUNDER-DECISIONS.md)). "Ask ScaleSmiths" stays out of scope; see the deterministic search decision in [ARCHITECTURE.md](ARCHITECTURE.md).
