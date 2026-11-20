# R12 Commission and payment reference

| Field | Value |
|---|---|
| Status | `DRAFT`, `BLOCKED`. Every term below is `PROPOSED POLICY` |
| Audience | Partner only. Never share with clients |
| Review owner | Founders, accountant, solicitor |
| Sources | `web/src/lib/partner-programme.ts`, [COMMISSION-RULES.md](../../COMMISSION-RULES.md), [COMMERCIAL-INTEGRATION.md](../../intelligence/COMMERCIAL-INTEGRATION.md), [DISCOUNT-ALLOWANCES.md](../../intelligence/DISCOUNT-ALLOWANCES.md), [PROGRAMME-ALIGNMENT.md](../../intelligence/PROGRAMME-ALIGNMENT.md), [FOUNDER-DECISIONS.md](../../intelligence/FOUNDER-DECISIONS.md) |
| Blocking decisions | Final partner agreement; twelve-month terms and eligible payment definitions; withdrawal policy; refund and clawback treatment; partner invoices and VAT; achievement and referral terms; market approval |

> **This is not an offer, agreement or promise of payment.** It illustrates the proposed programme. The partner agreement, once approved, is the only source of entitlement. All plans are disabled in the software until founders enable them.

## How commission is proposed to work

- Rate: 30% (3,000 basis points) of **eligible payments actually collected**, excluding VAT.
- Standard website plan: commission on the build fee and on the **first** Growth Partnership payment. Later monthly payments earn no acquisition commission.
- Growth Partnership only: commission on the first monthly payment.
- Bespoke: 30% of eligible collected value, unless a different rate is approved in writing for that quote.
- Only payments a founder has verified as collected count. Each has an external reference, invoice link, verifier and evidence reference.
- Current plans pool build payments and round once on the cumulative total, so splitting a payment cannot increase the result. Historical `standard-v1` agreements keep per-milestone rounding (differences of a few pence).
- A pending contract value is never earned.
- Commission is acquisition commission only. There is no ongoing monthly commission on later Growth Partnership payments.

## Illustrations (accountant review required)

| Scenario | Eligible collected (ex VAT) | Proposed commission |
|---|---|---|
| Standard: £2,000 build + first £350 | £2,350 | £705 |
| Founder-approved discounted build £1,500 + £350 | £1,850 | £555 |
| Founder-approved discounted build £1,000 + £350 | £1,350 | £405 |
| Founder-approved discounted build £500 + £350 | £850 | £255 |
| Free build (founder-approved) + £350 | £350 | £105 |
| Bespoke, £10,000 collected | £10,000 | £3,000 |
| Bespoke, £50,000 collected | £50,000 | £15,000 |

Payment schedule examples from the draft programme: equal instalments (£1,000 deposit, £1,000 final balance, £350 first Growth Partnership payment), or deposit and completion (£750 and £1,250, then £350). Either way the standard total is £705.

The draft programme also models a twelve-month minimum term and a minimum contract value of £6,200 (£2,000 + 12 × £350). This is a client contract term under review, not a partner entitlement.

Discounted and free builds exist in the software only as founder-reserved allowances; no allowance quantity, eligibility or free-build criterion is approved, so these rows illustrate arithmetic, not an available option.

## Historical agreements

Agreements already accepted under the earlier `standard-v1` plan (six-month term, £4,100 minimum contract value) keep the terms under which they were accepted; the engine leaves them unchanged. New agreements use the plan a founder selects at acceptance. Never quote the six-month term for new work. Sources: [../../intelligence/ARCHITECTURE.md](../../intelligence/ARCHITECTURE.md), [../../intelligence/COMMERCIAL-ACCEPTANCE-MATRIX.md](../../intelligence/COMMERCIAL-ACCEPTANCE-MATRIX.md).

## Refunds

Under the current software default, a refund on a commissionable payment is **held for founder review**; nothing is deducted automatically. Any reversal is an approved, recorded entry with a reason. Whether earned commission is adjusted after a refund is an open legal and accounting decision.

## Withdrawals and payment

Withdrawal requests are built but **not operational**: no frequency, minimum, invoicing or VAT policy is approved. *[FOUNDER DECISION]*

## Planned rewards (not payable)

Achievement rewards and the £250 partner referral reward are **planned and conditional**. The software refuses to approve any reward until a programme version is approved in writing. Do not mention them to anyone as earnings.

## Markets

The software starts with no market approved, including the UK; a founder approves markets one by one. A contract cannot be accepted for a customer in an unapproved market. Check the current market status with ScaleSmiths rather than assuming. GBP only.
