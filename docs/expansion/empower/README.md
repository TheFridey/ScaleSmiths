# Operation Empower: B1 planning package

**Package status: DRAFT. Nothing in this folder is approved, published or available to partners or clients.**

Operation Empower prepares two partner capabilities for engineering:

- the **Partner Academy**, an optional, voluntary learning area inside the Partner Portal; and
- the **Sales Resource Centre**, an approved-content library and knowledge base that partners search before speaking to a prospect.

This is B1 research, architecture and content design only. It changes no application code, migrations, authentication, CI or production systems. Implementation must not start until B0 ([PR #155](https://github.com/TheFridey/ScaleSmiths/pull/155), branch `claude/modest-newton-jo2d95`) is merged. Its readiness record is [B0-MERGE-READINESS.md](../intelligence/B0-MERGE-READINESS.md).

## Contents

| Document | What it holds |
|---|---|
| [PLATFORM-AUDIT.md](PLATFORM-AUDIT.md) | The existing systems Empower reuses, with file references and gaps |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Proposed data model, content lifecycle, deterministic search and integration points |
| [SECURITY-MODEL.md](SECURITY-MODEL.md) | Roles, audience separation, publication controls, threats and mitigations |
| [CURRICULUM.md](CURRICULUM.md) | The 13 Academy courses: objectives, modules, lesson outlines, knowledge checks, resources and review requirements |
| [LESSONS-FOUNDATIONS.md](LESSONS-FOUNDATIONS.md) | Initial lesson content, courses 1 to 6 (company and services) |
| [LESSONS-PRACTICE.md](LESSONS-PRACTICE.md) | Initial lesson content, courses 7 to 13 (selling, policy and conduct) |
| [resources/README.md](resources/README.md) | The 13 Resource Centre drafts, one file each |
| [KNOWLEDGE-BASE.md](KNOWLEDGE-BASE.md) | Approved-content architecture and the knowledge article inventory |
| [DESIGN-SPECIFICATION.md](DESIGN-SPECIFICATION.md) | Visual language, tokens and components, reconciled with the existing design systems |
| [WIREFRAMES.md](WIREFRAMES.md) | Wireframe descriptions for the seven key screens |
| [FOUNDER-APPROVAL-REGISTER.md](FOUNDER-APPROVAL-REGISTER.md) | Every item in this package with its approval status, owner and blocking effect |
| [IMPLEMENTATION-PHASES.md](IMPLEMENTATION-PHASES.md) | Proposed delivery phases and their entry and exit gates |
| [ACCEPTANCE-CRITERIA.md](ACCEPTANCE-CRITERIA.md) | Testable acceptance criteria for each phase |
| [CONTENT-REVIEW-REGISTER.md](CONTENT-REVIEW-REGISTER.md) | Full read-back audit: findings, lesson inventory, commercial and technical claims, resources, knowledge base, objections, accessibility |
| [B1-STATUS.md](B1-STATUS.md) | B0 merge blocker, B1 implementation gate and deliverable status |

## Status vocabulary

Every item in this package carries one of these labels. The register lists them all.

| Label | Meaning | May a partner use it? |
|---|---|---|
| `CONFIRMED: PUBLISHED` | The wording or figure is already published on the public site from a founder-maintained source in the repository (for example `web/src/lib/published-starting-prices.ts` or `web/src/lib/faq-library.ts`). Empower restates it; it does not create it. | Only once an Academy or resource version containing it is approved and published |
| `CONFIRMED: PUBLISHED, OWNER REVIEW` | Published, but the source marks it `ownerReview: true`, so founders should confirm it before it is expanded | No, until confirmed |
| `CONFIRMED: SYSTEM BEHAVIOUR` | A fact about how the software behaves, verified in B0 source. It is not commercial approval | Not on its own |
| `PROPOSED POLICY` | A commercial or legal position that exists in B0 drafts or the draft `/partners` page but is not approved (for example the 30% acquisition commission) | No. Must always be labelled as proposed |
| `DRAFT` | Written in this package. Needs founder review | No |
| `FOUNDER DECISION` | Content cannot be finalised until a founder or adviser decides | No |
| `BLOCKED` | Waiting on an external prerequisite, such as the B0 merge or legal advice | No |

No item in this package is `APPROVED`. That status exists only in the future publishing workflow (see [ARCHITECTURE.md](ARCHITECTURE.md)), where a founder records it against an immutable content version.

## Content rules applied throughout

These rules come from the B0 programme sources and the public-site content policy. They apply to every draft here and to every future edit.

1. **No guaranteed outcomes.** No ranking, traffic, enquiry, revenue or earnings guarantees. The source position is published at `faq-library.ts` (`ranking-guarantees`) and on `/partners` ("No guaranteed earnings").
2. **No invented proof.** No testimonials, quotes, statistics or client names beyond the published work listed in `web/src/lib/data.ts`. Partner reuse of published case studies still needs founder permission (see [CONTENT-APPROVAL-REGISTER.md](../intelligence/CONTENT-APPROVAL-REGISTER.md)).
3. **Prices are the published starting prices only**: website from £2,000, Growth Partnership from £350 per month, Business Growth Audit £395, business email from £15 per month. Always paired with the starting-price boundary (`STARTING_PRICE_BOUNDARY`). GBP only.
4. **Commission and rewards are proposed, never promised.** Figures in `web/src/lib/partner-programme.ts` are illustrations of the proposed programme. Every plan is disabled by default and no reward is payable.
5. **Independence is preserved.** The Academy is optional and voluntary, as the programme states. No course is compulsory and no completion affects commission, allocation or standing. An employment solicitor should confirm this (register item `AP-GOV-02`).
6. **Partner-only and client-facing material are kept apart.** Client-facing material never contains commission, founder-only or internal information.
7. **Escalate rather than improvise.** Where an answer depends on scope, contract or technical review, the content says so and names the escalation route.

## Relationship to existing registers

This package extends, and does not replace, the B0 registers:

- [FOUNDER-DECISIONS.md](../intelligence/FOUNDER-DECISIONS.md): commercial, legal and operational decisions;
- [CONTENT-APPROVAL-REGISTER.md](../intelligence/CONTENT-APPROVAL-REGISTER.md): content not yet written (much of which this package now drafts);
- [COMMERCIAL-ACTIVATION-GATES.md](../hardening/COMMERCIAL-ACTIVATION-GATES.md): release modes and gates.

When the founders approve an Empower item, record it in [FOUNDER-APPROVAL-REGISTER.md](FOUNDER-APPROVAL-REGISTER.md) and, where it resolves a row there, in the matching B0 register.
