# Client requests and portal messaging

Client-initiated conversation with ScaleSmiths — formal work requests and general portal messages alike — lives in `client_requests` / `client_request_messages` / `client_timeline_events`. A general portal message is a `client_requests` row with `category = "general_support"`: one continuous, non-terminal thread per client, resolved or created on first send (`resolveGeneralMessageThreadId` in `web/src/lib/portal-client-requests.ts`).

## Flow

1. Client sends a message (composer, `web/src/components/portal/PortalMessageComposer.tsx`) → `POST /portal/api/messages` or, on an existing thread, `POST /portal/api/requests/[id]`.
2. The message is stored, the parent request's `updated_at` is bumped, and (for a brand new thread) an opening `client_timeline_events` row is written — all inside one transaction.
3. After commit, ScaleSmiths is notified by email (`sendClientRequestMessageNotification` in `web/src/lib/request-notifications.ts`), best-effort: a delivery failure is recorded on the message row (`notification_email_status`/`notification_email_failure_reason`) but never rolls back or blocks the stored message.
4. Admin opens the thread in `ClientRequestsQueue` (`admin/src/app/(protected)/requests/page.tsx`), which shows every request regardless of category.
5. Admin replies (`POST /api/client-requests/[id]/messages` with `visibility: "client_visible"`) → stored, then the client is notified by email (`sendClientReplyNotification` in `admin/src/lib/server/client-request-notifications.ts`), resolved via `clients.contact_email` joined on `clients.portal_client_id = client_requests.client_id`.
6. The client sees the reply in the portal thread on next load.

## Read state

`client_requests.client_last_read_at` is stamped whenever the portal loads a thread (`GET /portal/api/requests/[id]`, `getPortalGeneralMessageThread`). `client_requests.admin_last_read_at` is stamped when admin selects a request in the queue (`PATCH /api/client-requests/[id]` with `action: "markRead"`). "Unread" is derived client-side by comparing the other party's message timestamps against the viewer's own `*_last_read_at` — no read-receipts table.

## Notification idempotency and auditability

Every `resend.emails.send()` call in this domain passes `idempotencyKey: "client-request-message-" + messageId` (or, for the original request-creation notification which predates per-message keys, `"client-request-message-" + requestId + "-created-admin"/"-created-client"`), matching the convention already established in `admin/src/lib/server/invoice-delivery.ts`. A retried notification attempt for the same message can never double-send. Each message's own `notification_email_status`/`notification_email_failure_reason` columns are the auditable record of what was attempted and what happened.

## Security

- Every read and write is scoped to the authenticated portal session's `clientId` (`getClientSessionFromRequest`) or, on the admin side, an authenticated admin session (`auth()`) — never a client-supplied identifier.
- Subject lines and any other header-bound values are passed through `sanitizeHeaderValue()` (both `web/src/lib/request-notifications.ts` and `admin/src/lib/server/client-request-notifications.ts`), stripping CR/LF/NUL before they can reach a mail header.
- Message bodies render as React text (`{message.body}`), never `dangerouslySetInnerHTML` — XSS-safe by construction.
- `portalRequestMessage` (60/hour, IP + client id) rate-limits every message-sending endpoint.

## Fallback

A `mailto:hello@scalesmiths.co.uk` link is shown in the portal composer only after a `POST /portal/api/messages` attempt fails — never as the default action.
