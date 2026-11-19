# Expansion financial invariants

Accepted terms are immutable. Commission rates use integer basis points and authoritative amounts use integer pence. Cumulative qualifying cash is evaluated per milestone. A positive receipt earns no more than the difference between the cumulative entitlement and the ledger already recognised. A cash refund that leaves entitlement outstanding cannot reopen the original commission cap.

The standard fixture records 100000, 100000 and 35000 net pence and earns 30000, 30000 and 10500 pence. Bespoke maximums derive from their own accepted limits and rate. Only the first retainer can earn retainer commission under the current plan.

Each payment event is bound to one canonical payment. A reference replay with the same fingerprint returns the original event. Conflicting reuse fails. Contract, invoice and reference locks serialize competing writes. Refunds preserve the original and append linked signed records. Cumulative refunded net and VAT are independently bounded. A canonical Expansion refund cannot commit without its matching event.

An eligible ledger entry can be claimed by one payout at a time. A payable batch includes signed adjustments and its ledger sum must equal its reviewed invoice net amount. Payout approval and settlement reconcile to the immutable allocation. Cancellation releases only the claim of a prepared batch. Historical allocations remain intact and the cancelled payout is terminal. Recorded settlement remains historically visible.

Founder authority is checked against the persisted actor inside financial writes. Partner reads are scoped by the active identity and session version. Refund treatment, approved payout terms and cancellation evidence are attributable through immutable events or audit records.

See the final report for executed evidence. Production reconciliation requires founders to verify underlying invoice allocation and settlement evidence, and accounting approval for VAT handling.
