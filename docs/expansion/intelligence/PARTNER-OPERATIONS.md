# Partner operations: toolkit, meetings, governance gates (checkpoint 4)

## Onboarding toolkit (manual fulfilment)
Fourteen catalogue items. Defaults are honest: features that exist in this software (referral identifier, joint-meeting requests) show *available*; everything external (dedicated email, CircleCard, brochures, Academy, prospects, personal webpage...) shows *planned*. A founder records status per partner; **evidence is mandatory before an item can be available or completed** (service and database). Only a published partner resource can be associated. Nothing is provisioned, bought or sent.

## Meeting requests (manual)
Seven meeting types; one to five preferred times plus an IANA time zone; optional own opportunity. Lifecycle: requested, under review, information required, alternative proposed, confirmed, declined, cancelled, completed, with database-enforced transitions and a mandatory confirmed time. Partners submit, answer, accept an alternative and cancel; founders decide. Times are never invented, no calendar event is created and no invitation is sent. The tables have no link to commission, so founder attendance cannot reduce it.

## Market eligibility and exclusivity (acceptance gates)
- **New** acceptance by any route, including legacy `standard-v1` terms, needs a founder-confirmed customer country in an approved market (`*` for legacy: any approved market; plan-based: the plan must be listed). **Existing accepted contracts are grandfathered**: they are never re-evaluated and collections, refunds and payouts on them continue under any later policy change.
- Exclusivity compares by founder-defined canonical sector where both sides are classified; a classified restriction can be cleared against an unclassified prospect only by a founder classification. Wording-only comparison remains the conservative fallback and always errs towards review. Exclusivity terms are immutable; corrections supersede.
- Decision point: `assertAcceptanceGates` inside the acceptance transaction, under the shared advisory lock 7102 (administration takes it exclusively).

## Not built
Prospect research and allocation, partner-activation and applicant market gating, Founding Partner recognition, personal profiles.
