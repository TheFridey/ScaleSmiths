# Financial lock hierarchy (checkpoint 4A)

Acquire in this order only: (1) `admin_users` FOR SHARE, (2) `expansion_partners` FOR UPDATE, (3) withdrawal request or payout row, (4) `expansion_contracts` FOR UPDATE, (5) collection-reference advisory lock, (6) `invoices` FOR UPDATE, (7) commission ledger rows and inserts. Advisory lock 7102 (market/exclusivity) is independent: shared by acceptance, exclusive for administration, and never held while waiting on levels 2 to 7 in the opposite direction.

## Finding
A real deadlock existed. Refund locked contract, then partner, then invoice. A collection on a **different contract of the same partner sharing that invoice** locked contract, then invoice, then needed a key-share on the partner row (the ledger's foreign key). Reproduced on real PostgreSQL (the second iteration was chosen as deadlock victim, SQLSTATE 40P01). Fixed by taking the partner lock first in both `verifyExpansionPayment` and `refundExpansionPayment`.

## Evidence
`checkpoint 4A` tests (real PostgreSQL, separate connections): 6 refund-versus-collection iterations on a shared invoice repeated three times with no deadlock; 10 pairwise combinations of request, founder payout, refund, unpaid adjustment, contract cancellation and duplicate collection, two iterations each, with only deliberate 400/409 refusals and a database-wide no-double-allocation invariant.

## Limits
This is empirical plus read-through analysis, not a proof. Contract cancellation (`cancel_contract`, opportunity then contract) does not take the partner lock; it never waits on levels 2 or 3 while holding level 4, so no cycle was found. No automatic retry was added: financial operations are idempotent by reference, but a blind retry of an arbitrary failure could mask defects, so a deadlock victim surfaces as an error for the founder to repeat.
