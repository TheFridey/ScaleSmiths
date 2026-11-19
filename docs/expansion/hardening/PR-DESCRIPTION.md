# Draft pull request

Title: `feat: harden Expansion financial and partner operations`

Base for reviewing Phase A.1 in isolation: `feature/operation-expansion` at `f18b1f9`. Review the complete programme against `master` separately before a later integration decision.

## Summary

- Bind new commission receipts to approved invoice allocations and exact milestone limits. Record partial refunds as canonical cash events with separate agreement treatment and a payout review hold.
- Allow eligible prepared payouts to be cancelled with a reason while preserving previous allocation history. Verify invoice amount before preparing and distinguish recorded settlement from bank verification.
- Deny client resources and private feasibility notes in partner projections. Close new activation by default. Restrict applicant insertion privileges to the intake columns.
- Limit applicant retention to previewed eligible closed records. Protect linked and held applicants.

## Evidence

See [final report](FINAL-REPORT.md) for executed checks and outstanding items. Synthetic records and raw evidence stay local in ignored paths. GitHub CI and protected-area review require a separate authorised GitHub write.

## Risk and rollout

The canonical migration planner introduces two forward admin migrations. Review all payment and allocation trigger paths, restore and verify runtime grants, preserve accepted terms and reconcile historical claims. Public intake, new activation and retention execution remain closed by default.

## Rollback

Pause affected financial writes and preserve cash, entitlement, allocation and audit history. A build without partial refund and cancellation support can misinterpret post-migration records. Select a compatible application build or make a reviewed forward correction. See [release runbook](RELEASE-RUNBOOK.md).
