# Withdrawal request lifecycle (checkpoint 3B)

A withdrawal request is **not** a money transfer. It is a controlled request against eligible, verified, unpaid commission. There is no second ledger.

## Allocation strategy

- A request **reserves specific `expansion_commission_ledger` entries** (`expansion_withdrawal_entries`). The sum of the reserved entries is the request amount; it must be positive and at least the policy minimum.
- Reservations are append-only with a `released_at` marker (the admin runtime has no DELETE privilege). A partial unique index permits at most one live reservation per ledger entry.
- Two database triggers close the double-allocation holes in both directions: a reservation cannot start on an entry already claimed by a payout, and a payout cannot claim an entry reserved by a different request.
- Founder-initiated payout preparation excludes reserved entries. Unpaid-refund adjustments are refused while the affected commission is reserved.
- Everything serialises on the existing partner row lock used by payout preparation, cancellation and refunds.

## States

`submitted` → `approved` → `payout_prepared` (reserved entries become an ordinary payout) or `rejected` / `cancelled` (reservations released). The displayed status of a prepared request is the payout's own status (prepared, approved, paid, cancelled). A cancelled payout returns the request to `approved`; a replacement payout needs a new invoice reference because payout references are unique per partner.

## Eligibility and gates

Withdrawal is refused while: no payout policy exists or it is disabled; any refund entitlement review is outstanding (disputed amount); an entry is already allocated; the invoice reference is required but missing; or the amount is below the minimum. Conditional commission is not in the ledger, so it can never be requested. Previously settled commission is never deducted automatically.

## Policy

`expansion_withdrawal_policies` is append-only and versioned (enabled, minimum, invoice required, approval reference). **No policy row exists by default, so withdrawals are unavailable.** The minimum, frequency, payment methods and invoice requirements are founder decisions; no values were invented.

## Authority

Partners: view own balances, request, cancel (before payout preparation). Founders: set policy, review, prepare the payout, then approve, settle manually and reconcile through the existing payout workflow. Partners cannot approve, settle or change policy.

## Evidence

31 PGlite service tests and 11 real-PostgreSQL separate-connection race tests (request vs request, vs founder payout, vs partial refund, vs unpaid-refund adjustment, approval vs refund, cancel vs prepare, cancel vs settle, replay, reallocation, cross-partner). Browser: request → review → payout → settlement observed by the partner in the real UI.
