# Client lifecycle operations

This runbook covers the supported path from an internal client record to an active portal workspace, delivery, finance, and offboarding. It does not authorise direct database edits or bypass domain checks.

## Preconditions

- An authorised admin is signed in with the capability required for the operation.
- Web migrations have run before admin migrations.
- The client record has the correct contact, service status, and explicit `portal_client_id` mapping.
- Resend is configured for invitations and message/invoice notifications. R2 is configured before uploading client documents.

## Provision and activate portal access

1. Open `/portal-users`, select the client record, confirm the portal email, and issue an activation invitation.
2. Record the operation result. A failed email leaves the invited account recoverable; retry with a new operation rather than creating another identity.
3. The client follows the 48-hour single-use link and sets their own password. Do not transmit a password through clipboard, chat, email, or support notes.
4. Confirm the account reaches `active`. Use a reset invitation for recovery; disable the account and revoke outstanding tokens if access must stop immediately.

The client association is the account's authenticated `client_id` joined through `clients.portal_client_id`. Never repair access by matching display name or email to a different client.

## Start and publish delivery

1. Create the delivery project under the client record and assign accountable owners.
2. Add milestones, deliverables, onboarding items, and any required client decisions.
3. Link Forge work only through the project's validated Forge fields. Forge output is evidence/input to delivery; it does not own the client or project lifecycle.
4. Review the client-facing summary, next step, milestone text, staging URL, and resources before publishing the project.
5. Verify internal notes, ownership, audit events, unpublished projects, and internal documents are absent from the portal projection.

## Messages and requests

- Portal messages and requests use the existing client-request thread and timeline records; do not create a parallel messaging store.
- Keep internal notes on the admin-only path. Client replies must use the client-visible reply action.
- On notification failure, retain the database message as authoritative, inspect the recorded failure, and retry delivery without duplicating the message.
- Investigate suspicious volume through the durable rate-limit and audit records; do not disable abuse controls to clear a queue.

## Documents

1. Upload only approved MIME types and filenames, or add a validated HTTPS link.
2. Select the correct client/project/deliverable scope and visibility. Default to internal when approval is unclear.
3. Confirm the checksum, version, storage metadata, and audit record exist.
4. Portal download checks must enforce the authenticated client, a published project, client-visible status, and non-archived state.
5. Archive or supersede metadata instead of replacing historical versions silently. If an R2 operation fails after metadata work, reconcile the object and record deliberately; do not expose the bucket publicly.

## Reports and invoices

- Publish only reviewed monthly reports. Portal reads must use the explicit portal-client mapping.
- Build invoices from the intended client/project, review immutable snapshots and totals, then issue. Drafts may change; issued invoice history must not be rewritten.
- Publish an issued invoice to the portal explicitly and record email delivery attempts. Mark payment, reminders, voids, or later corrections through the audited finance lifecycle.
- Recovery must preserve issued PDFs, snapshots, delivery/access evidence, and invoice numbering. Never use a rollback migration to rewrite financial history.

## Offboarding and recovery

Follow [Client offboarding](client-offboarding.md). At minimum, stop new delivery, resolve or hand over open decisions and requests, preserve contractual/financial records, revoke portal tokens, disable portal access, and apply the approved document/workspace retention policy.

For a suspected cross-client disclosure, disable affected access, preserve audit evidence, follow [Incident response](incident-response.md), and verify ownership filters before re-enabling accounts.

## Release evidence

Before calling the lifecycle release-ready, capture:

- clean web-first/admin-second migration evidence;
- focused activation/reset, RBAC, project publication, messaging, document, report, and invoice tests;
- authenticated browser coverage including negative cross-client cases;
- application builds and repository policy gates;
- production configuration evidence for email, R2, monitoring, backup/restore, and branch protection where applicable.

Repository tests do not prove provider delivery, live database grants, GitHub enforcement, backup recoverability, or production deployment.
