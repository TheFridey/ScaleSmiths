# Achievements and referrals (checkpoint 4B)

**Nothing here creates a payable liability.** There is deliberately no ledger or payout integration for rewards. A reward is a record with a status; moving a bonus to approved is refused by the database unless an approved programme version explicitly enables financial rewards.

## Qualification
- A *qualifying client* is a **founder decision** (`expansion_client_qualifications`) on a real accepted contract of that partner with verified net collections. Progress is `count(status='qualified')`, never an editable number.
- Refused: cancelled contract, no verified collections, outstanding refund review, below an approved programme minimum, or a canonical client already counted (for any partner). A DB trigger requires the contract and client to belong to the partner. Decisions are immutable; a wrong one is revoked (reason required) and decided again.
- Unresolved policy (founder decisions): minimum payment, duration, refund/cancellation effect, additional-customer and common-ownership treatment. Defaults are conservative: manual review, one count per canonical client.

## Programmes and rewards
- `expansion_achievement_programmes` versions the schedule (seeded from the proposed table: polo 1, webpage 5, then £250 / £750 / £2,000 / £5,000 / £15,000 / £30,000 at 10 / 25 / 50 / 100 / 250 / 500). Approved versions and their milestones are immutable. Financial and referral rewards are separate flags, default off, and require approval.
- Reaching a threshold creates a **conditional** reward (unique per partner and milestone). Statuses: conditional → under_review → approved → fulfilment_pending → fulfilled (or rejected). A reward created before any programme exists may adopt an approved programme once, only if it defines the same milestone, kind and amount.
- Revoking a qualification withdraws unapproved rewards whose threshold is no longer met; approved ones stay and are flagged for review.
- Cumulative planned bonuses (£8,000 / £23,000 / £53,000 at 100 / 250 / 500) are shown as an illustration only.

## Referrals
- One unique code per partner (`SS-` + 8 base32 characters). A founder records the attribution on an **open** application before activation; it is immutable and cannot be reassigned. Self-referral (same application or email) and attribution after activation are refused by trigger. The applicant is vetted exactly as any other; nothing is automatic.
- When the referred partner reaches five qualifying clients, a conditional £250 reward appears (unique per referral); it is withdrawn if the count falls. Approval needs a programme with referral rewards enabled.
- The referrer sees a coarse stage and a count only: no names, customers, finances or notes. No downline, no recurring commission.

## Evidence
10 service tests, 5 real-PostgreSQL race tests (same-client double decision, concurrent qualifications, revoke versus reward decision, referral attribution race, commission ledger unchanged), and a browser journey.
