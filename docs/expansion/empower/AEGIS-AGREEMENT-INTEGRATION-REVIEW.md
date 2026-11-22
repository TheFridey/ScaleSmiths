# Project Aegis: partner agreement integration review

Reviewed 22 November 2026. Nothing was uploaded, published, approved or issued. No legal wording was written or changed.

## 1. Where the solicitor-reviewed documents were looked for

The brief states that solicitor-reviewed partner agreement documents exist. They were searched for in every source this session could reach. **None was found, and none could be read.** That does not mean they do not exist.

| Source | Result |
|---|---|
| Repository, every branch and all history (`git log --all`, `git grep` across every remote ref) | No agreement, master agreement, jurisdiction addendum or release checklist. The only related file is `docs/expansion/empower/resources/R02-partner-handbook.md`, a `DRAFT`, `BLOCKED` handbook that says "The partner agreement takes precedence over this handbook" |
| Claude artifacts and documents shared with this account | Four artifacts (two audits, an asset ledger, one untitled); none is an agreement |
| Gmail connector | **Unavailable**: it asks to be signed in again. Reconnect it in claude.ai connector settings, then re-run the search |
| The founders' own computers or drives | Not attached to this session |

**Needed from the founders** to complete this review:

1. The latest approved master partner agreement.
2. The partner handbook version that the agreement references, if it is separate.
3. Each jurisdiction addendum, with the markets it covers.
4. The solicitor's review record: date, reviewer, version reviewed, any conditions.
5. The release checklist, if one was prepared.

Supply them as files to a session (or through a reconnected Gmail or Drive). They are **not** committed to the repository without a separate decision. The portal only ever needs the final text, entered as governed content.

## 2. What the portal does today (verified in code and tests)

| Requirement | Implementation | Status |
|---|---|---|
| Full agreement text | Governed content of kind `agreement`. The body is the full text, at least 200 characters; Markdown supports headings, lists, bold, tables, block quotes and rules. HTML is shown as literal text | PASS |
| Correct version | Versions are immutable once submitted. Publishing a new version supersedes the old one. Two-founder approval, or a recorded reason when only one founder is active | PASS |
| Source references | Publishing requires a `legal:<review reference>` source | PASS |
| Document digest | The database computes SHA-256 of the exact title and text (`partner_agreement_digest`), so the client cannot supply it | PASS |
| Acceptance identity | The partner's own user and partner IDs come from the session. A database trigger refuses acceptance by anyone but the partner it was issued to | PASS |
| Timestamp | The database clock (`now()`), set by trigger | PASS |
| Immutable history | `partner_agreement_acceptances` is append-only by trigger. Every acceptance is kept | PASS |
| Downloadable accepted copy | The partner's own copy, with the digest re-checked against the stored text; founders can download any copy. Labelled "not a qualified electronic signature" | PASS |
| Reissue process | Founders issue a newer published version; the partner must accept it on the existing page. The partner's state shows *update awaiting acceptance* (B1.7) | PASS |
| Historical versions | Each acceptance records slug, version, title and digest; old versions remain readable | PASS |
| Click-to-accept adequacy | Typed name, single-use invitation, server timestamp and digest. This is a simple electronic signature, **not** a qualified one. Whether it is adequate is a legal decision | BLOCKED (`AP-LR-01`) |

## 3. Jurisdictions: a gap to close before a second market

The data model binds **one** agreement version to each partner, and an agreement has no structured fields: deliberately only its title and text (`empower-content.ts`). Invitations check that the partner's *operating market* is approved, but nothing checks that the **issued agreement belongs to that market**.

What this means:

- **Can be represented today**, as one composite agreement per jurisdiction. Each would be its own content item whose text is the master agreement followed by that market's addendum, word for word, for example `partner-agreement-gb`. The digest then covers exactly what the partner accepted, master and addendum together.
- **Risk:** a founder could issue the GB composite to a partner whose operating market is elsewhere, and the system would not object. With only GB approved today, this is not yet exposed.
- **Proposed technical change** (not implemented, because the structure of the real documents is unknown):
  - add a required `jurisdictions` list (ISO country codes) to agreement content;
  - refuse to invite or reissue when the partner's `operating_country` is not in that list;
  - show the jurisdiction beside the version in the agreement register.

  This is a small, separately reviewable change with synthetic tests. It should be designed once the founders confirm whether addenda are per country, per region, or optional schedules.

## 4. Turning approved documents into portal content (when supplied)

1. Convert each approved document to the portal's Markdown **without editing wording**. Numbering, defined terms, tables and schedules are kept. Anything Markdown cannot express is flagged, never silently reworded.
2. For each jurisdiction, combine the master agreement and the relevant addendum in the order the solicitor specifies.
3. **The solicitor confirms the converted text** against the approved originals. The text is what is hashed and accepted, so conversion is itself a legal review step.
4. Founders create the agreement draft in the Content studio, citing `legal:<review reference>`. A second founder approves and publishes it. Publication remains a founder decision, outside engineering.
5. Only then do invitations become possible: `PARTNER_ACTIVATION_ENABLED` and an approved market are also required (Gate B).

## 5. Outstanding decisions

| ID | Decision | Owner |
|---|---|---|
| `AP-LR-01` | Is click-to-accept adequate, or must an e-signature provider be used? | Solicitor, founders |
| `AP-LR-02` | Commercial specification in the agreement: eligibility, timing, refunds, chargebacks, cancellations, tax, territory, exclusivity, termination, disputes, governing law | Founders, solicitor, accountant |
| `AP-GOV-01` | Partner role wording matches the final agreement | Founders, solicitor |
| `AP-AGR-JUR` (new) | Jurisdiction structure of the agreement (per country, region or schedule), which decides the technical change in section 3 | Founders, solicitor |
| `AP-AEGIS-PRIV-05` | Retention of acceptance records | Founders, solicitor |
