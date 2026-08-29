# Portal Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client portal's mailto-based message composer with a real, PostgreSQL-backed conversation thread, reusing the existing client-request/message/timeline infrastructure end to end (client send → DB → timeline → admin notify → admin reply → DB → client notify → client sees thread).

**Architecture:** Every general portal message is a `client_requests` row with `category = "general_support"` — one continuous thread per client, resolved-or-created on first send. All storage, visibility, rate limiting, and admin-queue UI is the existing `client_requests`/`client_request_messages`/`client_timeline_events` machinery; this plan adds the two missing notification directions (client→admin on any new message, admin→client on reply), read-state tracking, notification idempotency/auditability, and header-injection safety, then swaps the mailto composer for a live composer+thread component.

**Tech Stack:** Next.js App Router (two apps: `web`, `admin`), Drizzle ORM + PostgreSQL, Resend (email), Vitest (unit), Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-08-29-portal-messaging-design.md`

## Global Constraints

- Message body max length: 6000 chars (existing `parseClientRequestMessageBody`) — unchanged, reused.
- DB is the source of truth; a notification failure must never lose or roll back a stored message.
- Every `resend.emails.send()` call must pass `idempotencyKey: "client-request-message-" + messageId`, matching the exact convention already used in `admin/src/lib/server/invoice-delivery.ts` (`"invoice-delivery-" + attempt.id`).
- No `dangerouslySetInnerHTML` anywhere in the new UI — render message bodies as React text, exactly like the existing `PortalRequestThread`.
- Rate limit policy `portalRequestMessage` (60/hour, IP + `session.clientId`) already exists in `web/src/lib/rate-limit-policy.ts` — reuse it, don't redefine it.
- Both `web/src/lib/schema.ts` and `admin/src/lib/schema.ts` must be updated together for any shared-table column change, and a matching migration must exist in both `web/drizzle` and `admin/drizzle` (per `docs/adr/0001-two-nextjs-applications.md`: "shared data models can drift because the apps duplicate some schemas and migration histories").
- Every new migration file must be registered in `scripts/migration-checksums.json` (`forwardMigrations` entry + appended journal entry for its app), or `node scripts/check-migration-history.mjs` fails the build.

---

### Task 1: Schema changes — notification status and read-state columns

**Files:**
- Modify: `web/src/lib/schema.ts` (`clientRequestMessages`, `clientRequests` table definitions, ~line 187-228)
- Modify: `admin/src/lib/schema.ts` (`clientRequests`, `clientRequestMessages` table definitions, ~line 357-398)
- Generate: `web/drizzle/00NN_<generated-name>.sql` (via drizzle-kit)
- Generate: `admin/drizzle/00NN_<generated-name>.sql` (via drizzle-kit)
- Modify: `scripts/migration-checksums.json`

**Interfaces:**
- Produces: `clientRequestMessages.notificationEmailStatus: text | null`, `clientRequestMessages.notificationEmailFailureReason: text | null`, `clientRequests.clientLastReadAt: timestamp | null`, `clientRequests.adminLastReadAt: timestamp | null` — used by every later task.

- [ ] **Step 1: Add the columns to `web/src/lib/schema.ts`**

In the `clientRequestMessages` table (currently ends `updatedAt: timestamp("updated_at", { withTimezone: true }),`), add two columns right after `updatedAt`:

```ts
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  notificationEmailStatus: text("notification_email_status"),
  notificationEmailFailureReason: text("notification_email_failure_reason"),
```

In the `clientRequests` table, add two columns right after `completedAt`:

```ts
  completedAt: timestamp("completed_at", { withTimezone: true }),
  clientLastReadAt: timestamp("client_last_read_at", { withTimezone: true }),
  adminLastReadAt: timestamp("admin_last_read_at", { withTimezone: true }),
```

- [ ] **Step 2: Make the identical change to `admin/src/lib/schema.ts`**

Same two additions, same field names/column names, in admin's copies of `clientRequestMessages` and `clientRequests`.

- [ ] **Step 3: Generate the web migration**

Run (from `web/`): `npm run db:generate`

This reads the schema diff against `web/drizzle/meta/_journal.json`'s last snapshot and writes a new `web/drizzle/00NN_<name>.sql` plus updates the meta snapshot/journal. No live DB connection is required for `generate`. Note the generated filename and the four `ALTER TABLE` statements it produced.

- [ ] **Step 4: Generate the admin migration**

Run (from `admin/`): `npm run db:generate`

Same as Step 3, for `admin/drizzle/`. Note its generated filename.

- [ ] **Step 5: Register both new migrations in `scripts/migration-checksums.json`**

`node scripts/check-migration-history.mjs` requires every `.sql` file under `web/drizzle` or `admin/drizzle` to be registered. Compute each file's checksum (CRLF normalized to LF, sha256) and append entries to `forwardMigrations`, then append matching journal entries to `journals.web.appendedEntries` / `journals.admin.appendedEntries` (copy the `idx`/`version`/`when`/`tag`/`breakpoints` shape straight out of the just-generated `meta/_journal.json` files — `idx` continues from the last existing entry, `tag` is the generated filename without `.sql`).

Compute the checksums with:

```bash
node -e "const fs=require('fs');const crypto=require('crypto');for(const p of process.argv.slice(1)){const c=fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');console.log(p,crypto.createHash('sha256').update(c).digest('hex'))}" web/drizzle/00NN_<web-name>.sql admin/drizzle/00NN_<admin-name>.sql
```

Add to `forwardMigrations` (append, don't reorder existing entries):

```json
{
  "path": "web/drizzle/00NN_<web-name>.sql",
  "sha256": "<computed>",
  "lifecycle": "forward",
  "reason": "Adds per-message notification status and per-request client/admin read-state timestamps to client_request_messages and client_requests."
},
{
  "path": "admin/drizzle/00NN_<admin-name>.sql",
  "sha256": "<computed>",
  "lifecycle": "forward",
  "reason": "Adds per-message notification status and per-request client/admin read-state timestamps to client_request_messages and client_requests."
}
```

Append the corresponding journal entries (read the real `idx`/`when`/`version`/`tag` values out of `web/drizzle/meta/_journal.json` and `admin/drizzle/meta/_journal.json` after Steps 3-4) into `journals.web.appendedEntries` and `journals.admin.appendedEntries` respectively.

- [ ] **Step 6: Verify the manifest**

Run: `node scripts/check-migration-history.mjs`
Expected: `Migration history integrity passed: ... historical and ... forward migrations are locked.`

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/schema.ts admin/src/lib/schema.ts web/drizzle admin/drizzle scripts/migration-checksums.json
git commit -m "feat: add notification status and read-state columns for portal messaging"
```

---

### Task 2: Header-injection sanitizer + notification idempotency in the web notifier

**Files:**
- Modify: `web/src/lib/request-notifications.ts`
- Test: `web/src/lib/request-notifications.test.ts` (new)

**Interfaces:**
- Produces: `sanitizeHeaderValue(value: string): string`, exported from `request-notifications.ts`. Existing exports (`sendClientRequestNotifications`, `buildAdminRequestSubject`, `buildClientConfirmationSubject`) keep their signatures.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

Create `web/src/lib/request-notifications.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildAdminRequestSubject, sanitizeHeaderValue } from "./request-notifications"

describe("sanitizeHeaderValue", () => {
  it("strips CR, LF, and NUL from a header-bound value", () => {
    expect(sanitizeHeaderValue("Hello\r\nBcc: attacker@example.com")).toBe("HelloBcc: attacker@example.com")
    expect(sanitizeHeaderValue("line1\nline2")).toBe("line1line2")
    expect(sanitizeHeaderValue("a\0b")).toBe("ab")
  })

  it("leaves an ordinary value untouched", () => {
    expect(sanitizeHeaderValue("Homepage content change")).toBe("Homepage content change")
  })
})

describe("buildAdminRequestSubject", () => {
  it("never contains a newline even when the title does", () => {
    const subject = buildAdminRequestSubject({
      requestId: 1,
      clientId: "client-one",
      clientName: "Client One",
      title: "Change this\r\nX-Injected: true",
      category: "general_support",
      priority: "medium",
    })
    expect(subject).not.toMatch(/[\r\n]/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `web/`): `npx vitest run src/lib/request-notifications.test.ts`
Expected: FAIL — `sanitizeHeaderValue` is not exported.

- [ ] **Step 3: Implement `sanitizeHeaderValue` and apply it**

In `web/src/lib/request-notifications.ts`, add near the other small helpers (after `escapeHtml`):

```ts
export function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n\0]/g, "")
}
```

Update `buildAdminRequestSubject` and `buildClientConfirmationSubject` to sanitize the title before it reaches the subject line:

```ts
export function buildAdminRequestSubject(input: ClientRequestNotificationInput) {
  const critical = isCriticalClientRequest(input.category, input.priority)
  return `${critical ? "[CRITICAL] " : ""}Client request: ${sanitizeHeaderValue(input.title)}`.slice(0, 180)
}

export function buildClientConfirmationSubject(input: ClientRequestNotificationInput) {
  const critical = isCriticalClientRequest(input.category, input.priority)
  return `${critical ? "Urgent request received" : "Request received"} - ${sanitizeHeaderValue(input.title)}`.slice(0, 180)
}
```

Add `idempotencyKey` to both `resend.emails.send()` calls inside `sendClientRequestNotifications`:

```ts
  const messages = [
    resend.emails.send({
      from: config.from,
      to: config.supportEmail,
      replyTo: input.clientEmail ?? undefined,
      subject: buildAdminRequestSubject(input),
      html: buildAdminEmailHtml(input, adminLink),
      text: buildAdminEmailText(input, adminLink),
    }, { idempotencyKey: `client-request-message-${input.requestId}-created-admin` }),
  ]

  if (input.clientEmail) {
    messages.push(resend.emails.send({
      from: config.from,
      to: input.clientEmail,
      subject: buildClientConfirmationSubject(input),
      html: buildClientConfirmationHtml(input),
      text: buildClientConfirmationText(input),
    }, { idempotencyKey: `client-request-message-${input.requestId}-created-client` }))
  }
```

(This function fires only on request creation, where there is one client-visible message — the opening description — so the key is anchored to the request id with a fixed suffix rather than a message id.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/request-notifications.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/request-notifications.ts web/src/lib/request-notifications.test.ts
git commit -m "fix: sanitize email header values and add notification idempotency keys"
```

---

### Task 3: Message-level notification builder (client → admin, for replies on any thread)

**Files:**
- Modify: `web/src/lib/request-notifications.ts`
- Modify: `web/src/lib/request-notifications.test.ts`

**Interfaces:**
- Consumes: `resolveRequestNotificationConfig`, `escapeHtml`, `sanitizeHeaderValue` (all already in this file).
- Produces: `sendClientRequestMessageNotification(input: ClientRequestMessageNotificationInput, env?): Promise<ClientRequestNotificationResult>`, `ClientRequestMessageNotificationInput` type — consumed by Task 5 and Task 6.

```ts
export interface ClientRequestMessageNotificationInput {
  requestId: number
  messageId: number
  correlationId?: string
  actorId?: string
  clientId: string
  clientName: string
  requestTitle: string
  messageBody: string
}
```

- [ ] **Step 1: Write the failing test**

Update the top of `web/src/lib/request-notifications.test.ts` to also import `sendClientRequestMessageNotification`:

```ts
import { buildAdminRequestSubject, sanitizeHeaderValue, sendClientRequestMessageNotification } from "./request-notifications"
```

Append to the file:

```ts
describe("sendClientRequestMessageNotification", () => {
  it("returns a configuration failure without throwing when Resend env vars are missing", async () => {
    const result = await sendClientRequestMessageNotification(
      {
        requestId: 1,
        messageId: 42,
        clientId: "client-one",
        clientName: "Client One",
        requestTitle: "Portal messages",
        messageBody: "Hello",
      },
      {} as NodeJS.ProcessEnv,
    )
    expect(result).toEqual({ ok: false, reason: "configuration", status: "failed", failureReason: "configuration" })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/request-notifications.test.ts`
Expected: FAIL — `sendClientRequestMessageNotification` is not exported.

- [ ] **Step 3: Implement it**

Add to `web/src/lib/request-notifications.ts`, after `sendClientRequestNotifications`:

```ts
export async function sendClientRequestMessageNotification(
  input: ClientRequestMessageNotificationInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ClientRequestNotificationResult> {
  const config = resolveRequestNotificationConfig(env)

  if (!config.apiKey || !config.from || !config.supportEmail) {
    warnRequestNotification("configuration", input.requestId)
    captureWebMessage("Client request message email configuration is incomplete", "warning", { correlationId: input.correlationId, actorId: input.actorId, clientRequestId: input.requestId, emailOperation: "client_request_message_notification", errorCategory: "email_configuration" })
    return { ok: false, reason: "configuration", status: "failed", failureReason: "configuration" }
  }

  const resend = new Resend(config.apiKey)
  const adminLink = buildAdminRequestLink(input.requestId, env)
  const subject = `New client message: ${sanitizeHeaderValue(input.requestTitle)}`.slice(0, 180)

  try {
    const result = await resend.emails.send({
      from: config.from,
      to: config.supportEmail,
      subject,
      html: buildMessageNotificationHtml(input, adminLink),
      text: buildMessageNotificationText(input, adminLink),
    }, { idempotencyKey: `client-request-message-${input.messageId}` })

    if (result.error) {
      warnRequestNotification("delivery", input.requestId)
      captureWebMessage("Client request message email provider returned a delivery error", "error", { correlationId: input.correlationId, actorId: input.actorId, clientRequestId: input.requestId, emailOperation: "client_request_message_notification", errorCategory: "email_delivery" })
      return { ok: false, reason: "delivery", status: "failed", failureReason: "delivery" }
    }
  } catch (error) {
    warnRequestNotification("delivery", input.requestId)
    captureWebException(error, { correlationId: input.correlationId, actorId: input.actorId, clientRequestId: input.requestId, emailOperation: "client_request_message_notification", errorCategory: "email_delivery" })
    return { ok: false, reason: "delivery", status: "failed", failureReason: "delivery" }
  }

  return { ok: true, status: "sent" }
}

function buildMessageNotificationHtml(input: ClientRequestMessageNotificationInput, adminLink: string | null) {
  return `
    <div style="background:#080808;padding:28px;font-family:Arial,sans-serif;">
      <div style="max-width:680px;margin:0 auto;background:#0f0f0f;border:1px solid #242424;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 26px;border-bottom:1px solid #242424;">
          <div style="color:#2563eb;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">New client message</div>
          <h1 style="color:#f4f4f4;margin:8px 0 0;font-size:24px;">${escapeHtml(input.requestTitle)}</h1>
        </div>
        <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
          ${field("Client", input.clientName)}
          ${field("Client ID", input.clientId)}
          ${field("Message", input.messageBody)}
          ${field("Admin link", adminLink ?? "Not configured")}
        </table>
      </div>
    </div>
  `
}

function buildMessageNotificationText(input: ClientRequestMessageNotificationInput, adminLink: string | null) {
  return [
    "New client message",
    `Client: ${input.clientName}`,
    `Client ID: ${input.clientId}`,
    `Thread: ${input.requestTitle}`,
    `Message: ${input.messageBody}`,
    `Admin link: ${adminLink ?? "Not configured"}`,
  ].join("\n")
}
```

Add the `ClientRequestMessageNotificationInput` interface near the top of the file, next to `ClientRequestNotificationInput`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/request-notifications.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/request-notifications.ts web/src/lib/request-notifications.test.ts
git commit -m "feat: add client-message notification builder for admin"
```

---

### Task 4: Shared message-append helper and resolve-or-create thread logic

**Files:**
- Modify: `web/src/lib/portal-client-requests.ts`
- Modify: `web/src/lib/client-requests.ts` (adds the pure `isTerminalRequestStatus`/`TERMINAL_REQUEST_STATUSES`, since that file has no `server-only` import and can be safely real-imported by a unit test — see Step 3)
- Test: `web/src/lib/portal-client-requests.test.ts` (new)

**Interfaces:**
- Produces:
  - `appendClientMessage(portalClientId: string, requestId: number, body: string, now?: Date): Promise<{ message: ClientPortalRequestMessage; requestTitle: string } | null>` — inserts a client-authored message + bumps `updatedAt`; returns `null` if the request doesn't belong to `portalClientId`. Used by Task 5 and Task 6.
  - `resolveGeneralMessageThreadId(portalClientId: string, now?: Date): Promise<{ requestId: number; created: boolean }>` — finds the client's latest non-terminal `general_support` request, or creates one (plus its opening timeline event) in a transaction. Used by Task 6.
  - `isTerminalRequestStatus(status: ClientRequestStatus): boolean` and `TERMINAL_REQUEST_STATUSES` (in `client-requests.ts`, not `portal-client-requests.ts` — pure, exported for the unit test) — true for `"completed"`/`"cancelled"`. Re-imported into `portal-client-requests.ts` for use in `resolveGeneralMessageThreadId` and Task 6's `getPortalGeneralMessageThread`.
- Consumes: `clientRequests`, `clientRequestMessages`, `clientTimelineEvents` from `@/lib/schema`; `serializeClientPortalMessage` from `@/lib/client-requests`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/portal-client-requests.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { isTerminalRequestStatus } from "./client-requests"

describe("isTerminalRequestStatus", () => {
  it("treats completed and cancelled as terminal", () => {
    expect(isTerminalRequestStatus("completed")).toBe(true)
    expect(isTerminalRequestStatus("cancelled")).toBe(true)
  })

  it("treats every other status as non-terminal", () => {
    expect(isTerminalRequestStatus("new")).toBe(false)
    expect(isTerminalRequestStatus("triaged")).toBe(false)
    expect(isTerminalRequestStatus("in_progress")).toBe(false)
    expect(isTerminalRequestStatus("waiting_client")).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `web/`): `npx vitest run src/lib/portal-client-requests.test.ts`
Expected: FAIL — `isTerminalRequestStatus` is not exported.

- [ ] **Step 3: Implement the helpers**

`isTerminalRequestStatus` is pure logic with no DB access — it belongs in `web/src/lib/client-requests.ts` (which has no `server-only` import), not in `portal-client-requests.ts` (which starts with `import "server-only"` and therefore can never be safely real-imported by a unit test — Vitest has no Next.js bundler to provide that package, and this codebase's own convention, visible in `portal-project-boundaries.test.ts`/`portal-invoices.test.ts`, is to only ever `readFileSync`-scan server-only files in tests, never import them directly). Keeping the pure predicate in `client-requests.ts` alongside its existing `isClientRequestStatus`/`isClientRequestCategory` guards lets Step 1's test import it safely, matching the pattern `admin/src/lib/delivery-projects.ts` (pure logic, real-imported by `delivery-projects.test.ts`) vs. `admin/src/lib/server/delivery-project-service.ts` (server-only, DB-touching, never real-imported by a test) already established on the admin side.

In `web/src/lib/client-requests.ts`, add near the other status guards (e.g. after `isClientRequestStatus`):

```ts
export const TERMINAL_REQUEST_STATUSES: ClientRequestStatus[] = ["completed", "cancelled"]

export function isTerminalRequestStatus(status: ClientRequestStatus): boolean {
  return TERMINAL_REQUEST_STATUSES.includes(status)
}
```

In `web/src/lib/portal-client-requests.ts`, add imports for what's not already there and the new exports:

```ts
import "server-only"

import { and, asc, desc, eq, notInArray } from "drizzle-orm"
import { serializeClientPortalMessage, serializeClientPortalRequest, TERMINAL_REQUEST_STATUSES, type ClientRequestStatus } from "@/lib/client-requests"
import { serializeClientPortalTimelineEvent } from "@/lib/client-timeline"
import { db } from "@/lib/db"
import { clientRequestMessages, clientRequests, clientTimelineEvents } from "@/lib/schema"

// ...existing listRecentPortalThreadMessages, getPortalRequestThread...

export async function resolveGeneralMessageThreadId(portalClientId: string, now = new Date()): Promise<{ requestId: number; created: boolean }> {
  const [existing] = await db
    .select({ id: clientRequests.id })
    .from(clientRequests)
    .where(and(
      eq(clientRequests.clientId, portalClientId),
      eq(clientRequests.category, "general_support"),
      notInArray(clientRequests.status, TERMINAL_REQUEST_STATUSES),
    ))
    .orderBy(desc(clientRequests.createdAt))
    .limit(1)

  if (existing) return { requestId: existing.id, created: false }

  const requestId = await db.transaction(async (tx) => {
    const [requestRow] = await tx
      .insert(clientRequests)
      .values({
        clientId: portalClientId,
        title: "Portal messages",
        description: "Direct messages between this client and ScaleSmiths.",
        category: "general_support",
        priority: "medium",
        status: "new",
        updatedAt: now,
        createdAt: now,
      })
      .returning({ id: clientRequests.id })

    await tx.insert(clientTimelineEvents).values({
      clientId: portalClientId,
      requestId: requestRow.id,
      type: "messages_thread_opened",
      title: "Message thread started",
      description: "A new message thread was started in the ScaleSmiths portal.",
      visibility: "client_visible",
      createdBy: "Client",
      createdAt: now,
    })

    return requestRow.id
  })

  return { requestId, created: true }
}

export async function appendClientMessage(portalClientId: string, requestId: number, body: string, now = new Date()) {
  const [existing] = await db
    .select({ id: clientRequests.id, title: clientRequests.title })
    .from(clientRequests)
    .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId)))
    .limit(1)

  if (!existing) return null

  const [inserted] = await db.transaction(async (tx) => {
    const message = await tx
      .insert(clientRequestMessages)
      .values({
        requestId: existing.id,
        senderType: "client",
        senderName: "Client",
        body,
        visibility: "client_visible",
        createdAt: now,
      })
      .returning()

    await tx.update(clientRequests).set({ updatedAt: now }).where(eq(clientRequests.id, existing.id))

    return message
  })

  const serialized = serializeClientPortalMessage(inserted)
  if (!serialized) return null

  return { message: serialized, requestTitle: existing.title }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/portal-client-requests.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/portal-client-requests.ts web/src/lib/portal-client-requests.test.ts
git commit -m "feat: add resolve-or-create general thread and shared message-append helper"
```

---

### Task 5: Wire rate limiting, notification, and read-state into the existing per-request endpoint

**Files:**
- Modify: `web/src/app/portal/api/requests/[id]/route.ts`

**Interfaces:**
- Consumes: `appendClientMessage` (Task 4), `sendClientRequestMessageNotification` (Task 3), `checkWebRateLimit`/`webRateLimitKeys`/`rateLimitHeaders` (existing), `getPortalRequestThread` (existing).

- [ ] **Step 1: Add the rate limit check to POST, before any DB write**

In `web/src/app/portal/api/requests/[id]/route.ts`, add imports:

```ts
import { resolveClientIp } from "@/lib/client-ip"
import { rateLimitHeaders, webRateLimitKeys } from "@/lib/rate-limit-policy"
import { checkWebRateLimit } from "@/lib/server/rate-limit"
import { appendClientMessage } from "@/lib/portal-client-requests"
import { sendClientRequestMessageNotification } from "@/lib/request-notifications"
import { loadPortalClientProfile } from "@/lib/portal-client-profile"
```

Right after the existing `parseClientRequestMessageBody` check in `POST` (before the `try` block that does the DB lookup), add:

```ts
  const decision = await checkWebRateLimit(
    "portalRequestMessage",
    webRateLimitKeys("portalRequestMessage", resolveClientIp(request.headers), session.clientId),
  )
  if (!decision.ok) {
    return NextResponse.json(
      { error: "Too many messages sent. Please wait before sending another." },
      { status: 429, headers: rateLimitHeaders(decision) },
    )
  }
```

- [ ] **Step 2: Replace the inline insert with the shared helper and add best-effort notification**

Replace the existing `try { ... } catch { ... }` body of `POST` with:

```ts
  try {
    const result = await appendClientMessage(session.clientId, id, parsed.data)
    if (!result) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 })
    }

    try {
      const profile = await loadPortalClientProfile(session.clientId)
      const notificationResult = await sendClientRequestMessageNotification({
        requestId: id,
        messageId: result.message.id,
        correlationId: request.headers.get("x-request-id") ?? undefined,
        actorId: session.clientId,
        clientId: session.clientId,
        clientName: profile?.companyName ?? "Client workspace",
        requestTitle: result.requestTitle,
        messageBody: result.message.body,
      })
      await db.update(clientRequestMessages).set({
        notificationEmailStatus: notificationResult.status,
        notificationEmailFailureReason: notificationResult.failureReason ?? null,
      }).where(eq(clientRequestMessages.id, result.message.id))
    } catch {
      console.warn("[request-notifications] unexpected warning on message reply. Message was not lost.")
      await db.update(clientRequestMessages).set({
        notificationEmailStatus: "failed",
        notificationEmailFailureReason: "delivery",
      }).where(eq(clientRequestMessages.id, result.message.id)).catch(() => undefined)
    }

    return NextResponse.json({ ok: true, message: result.message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unable to send message right now." }, { status: 500 })
  }
```

(`parseClientRequestMessageBody` stays imported and used exactly as before, for validating the incoming body. `clientRequestMessages` and `clientRequests` are already imported from `@/lib/schema` in this file and are now also used directly for the notification-status update and read-state stamp — no import changes needed for them.)

- [ ] **Step 3: Stamp `client_last_read_at` in GET**

In the `GET` handler, right before `return NextResponse.json({ ok: true, ...thread })`, add:

```ts
    await db.update(clientRequests)
      .set({ clientLastReadAt: new Date() })
      .where(and(eq(clientRequests.id, id), eq(clientRequests.clientId, session.clientId)))
```

(`and` is already imported in this file from `drizzle-orm`.)

- [ ] **Step 4: Manually verify the file compiles**

Run (from `web/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in `src/app/portal/api/requests/[id]/route.ts`.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/portal/api/requests/[id]/route.ts
git commit -m "feat: rate-limit, notify, and stamp read-state on portal request replies"
```

---

### Task 6: New `POST /portal/api/messages` endpoint

**Files:**
- Create: `web/src/app/portal/api/messages/route.ts`
- Modify: `web/src/lib/portal-client-requests.ts` (one more export)
- Test: `web/src/lib/portal-messages-boundary.test.ts` (new — source-scan convention, matching `portal-project-boundaries.test.ts`)

**Interfaces:**
- Consumes: `resolveGeneralMessageThreadId`, `appendClientMessage` (Task 4), `sendClientRequestMessageNotification` (Task 3), `getPortalRequestThread` (existing) — extended below to also expose read-state.
- Produces: `getPortalGeneralMessageThread(portalClientId: string): Promise<{ request: ClientPortalRequest; messages: ClientPortalRequestMessage[] } | null>` — the client's current general thread if one exists, for the Messages tab (Task 9).

- [ ] **Step 1: Add `getPortalGeneralMessageThread` to `portal-client-requests.ts`**

```ts
export async function getPortalGeneralMessageThread(portalClientId: string) {
  const [existing] = await db
    .select({ id: clientRequests.id })
    .from(clientRequests)
    .where(and(
      eq(clientRequests.clientId, portalClientId),
      eq(clientRequests.category, "general_support"),
      notInArray(clientRequests.status, TERMINAL_REQUEST_STATUSES),
    ))
    .orderBy(desc(clientRequests.createdAt))
    .limit(1)

  if (!existing) return null

  const thread = await getPortalRequestThread(portalClientId, existing.id)
  if (!thread) return null

  await db.update(clientRequests)
    .set({ clientLastReadAt: new Date() })
    .where(and(eq(clientRequests.id, existing.id), eq(clientRequests.clientId, portalClientId)))

  return { request: thread.request, messages: thread.messages }
}
```

- [ ] **Step 2: Write the failing boundary test**

Create `web/src/lib/portal-messages-boundary.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("portal messages boundary", () => {
  const route = readFileSync(new URL("../app/portal/api/messages/route.ts", import.meta.url), "utf8")

  it("requires an authenticated portal session before writing anything", () => {
    expect(route).toContain("getClientSessionFromRequest")
    expect(route).toContain("unauthorizedClientPortalResponse")
  })

  it("scopes the thread to the authenticated session's client id, never a request-supplied one", () => {
    expect(route).toContain("resolveGeneralMessageThreadId(session.clientId")
    expect(route).toContain("appendClientMessage(session.clientId")
  })

  it("rate-limits before writing", () => {
    expect(route).toContain("checkWebRateLimit")
    expect(route).toContain("portalRequestMessage")
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `web/`): `npx vitest run src/lib/portal-messages-boundary.test.ts`
Expected: FAIL — the route file doesn't exist yet.

- [ ] **Step 4: Implement the route**

Create `web/src/app/portal/api/messages/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { parseClientRequestMessageBody } from "@/lib/client-requests"
import { getClientSessionFromRequest, unauthorizedClientPortalResponse } from "@/lib/portal-session"
import { appendClientMessage, resolveGeneralMessageThreadId } from "@/lib/portal-client-requests"
import { loadPortalClientProfile } from "@/lib/portal-client-profile"
import { sendClientRequestMessageNotification } from "@/lib/request-notifications"
import { resolveClientIp } from "@/lib/client-ip"
import { rateLimitHeaders, webRateLimitKeys } from "@/lib/rate-limit-policy"
import { checkWebRateLimit } from "@/lib/server/rate-limit"
import { clientRequestMessages } from "@/lib/schema"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await getClientSessionFromRequest(request)

  if (!session) {
    return unauthorizedClientPortalResponse(request)
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid message payload." }, { status: 400 })
  }

  const parsed = parseClientRequestMessageBody((body as Record<string, unknown>).body)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const decision = await checkWebRateLimit(
    "portalRequestMessage",
    webRateLimitKeys("portalRequestMessage", resolveClientIp(request.headers), session.clientId),
  )
  if (!decision.ok) {
    return NextResponse.json(
      { error: "Too many messages sent. Please wait before sending another." },
      { status: 429, headers: rateLimitHeaders(decision) },
    )
  }

  try {
    const { requestId } = await resolveGeneralMessageThreadId(session.clientId)
    const result = await appendClientMessage(session.clientId, requestId, parsed.data)

    if (!result) {
      return NextResponse.json({ error: "Unable to send message right now." }, { status: 500 })
    }

    try {
      const profile = await loadPortalClientProfile(session.clientId)
      const notificationResult = await sendClientRequestMessageNotification({
        requestId,
        messageId: result.message.id,
        correlationId: request.headers.get("x-request-id") ?? undefined,
        actorId: session.clientId,
        clientId: session.clientId,
        clientName: profile?.companyName ?? "Client workspace",
        requestTitle: result.requestTitle,
        messageBody: result.message.body,
      })
      await db.update(clientRequestMessages).set({
        notificationEmailStatus: notificationResult.status,
        notificationEmailFailureReason: notificationResult.failureReason ?? null,
      }).where(eq(clientRequestMessages.id, result.message.id))
    } catch {
      console.warn("[request-notifications] unexpected warning on new portal message. Message was not lost.")
      await db.update(clientRequestMessages).set({
        notificationEmailStatus: "failed",
        notificationEmailFailureReason: "delivery",
      }).where(eq(clientRequestMessages.id, result.message.id)).catch(() => undefined)
    }

    return NextResponse.json({ ok: true, requestId, message: result.message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unable to send message right now." }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib/portal-messages-boundary.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add web/src/app/portal/api/messages/route.ts web/src/lib/portal-client-requests.ts web/src/lib/portal-messages-boundary.test.ts
git commit -m "feat: add POST /portal/api/messages for the general message thread"
```

---

### Task 7: Admin notification module (admin reply → client)

**Files:**
- Create: `admin/src/lib/server/client-request-notifications.ts`
- Test: `admin/src/lib/server/client-request-notifications.test.ts` (new)

**Interfaces:**
- Produces: `sendClientReplyNotification(input: ClientReplyNotificationInput, env?): Promise<{ ok: boolean; status: "sent" | "failed"; failureReason?: "configuration" | "delivery" | "no_email" }>`.

```ts
export interface ClientReplyNotificationInput {
  requestId: number
  messageId: number
  portalClientId: string
  requestTitle: string
  messageBody: string
  clientEmail: string | null
}
```

- [ ] **Step 1: Write the failing tests**

Create `admin/src/lib/server/client-request-notifications.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { sendClientReplyNotification, sanitizeHeaderValue } from "./client-request-notifications"

describe("sanitizeHeaderValue", () => {
  it("strips CR/LF/NUL", () => {
    expect(sanitizeHeaderValue("a\r\nb\0c")).toBe("abc")
  })
})

describe("sendClientReplyNotification", () => {
  it("skips sending and reports no_email when the client has no address on file", async () => {
    const result = await sendClientReplyNotification(
      { requestId: 1, messageId: 2, portalClientId: "client-one", requestTitle: "Portal messages", messageBody: "Hi", clientEmail: null },
      { RESEND_API_KEY: "key", RESEND_FROM: "noreply@scalesmiths.co.uk" } as NodeJS.ProcessEnv,
    )
    expect(result).toEqual({ ok: false, status: "failed", failureReason: "no_email" })
  })

  it("reports a configuration failure without throwing when Resend env vars are missing", async () => {
    const result = await sendClientReplyNotification(
      { requestId: 1, messageId: 2, portalClientId: "client-one", requestTitle: "Portal messages", messageBody: "Hi", clientEmail: "client@example.com" },
      {} as NodeJS.ProcessEnv,
    )
    expect(result).toEqual({ ok: false, status: "failed", failureReason: "configuration" })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `admin/`): `npx vitest run src/lib/server/client-request-notifications.test.ts`
Expected: FAIL — the module doesn't exist yet.

- [ ] **Step 3: Implement the module**

Create `admin/src/lib/server/client-request-notifications.ts`:

```ts
import "server-only"
import { Resend } from "resend"

export interface ClientReplyNotificationInput {
  requestId: number
  messageId: number
  portalClientId: string
  requestTitle: string
  messageBody: string
  clientEmail: string | null
}

export interface ClientReplyNotificationResult {
  ok: boolean
  status: "sent" | "failed"
  failureReason?: "configuration" | "delivery" | "no_email"
}

export function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n\0]/g, "")
}

function resolveConfig(env: NodeJS.ProcessEnv) {
  return {
    apiKey: env.RESEND_API_KEY?.trim() || null,
    from: env.RESEND_FROM?.trim() || null,
    portalUrl: env.NEXT_PUBLIC_PORTAL_URL?.trim().replace(/\/+$/, "") || null,
  }
}

export async function sendClientReplyNotification(
  input: ClientReplyNotificationInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ClientReplyNotificationResult> {
  if (!input.clientEmail) {
    return { ok: false, status: "failed", failureReason: "no_email" }
  }

  const config = resolveConfig(env)
  if (!config.apiKey || !config.from) {
    console.warn(`[client-request-notifications] configuration warning for message ${input.messageId}. Reply was not lost.`)
    return { ok: false, status: "failed", failureReason: "configuration" }
  }

  const resend = new Resend(config.apiKey)
  const portalLink = config.portalUrl ? `${config.portalUrl}/portal/${input.portalClientId}?tab=messages` : null
  const subject = `ScaleSmiths replied: ${sanitizeHeaderValue(input.requestTitle)}`.slice(0, 180)

  try {
    const result = await resend.emails.send({
      from: config.from,
      to: input.clientEmail,
      subject,
      html: buildHtml(input, portalLink),
      text: buildText(input, portalLink),
    }, { idempotencyKey: `client-request-message-${input.messageId}` })

    if (result.error) {
      console.warn(`[client-request-notifications] delivery warning for message ${input.messageId}. Reply was not lost.`)
      return { ok: false, status: "failed", failureReason: "delivery" }
    }
  } catch {
    console.warn(`[client-request-notifications] delivery warning for message ${input.messageId}. Reply was not lost.`)
    return { ok: false, status: "failed", failureReason: "delivery" }
  }

  return { ok: true, status: "sent" }
}

function buildHtml(input: ClientReplyNotificationInput, portalLink: string | null) {
  return `
    <div style="background:#080808;padding:28px;font-family:Arial,sans-serif;color:#f4f4f4;">
      <div style="max-width:620px;margin:0 auto;background:#0f0f0f;border:1px solid #242424;border-radius:16px;padding:30px;">
        <div style="color:#2563eb;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">ScaleSmiths</div>
        <h1 style="font-size:26px;line-height:1.1;margin:12px 0 16px;">New reply on your thread.</h1>
        <p style="color:#b6b6b6;font-size:15px;line-height:1.65;margin:0 0 16px;">${escapeHtml(input.messageBody)}</p>
        ${portalLink ? `<p style="margin:0;"><a href="${escapeHtml(portalLink)}" style="color:#60a5fa;">Open your portal</a></p>` : ""}
      </div>
    </div>
  `
}

function buildText(input: ClientReplyNotificationInput, portalLink: string | null) {
  return [
    "New reply on your thread.",
    input.messageBody,
    portalLink ? `Open your portal: ${portalLink}` : "",
  ].filter(Boolean).join("\n")
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/server/client-request-notifications.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add admin/src/lib/server/client-request-notifications.ts admin/src/lib/server/client-request-notifications.test.ts
git commit -m "feat: add client-facing reply notification module to admin"
```

---

### Task 8: Wire admin reply notification and read-state into existing admin routes

**Files:**
- Modify: `admin/src/app/api/client-requests/[id]/messages/route.ts`
- Modify: `admin/src/app/api/client-requests/[id]/route.ts`

**Interfaces:**
- Consumes: `sendClientReplyNotification` (Task 7), `clients` table (already in admin schema) for `contactEmail` lookup.

- [ ] **Step 1: Add the client-notification call to the admin messages route**

In `admin/src/app/api/client-requests/[id]/messages/route.ts`, add imports:

```ts
import { clientRequestMessages, clientRequests, clientTimelineEvents, clients } from "@/lib/schema"
import { sendClientReplyNotification } from "@/lib/server/client-request-notifications"
```

(`clients` replaces the previous `clientRequestMessages, clientRequests, clientTimelineEvents`-only import list.)

After the existing `db.transaction(...)` block that inserts the message and before the final `return NextResponse.json(...)`, add:

```ts
  if (visibility === "client_visible") {
    try {
      const [clientRow] = await db
        .select({ contactEmail: clients.contactEmail })
        .from(clients)
        .where(eq(clients.portalClientId, existing.clientId))
        .limit(1)

      const notificationResult = await sendClientReplyNotification({
        requestId: existing.id,
        messageId: message.id,
        portalClientId: existing.clientId,
        requestTitle: existing.title,
        messageBody: parsedBody.data,
        clientEmail: clientRow?.contactEmail ?? null,
      })

      await db.update(clientRequestMessages).set({
        notificationEmailStatus: notificationResult.status,
        notificationEmailFailureReason: notificationResult.failureReason ?? null,
      }).where(eq(clientRequestMessages.id, message.id))
    } catch {
      console.warn("[client-request-notifications] unexpected warning on admin reply. Reply was not lost.")
      await db.update(clientRequestMessages).set({
        notificationEmailStatus: "failed",
        notificationEmailFailureReason: "delivery",
      }).where(eq(clientRequestMessages.id, message.id)).catch(() => undefined)
    }
  }
```

- [ ] **Step 2: Add a `markRead` action to the request PATCH route**

In `admin/src/app/api/client-requests/[id]/route.ts`, in the `action` branch chain (after the `else if (action === "reopen")` block), add:

```ts
  } else if (action === "markRead") {
    updates.adminLastReadAt = now
  } else if (action !== "update") {
```

(This replaces the existing `} else if (action !== "update") {` line — the new branch goes immediately before it.)

`markRead` alone would make `Object.keys(updates).length === 2` (`updatedAt` + `adminLastReadAt`), so it already passes the existing "no updates supplied" guard further down without changes.

- [ ] **Step 3: Verify both files compile**

Run (from `admin/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors in either modified route file.

- [ ] **Step 4: Commit**

```bash
git add admin/src/app/api/client-requests/[id]/messages/route.ts admin/src/app/api/client-requests/[id]/route.ts
git commit -m "feat: notify client on admin reply and add admin read-state marking"
```

---

### Task 9: Portal UI — replace the mailto composer, wire the Messages tab

**Files:**
- Modify: `web/src/components/portal/PortalMessageComposer.tsx` (full rewrite)
- Modify: `web/src/app/portal/[clientId]/page.tsx` (`MessagesTab`)
- Modify: `web/src/lib/client-requests.ts` (expose read-state on the DTO)

**Interfaces:**
- Consumes: `POST /portal/api/messages` (Task 6), `getPortalGeneralMessageThread` (Task 6), existing `ClientPortalRequest`/`ClientPortalRequestMessage` types.

- [ ] **Step 1: Expose `clientLastReadAt`/read-derived unread flag on the portal request DTO**

In `web/src/lib/client-requests.ts`, extend `ClientPortalRequest` and `serializeClientPortalRequest`:

```ts
export interface ClientPortalRequest {
  id: number
  title: string
  description: string
  category: ClientRequestCategory
  priority: ClientRequestPriority
  status: ClientRequestStatus
  affectedUrl: string | null
  createdAt: Date
  updatedAt: Date
  clientLastReadAt: Date | null
}
```

```ts
export function serializeClientPortalRequest(input: ClientPortalRequestWithPossibleAdminFields): ClientPortalRequest {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    status: input.status,
    affectedUrl: input.affectedUrl,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    clientLastReadAt: (input as { clientLastReadAt?: Date | null }).clientLastReadAt ?? null,
  }
}
```

Also add `clientLastReadAt: unknown` to `ClientPortalRequestWithPossibleAdminFields`'s partial-fields type so admin call sites (which don't select it) still type-check.

This adds a field to `serializeClientPortalRequest`'s output, which breaks the existing exact-shape assertion in `web/src/lib/client-requests.test.ts` (`"serializes only fields that are safe for the client portal"`, currently asserting `toEqual` against a 9-key object with no `clientLastReadAt`). Update that test's expected object to include `clientLastReadAt: null` (the input literal in that test doesn't set `clientLastReadAt` either, so the serializer's `?? null` fallback applies):

```ts
    expect(serialized).toEqual({
      id: 12,
      title: "Broken form",
      description: "The enquiry form is failing.",
      category: "form_issue",
      priority: "high",
      status: "triaged",
      affectedUrl: "https://example.com/contact",
      createdAt,
      updatedAt,
      clientLastReadAt: null,
    })
```

Run `npx vitest run src/lib/client-requests.test.ts` after this change and confirm it still passes.

- [ ] **Step 2: Rewrite the composer**

Replace the entire contents of `web/src/components/portal/PortalMessageComposer.tsx`:

```tsx
"use client"

import { FormEvent, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from "lucide-react"
import type { ClientPortalRequest, ClientPortalRequestMessage } from "@/lib/client-requests"

interface PortalMessagesPanelProps {
  clientId: string
  initialRequest: ClientPortalRequest | null
  initialMessages: ClientPortalRequestMessage[]
}

const FALLBACK_MAILTO = "hello@scalesmiths.co.uk"

export function PortalMessagesPanel({ clientId, initialRequest, initialMessages }: PortalMessagesPanelProps) {
  const [thread, setThread] = useState(initialRequest)
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showFallback, setShowFallback] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return

    setSaving(true)
    setError("")
    setShowFallback(false)

    try {
      const response = await fetch("/portal/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok || !json.message) {
        throw new Error(json.error || "Unable to send your message.")
      }

      setMessages((current) => [...current, json.message])
      if (!thread) {
        setThread({
          id: json.requestId,
          title: "Portal messages",
          description: "Direct messages between this client and ScaleSmiths.",
          category: "general_support",
          priority: "medium",
          status: "new",
          affectedUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          clientLastReadAt: new Date(),
        })
      }
      setBody("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send your message.")
      setShowFallback(true)
    } finally {
      setSaving(false)
    }
  }

  const mailtoHref = `mailto:${FALLBACK_MAILTO}?subject=${encodeURIComponent(`Portal message from ${clientId}`)}&body=${encodeURIComponent(body.trim() || "Hi ScaleSmiths,")}`

  return (
    <section className="rounded-2xl border border-b1 bg-s1 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-b2 bg-s2">
          <Mail size={18} className="text-acc" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-syne text-xl font-bold">Direct project message</h2>
          <p className="mt-1 font-dm text-sm text-t2">Send questions, approvals, content changes, or launch notes.</p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="mb-5 rounded-xl border border-dashed border-b2 bg-s2 p-5 font-dm text-sm text-t2">
          No messages yet. Send one below to start the thread.
        </div>
      ) : (
        <div className="mb-5 max-h-[420px] space-y-3 overflow-auto">
          {messages.map((message) => {
            const own = message.senderType === "client"
            return (
              <article key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[560px] rounded-2xl border px-4 py-3 ${own ? "border-acc/25 bg-acc/10" : "border-b1 bg-s2"}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 font-dm text-[11px] text-t3">
                    <span className="font-semibold text-t2">{message.senderName}</span>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words font-dm text-sm leading-relaxed text-t1">{message.body}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label htmlFor="portal-message-body" className="mb-1.5 block font-dm text-sm text-t2">
            Message
          </label>
          <textarea
            id="portal-message-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add the detail we need, links, decisions, or anything blocking progress."
            rows={5}
            maxLength={6000}
            className="w-full resize-y rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-sm leading-relaxed text-t1 outline-none transition-colors focus:border-acc/50"
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red/25 bg-red/10 px-3 py-2 font-dm text-sm text-t1">
            <AlertCircle size={15} className="text-red" aria-hidden="true" />
            {error}
          </div>
        )}

        <button type="submit" disabled={saving || !body.trim()} className="btn-primary font-dm text-sm disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          {saving ? "Sending..." : "Send Message"}
        </button>

        {showFallback && (
          <a href={mailtoHref} className="inline-flex items-center gap-2 font-dm text-xs text-t2 underline-offset-2 hover:underline">
            <CheckCircle2 size={13} aria-hidden="true" />
            If this keeps failing, email us directly instead.
          </a>
        )}
      </form>
    </section>
  )
}

function formatDateTime(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
```

- [ ] **Step 3: Wire the Messages tab in `page.tsx`**

In `web/src/app/portal/[clientId]/page.tsx`, replace the import:

```ts
import { PortalMessageComposer } from "@/components/portal/PortalMessageComposer"
```

with:

```ts
import { PortalMessagesPanel } from "@/components/portal/PortalMessageComposer"
import { getPortalGeneralMessageThread } from "@/lib/portal-client-requests"
```

Replace the entire `MessagesTab` function:

```tsx
async function MessagesTab({ clientId }: { clientId: string }) {
  const thread = await getPortalGeneralMessageThread(clientId)
  return (
    <PortalMessagesPanel
      clientId={clientId}
      initialRequest={thread?.request ?? null}
      initialMessages={thread?.messages ?? []}
    />
  )
}
```

Update its call site (it previously took `clientName` too, which is no longer used):

```tsx
        ) : tab === "messages" ? (
          <MessagesTab clientId={portalClientId} />
```

- [ ] **Step 4: Confirm no other file still imports `PortalMessageComposer`**

Run (from `web/`): `grep -rn "PortalMessageComposer" src`
Expected: no matches (only `PortalMessagesPanel` remains, all in the two files just edited).

- [ ] **Step 5: Verify the app compiles**

Run (from `web/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/portal/PortalMessageComposer.tsx web/src/app/portal/[clientId]/page.tsx web/src/lib/client-requests.ts
git commit -m "feat: replace mailto composer with persisted portal messaging UI"
```

---

### Task 10: Admin queue — unread indicator, mark-read on select

**Files:**
- Modify: `admin/src/app/(protected)/requests/page.tsx`
- Modify: `admin/src/components/ClientRequestsQueue.tsx`

**Interfaces:**
- Consumes: `adminLastReadAt` column (Task 1), `markRead` PATCH action (Task 8).

- [ ] **Step 1: Pass `adminLastReadAt` through the composition root**

In `admin/src/app/(protected)/requests/page.tsx`, add `adminLastReadAt: string | null` to `serializeRequest`'s return object:

```ts
    completedAt: row.completedAt?.toISOString() ?? null,
    adminLastReadAt: row.adminLastReadAt?.toISOString() ?? null,
    messages,
    timelineEvents,
```

- [ ] **Step 2: Add the field to the row type and compute "unread"**

In `admin/src/components/ClientRequestsQueue.tsx`, add to `AdminClientRequestRow`:

```ts
  adminLastReadAt: string | null
```

Add a small pure helper near `isThisMonth`:

```ts
function hasUnreadClientMessage(request: AdminClientRequestRow) {
  const lastRead = request.adminLastReadAt ? new Date(request.adminLastReadAt).getTime() : 0
  return request.messages.some((message) => message.senderType === "client" && new Date(message.createdAt).getTime() > lastRead)
}
```

In the queue row rendering (the `filteredRequests.map(...)` button), add an unread dot next to the client id, e.g. right after the `<div className="truncate">{request.clientId}</div>` line:

```tsx
                            <div className="min-w-0 pr-3 font-dm text-sm font-medium">
                              <div className="flex items-center gap-1.5 truncate">
                                {request.clientId}
                                {hasUnreadClientMessage(request) && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: T.acc }} aria-label="Unread client message" />}
                              </div>
                              <div className="mt-0.5 truncate text-[11px]" style={{ color: T.t3 }}>Client ID</div>
                            </div>
```

- [ ] **Step 3: Mark the request read when it's selected**

In `ClientRequestsQueue`, the `useEffect` that resets `draft`/`internalNote`/etc. when `selected` changes already exists. Add a call to mark the request read alongside it — after the existing `setActionError(null)` line inside that `useEffect`, add:

```ts
    if (selected && hasUnreadClientMessage(selected)) {
      void fetch(`/api/client-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead" }),
      }).then((response) => response.json()).then((json) => {
        if (json?.ok && json.request) {
          setRequests((current) => current.map((request) => (request.id === json.request.id ? { ...request, adminLastReadAt: json.request.adminLastReadAt } : request)))
        }
      }).catch(() => undefined)
    }
```

(`selected` is already a dependency the effect closes over via `[selected]`; this fires once per selection change, same as the rest of the effect.)

- [ ] **Step 4: Verify the app compiles**

Run (from `admin/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add admin/src/app/\(protected\)/requests/page.tsx admin/src/components/ClientRequestsQueue.tsx
git commit -m "feat: show unread client-message indicator and mark requests read on open"
```

---

### Task 11: Documentation

**Files:**
- Create: `docs/architecture/client-requests-messaging.md`

- [ ] **Step 1: Write the doc**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/client-requests-messaging.md
git commit -m "docs: document the portal messaging flow"
```

---

### Task 12: E2E coverage

**Files:**
- Create: `web/tests/e2e/portal-messaging.spec.ts`

**Interfaces:**
- Consumes: the same `DEMO_PORTAL_ENABLED`/`DEMO_PORTAL_EMAIL`/`DEMO_PORTAL_PASSWORD`/`DEMO_PORTAL_CLIENT_ID` gate already used by `web/tests/e2e/portal-board.spec.ts`.

- [ ] **Step 1: Write the spec**

Create `web/tests/e2e/portal-messaging.spec.ts`:

```ts
import { expect, test } from "@playwright/test"

const demoEmail = process.env.DEMO_PORTAL_EMAIL
const demoPassword = process.env.DEMO_PORTAL_PASSWORD
const demoClientId = process.env.DEMO_PORTAL_CLIENT_ID
const demoEnabled = process.env.DEMO_PORTAL_ENABLED === "true" && demoEmail && demoPassword && demoClientId

test.skip(!demoEnabled, "Requires DEMO_PORTAL_ENABLED with DEMO_PORTAL_EMAIL/PASSWORD/CLIENT_ID configured for the e2e environment.")

async function loginAsDemoClient(page: import("@playwright/test").Page) {
  await page.goto("/portal/login")
  await page.getByLabel("Email", { exact: true }).fill(demoEmail!)
  await page.getByLabel("Password", { exact: true }).fill(demoPassword!)
  await page.getByRole("button", { name: /enter portal/i }).click()
  await page.waitForURL(new RegExp(`/portal/${demoClientId}$`), { timeout: 15_000 })
}

test("sending a portal message stores it and shows it in the thread, with no mailto link on the happy path", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  await loginAsDemoClient(page)
  await page.goto(`/portal/${demoClientId}?tab=messages`)

  const uniqueBody = `E2E portal message ${Date.now()}`
  await page.getByLabel("Message", { exact: true }).fill(uniqueBody)
  await page.getByRole("button", { name: /send message/i }).click()

  await expect(page.getByText(uniqueBody)).toBeVisible()
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)

  await context.close()
})

test("reloading the messages tab shows the previously sent message from persisted storage", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  await loginAsDemoClient(page)
  await page.goto(`/portal/${demoClientId}?tab=messages`)

  const uniqueBody = `E2E persisted message ${Date.now()}`
  await page.getByLabel("Message", { exact: true }).fill(uniqueBody)
  await page.getByRole("button", { name: /send message/i }).click()
  await expect(page.getByText(uniqueBody)).toBeVisible()

  await page.reload()
  await expect(page.getByText(uniqueBody)).toBeVisible()

  await context.close()
})
```

- [ ] **Step 2: List the spec to confirm it parses**

Run (from `web/`): `npx playwright test tests/e2e/portal-messaging.spec.ts --list`
Expected: 2 tests listed (or both skipped if `DEMO_PORTAL_ENABLED` isn't set locally — either is fine, this step only confirms the file is syntactically valid and discoverable).

- [ ] **Step 3: Commit**

```bash
git add web/tests/e2e/portal-messaging.spec.ts
git commit -m "test: add E2E coverage for persisted portal messaging"
```

---

## Final verification (run after all tasks)

- [ ] Run `node scripts/check-migration-history.mjs` from the repo root — expect it to pass.
- [ ] Run `npx vitest run` in both `web/` and `admin/` — expect all suites to pass.
- [ ] Run `npx tsc --noEmit -p tsconfig.json` in both `web/` and `admin/` — expect no errors.
- [ ] Run `grep -rn "mailto:hello@scalesmiths" web/src admin/src` — expect the only remaining match to be inside `PortalMessageComposer.tsx`'s fallback link, guarded by `showFallback`.
