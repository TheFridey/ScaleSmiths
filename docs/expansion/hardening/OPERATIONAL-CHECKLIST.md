# Expansion operating checks

Before switching release modes, record the approved scope and named operators using [Commercial activation gates](COMMERCIAL-ACTIVATION-GATES.md). Add these checks to the existing ScaleSmiths alert and operations review process. Preserve protected detailed records in the relevant internal system and use aggregate signals for monitoring.

| Signal | Review and response | Proposed owner |
| --- | --- | --- |
| Public 503s or increases in 429s | Check web runtime permissions, database health and origin configuration. Inspect counts and request IDs without submitted fields. | Release operator |
| Invitation failure, expiry and replay | Review aggregate auth errors and founder/security audit. Renew only an eligible expired invitation and review unexplained repeats. | Recruitment owner |
| External-role denials or revoked sessions | Check role and session audit, verify revocation still holds, escalate unexpected pattern to security owner. | Security owner |
| Duplicate/suppression or capacity conflicts | Check the canonical business and allocation in the authorised workspace. Record a founder decision before progressing a disputed case. | Commercial or delivery owner |
| Payment/refund conflicts and pending exceptions | Verify the immutable reference, qualifying net amount, evidence and adjustment policy. Preserve the original and do not submit a fresh reference for the same external event. | Founder finance owner |
| Liability, adjustments and aged payouts | Review ledger entitlement, active allocations, recorded settlements and independent reconciliation evidence. Investigate mismatches before preparing or settling another payout. | Founder finance owner |
| Overdue cases and retention holds | Preview, review exceptions, record authorised hold updates and retain aggregate cleanup outcome. Never log applicant details. | Privacy owner |
| Privilege, journal or migration drift | Stop release preparation, compare expected schema and grants, then use the existing provisioning and forward-migration incident process. | Release operator |
| Recovery evidence expires or fails | Check latest stored bundle and isolated drill. Escalate to recovery owners before approving a production migration. | Recovery operator |

Review configuration and signals during the release observation window, then agree cadence for the pilot. Existing application logs and audit trails support incident triage. Alert routing, owner availability and production thresholds require separate verification. Configure no new external alert destination without approval.
