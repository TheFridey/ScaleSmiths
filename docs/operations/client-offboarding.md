# Client offboarding and archive runbook

This runbook controls the end of a ScaleSmiths client relationship. Offboarding means access and active operations are closed and the client record is archived. It is not deletion.

## Safety rules

- Never delete or rewrite issued invoices, payment history, invoice PDFs, publication records or their audit history.
- Never delete, suspend, transfer or redeploy a production website merely because an offboarding case is completed.
- Never remove credentials, hosted assets, staging resources or workspaces without identifying the exact target and recording explicit operator confirmation.
- Treat the checklist evidence as part of the historical audit trail. Do not put passwords, access tokens or other secrets in evidence fields.
- A reactivated client does not automatically regain portal access, services, projects or credentials. Review and enable each separately.

## Operator checklist

1. Open the client record and select **Offboarding**.
2. Review the generated assessment: active portal accounts, services, invoices, projects, requests, future tasks, hosted documents/resources and credential-bearing analytics configurations.
3. Enter the commercial end date, a retention review date, retention notes, and production ownership/handoff notes.
4. Work through every checklist item. Record a decision or evidence reference; do not paste credentials.
5. For outstanding invoices, record the collection, dispute, write-off or payment plan. Offboarding does not infer payment and does not modify invoices.
6. Confirm who owns the production domain, hosting, source repository, analytics, email and third-party accounts. Record handoff and rollback responsibility.
7. Inventory hosted assets and decide whether ScaleSmiths retains, transfers or later deletes each asset under the agreed retention plan.
8. Return or revoke client-supplied access at the provider. Complete the destructive checklist confirmation only after verifying the exact access was removed.
9. Verify staging and Forge resources can be archived. Completion archives linked Forge project records but does not delete generated workspaces or production resources.
10. Disable portal access only after any final client downloads or handoff are complete.
11. Resolve or close open requests and future tasks with client-facing communication where appropriate.
12. When every item is completed or genuinely not applicable, review the final warning and type the exact client confirmation. The completion transaction archives the client and operational state.
13. Confirm the audit log shows completion and that production remains available under the agreed owner.
14. Schedule the retention review outside the application if an organisational calendar reminder is required.

## What completion changes

- Client status becomes `archived` and MRR becomes zero.
- Active service assignments are disabled.
- Stored analytics integration credentials are removed and those integrations are disabled after the credential-removal confirmation.
- Portal accounts are disabled and unused activation/reset tokens are revoked.
- Open client requests are cancelled.
- Incomplete future onboarding tasks become not required.
- Active or paused delivery projects are closed as cancelled and hidden from the portal; staging links are no longer published.
- Linked Forge project records are archived, preventing further generation/deployment activity.

Completion does not delete production sites, Forge workspaces, deployment evidence, client documents, monthly reports, analytics history, invoices or payments.

## Reactivation

Reactivation changes the client record back to `active` and records an audit event. Portal access stays disabled, services stay inactive, and projects stay closed. Re-provision those only after a fresh commercial, security and ownership review.

## GDPR and retention considerations

This section is operational guidance, not legal advice. ScaleSmiths should confirm its retention schedule and lawful bases with an appropriately qualified adviser and apply current UK GDPR, contractual, insurance, tax and accounting requirements.

- Keep only personal data needed for a documented purpose and period.
- Financial and contractual records may require retention even after an erasure request; record the applicable exception rather than deleting them from the operational database.
- Separate legal/financial retention from optional marketing, support content, credentials and hosted working files.
- At the retention review date, decide whether each category should be retained, restricted, anonymised or securely deleted.
- Record erasure/restriction decisions and the systems covered. Backups may follow a separate expiry cycle and should not be silently restored into active use.
- Do not store raw passwords, API keys or recovery codes in the offboarding case or audit metadata.
- For processors and third-party providers, verify deletion or transfer at the provider and retain non-secret evidence of completion.
