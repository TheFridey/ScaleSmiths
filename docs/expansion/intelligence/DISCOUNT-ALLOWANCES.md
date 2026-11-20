# Discount allowances

- **Default: none.** No policy row means no discount. Quantities are founder decisions (see FOUNDER-DECISIONS.md) and nothing is invented.
- Founder sets a per-partner policy: period, allowance count (0 to 50), permitted build fees (integer pence, below £2,000) and an approval reference. Periods cannot overlap; the count cannot be lowered below reserved or consumed use.
- Reservation is a founder action on an **approved** opportunity (scope approved, capacity reserved). It locks the policy row, checks the fee is permitted and the count unspent, and allows one active reservation per opportunity (unique partial index).
- Acceptance consumes the reservation in the same transaction as the contract; a fee that differs from the reservation, an expired period or a missing reservation is refused. Resolved reservations are immutable and undeletable (trigger).
- Free build (£0) uses the same path, still needs an enabled plan, approved scope, capacity, an accepted contract and a verified first retainer. Commission outcomes for £2,000 / £1,500 / £1,000 / £500 / £0 are £705 / £555 / £405 / £255 / £105 (unit and persisted-ledger tests).
- Partners see only their own remaining count. Partners cannot reserve, set policies or approve anything.
- Concurrency (real PostgreSQL, separate connections): two reservations against one slot admit one; six against three admit exactly three; a policy reduction racing a reservation never leaves use above the allowance.
