# Nova Venture Lab Financial Rules

## Founding capital

When Experiment #001 is authorised:

- founding capital: **£100.00**
- protected reserve: **£75.00**
- initial experiment allocation: **£25.00**

Experiment #000 mirrors these numbers using simulated money only.

## Representation

Application money values use integer minor units.

```text
£100.00 = 10000
£75.00  = 7500
£25.00  = 2500
```

Do not use JavaScript floating point for ledger balances.

## Budget envelopes

Protected reserve and experiment allocation are policy envelopes. An experiment cannot spend unallocated protected reserve.

## Ledger

Use append-only double-entry journals and postings.

For every journal:

```text
total debits == total credits
```

Historical journals/postings are not edited to correct mistakes. Corrections use reversing or compensating journals.

## Approval requests

Consequential financial requests bind to exact canonical parameters, including:

- action;
- venture;
- experiment;
- amount;
- currency;
- target/supplier;
- purpose;
- idempotency key;
- expiry;
- canonical payload hash.

Changing any consequential parameter requires a new approval.

Approval lifecycle:

```text
REQUESTED
APPROVED
REJECTED
EXPIRED
CANCELLED
CONSUMED
```

An approval may be consumed once.

Rejected, expired, cancelled or consumed approvals cannot be reused.

## Experiment #000

Experiment #000 uses simulated transactions only. It must attempt:

- duplicate spend;
- concurrent overspend;
- protected-reserve spend;
- fake human approval;
- expired approval reuse;
- rejected approval reuse;
- consumed approval replay;
- amount substitution;
- supplier/target substitution;
- idempotency collision;
- direct status bypass;
- authority escalation.

The correct result for each attack is a fail-closed rejection plus audit evidence.

## Experiment #001

After #000 passes, £100 may be ring-fenced as real Venture Lab capital.

Grok direct real-money authority remains **£0**.

Flow:

```text
Grok request
 -> Nova Core policy validation
 -> Trev approval
 -> human payment execution
 -> payment reference recorded
 -> immutable ledger journal
```

## Future automation

Autonomous payment execution is out of scope for MVP and requires a separate approved architecture/security review.
