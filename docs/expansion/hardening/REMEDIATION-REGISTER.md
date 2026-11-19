# Remediation register

| Items | Change | Release verification |
|---|---|---|
| FIN-01 through FIN-04 | Canonical refunds, clause-gated unpaid adjustments, prepared payout cancellation and invoice allocation approval | Reconcile exact pence across original and extended browser flow, with separate PostgreSQL connections for competing writes |
| FIN-05 through FIN-07 | Canonical contract cancellation and signed pricing checks, invoice amount validation, settlement-reference uniqueness and consistent founder finance read | Verify legacy contract behaviour, original replay and finance snapshots under load |
| SEC-01 through SEC-05 | Resource and private-note isolation, default-closed activation, scoped applicant inserts and suppression lock | Verify negative authorization cases and restore the grant harness on the release candidate |
| OPS-01 and OPS-02 | Terminal-only retention preview and execution with holds, explicit recovery messaging | Verify retention through founder UI and ensure production deletion is separately approved |
| OPS-03 | Transfer tables before linked serial sequences when reprovisioning PostgreSQL after restore | Reprovision a populated isolated restore and run the privilege verifier |

Independent protected-area GitHub review, deployed origin checks, approved accounting instructions and production backup evidence remain release gates. The detailed findings and verification boundaries are in [independent audit](INDEPENDENT-AUDIT.md) and [release runbook](RELEASE-RUNBOOK.md).
