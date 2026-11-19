# Applicant privacy and retention

Public application submission requires `PARTNER_APPLICATIONS_ENABLED=true`, an approved `PARTNER_APPLICATION_PRIVACY_VERSION`, and an explicit integer `PARTNER_APPLICATION_RETENTION_DAYS` from 1 to 730. The numeric range is a technical constraint. The UK GDPR storage limitation principle does not prescribe a universal period. Obtain an approved period for each record category before accepting real applications. [ICO storage limitation guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)

| Data | Operational purpose and restraint |
| --- | --- |
| Name and email | Identify the application and contact its author about recruitment. |
| Optional phone and LinkedIn | Alternative contact and commercial background review. Require a documented need before making either mandatory. |
| Region, experience and motivation | Evaluate programme suitability and commercial coverage. |
| Optional business activity, networks and industries | Understand relevant experience. Request categories, never lists of personal contacts. |
| Notice version, timestamps and status | Trace the submitted notice and case progression, and schedule retention review. |
| Founder notes and confirmations | Record business review and onboarding evidence. Keep notes factual and exclude special-category data, identity documents, banking data and unnecessary details. |

The public endpoint inserts applications without exposing application identifiers or permitting reads and lifecycle changes. Intake remains closed on invalid configuration. The privacy acknowledgement binds the submitted notice version and serves as evidence that information was presented. The company must separately approve the lawful basis, notice, sharing, rights handling, and deletion policy.

## Founder review and execution

1. Configure the approved period on the admin service for retention review. It does not change existing application deadlines. Review old deadlines against the approved policy before enabling deletion.
2. In **Partner network → Recruitment → Applicant retention**, run **Preview eligible applications**. Each batch contains at most 100 expired, declined, withdrawn or archived applicants without a linked partner or active hold. Overdue submitted, under-review, approved and onboarding cases need case review. They are outside automated selection.
3. Place a hold for a documented legal review, privacy request or commercial dispute. Record the sensitive case detail in the approved private system. The application stores the hold reason category, responsible founder and timestamp. Release a hold only after confirming its basis has ended.
4. Enable `PARTNER_RETENTION_EXECUTION_ENABLED=true` only after approval of the deletion policy. This enables an explicit founder action. Review the preview references and confirm the batch. A changed batch requires a new preview. Repeating an already applied preview cannot delete the next batch.
5. Confirm the reported count and review the aggregate audit event. Purge events store actor, time and count. Hold events additionally store an internal application reference and reason category. Application content, names and emails are excluded from these event details.

The transaction serialises hold and purge changes and locks candidate rows. Foreign keys prevent deleting held or linked applications. Founder permissions are checked both at the API and against the current identity inside the transaction. No destructive job is scheduled. The founder queue shows the latest 200 applications. Older cases need an approved internal review process until the queue is paginated.

Define a separate policy for linked partner, commercial, finance and audit records, including permitted exceptions and rights request handling. Backup retention and restoration need their own review. A restore may reintroduce subsequently erased application records, so reconcile affected retention decisions before granting restored access. [Production backup and restore](../../operations/backup-and-restore.md)
