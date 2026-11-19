# Financial lock hierarchy (checkpoint 4A, extended in checkpoint 5)

Acquire in this order only: (1) `admin_users` FOR SHARE, (2) `expansion_partners` FOR UPDATE, (3) withdrawal request or payout row, (4) `expansion_contracts` FOR UPDATE, (5) collection-reference advisory lock, (6) `invoices` FOR UPDATE, (7) commission ledger rows and inserts. Advisory lock 7102 (market/exclusivity) is independent: shared by acceptance, exclusive for administration, and never held while waiting on levels 2 to 7 in the opposite direction.

## Finding
A real deadlock existed. Refund locked contract, then partner, then invoice. A collection on a **different contract of the same partner sharing that invoice** locked contract, then invoice, then needed a key-share on the partner row (the ledger's foreign key). Reproduced on real PostgreSQL (the second iteration was chosen as deadlock victim, SQLSTATE 40P01). Fixed by taking the partner lock first in both `verifyExpansionPayment` and `refundExpansionPayment`.

## Evidence
`checkpoint 4A` tests (real PostgreSQL, separate connections): 6 refund-versus-collection iterations on a shared invoice repeated three times with no deadlock; 10 pairwise combinations of request, founder payout, refund, unpaid adjustment, contract cancellation and duplicate collection, two iterations each, with only deliberate 400/409 refusals and a database-wide no-double-allocation invariant.

## Limits
This is empirical plus read-through analysis, not a proof. Contract cancellation (`cancel_contract`, opportunity then contract) does not take the partner lock; it never waits on levels 2 or 3 while holding level 4, so no cycle was found. No automatic retry was added: financial operations are idempotent by reference, but a blind retry of an arbitrary failure could mask defects, so a deadlock victim surfaces as an error for the founder to repeat.

## Checkpoint 5 additions
Nothing in checkpoint 5 writes the commission ledger. The new code follows the same order: `admin_users` FOR SHARE, then `expansion_partners` FOR UPDATE (when two partners are involved, every `admin_users` row first and then every partner row, in ascending id), then, for allocation only, advisory lock 621908148 (prospect admission, shared with registration and suppression) and advisory lock 7102 in shared mode, then the candidate row, then the opportunity row. Recognition and profile code lock the partner and then their own row. Market and exclusivity administration still takes 7102 exclusively and nothing else, so it can only wait, never close a cycle. Reassignment locks both partners in id order, so release against reassignment, and two founders allocating to different partners, cannot deadlock. Invitation and activation take 7102 shared after their row locks.

Evidence: real-PostgreSQL race tests on separate connections (checkpoint 5B to 5E in `expansion-concurrency.integration.test.ts`) repeated several times without deadlock.
