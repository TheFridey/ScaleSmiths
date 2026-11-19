# Test plan

## Baseline

For each app run `npm test`, `npm run lint`, `npm exec tsc -- --noEmit`, `npm run build`. Preserve command logs under ignored `.tmp/expansion-baseline`. Record environment/package damage separately from source failures. Before migrations run root history/consistency gates.

## Behaviour and adversarial checks

- Validate application fields, consent, length/URL constraints, closed admissions, rate limiting and same-origin controls.
- Partner role denies all internal routes/APIs and unknown pages; persisted disable/session revocation applies; invitation expiry, replay and concurrent consumption fail.
- Prospect normalization/deduplication reveals no unrelated records, suppression is respected, discovery/scope ownership enforced.
- Capacity serializes concurrent reservations and rejects exhaustion; accepted scope/terms cannot be mutated.
- Real financial service tests execute exact standard £705 journey, partial/cumulative rounding, custom pricing, VAT-exclusive receipts, duplicate/conflicting/concurrent references, approved refunds, payout exclusion and statement reconciliation.
- Cross-partner read/write requests fail and resources expose only published approved content.

## Browser

Use clearly labelled isolated demo accounts, actual persisted workflows, desktop/laptop/tablet/mobile layouts and screenshots. Verify keyboard labels/focus, success/error/empty states and no overflow. Automated checks do not establish complete accessibility or security. The full requested 30-step journey is the foundation acceptance gate.
