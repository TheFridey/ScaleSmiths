# Prospect / Opportunity → Client Conversion Workflow — Design

**Status:** Approved for planning
**Date:** 2026-08-29
**Area:** `admin/` — CRM (prospects), clients, delivery projects, invoicing, portal provisioning, RBAC
**Related docs:** `docs/architecture/data-model.md`, `docs/architecture/rbac-policy.md`, `docs/architecture/client-projects-delivery.md`

---

## 1. Problem

When a prospect/opportunity is genuinely won, an operator today must manually recreate
the same data across several subsystems: create a client, (optionally) a delivery
project, (optionally) portal access, onboarding tasks, and a first draft invoice. The
existing `action: "convertToClient"` branch in
`admin/src/app/api/prospects/[id]/route.ts` only inserts a client and stamps
`prospects.convertedClientId`. There is no preview, no project/portal/task/invoice
wiring, no frozen conversion record, and the capability model does not have a role that
cleanly owns "convert".

## 2. Goals

A single controlled conversion action that can:

1. Create **or link** the client (never silently duplicate).
2. Preserve the source opportunity so it stays historically traceable after conversion.
3. Assign services/tier (tier + MRR + accepted-proposal package/services text).
4. Optionally create a delivery project.
5. Optionally prepare portal provisioning (without sending credentials).
6. Optionally create onboarding tasks.
7. Optionally create a draft invoice (never issued/sent).
8. Record conversion metadata (actor, timestamp, options, resulting artifacts, snapshot).

Constraints:

- **No auto-send** of credentials or invoices without a deliberate separate action.
- **Idempotent** — re-running the action does not create duplicates.
- **Preview / confirmation** in admin before any writes.
- **RBAC-protected**.
- Integration + E2E test coverage.

## 3. Non-goals

- Re-toggling conversion options after the first execute (options are frozen; a
  different option set is a new design).
- Issuing or delivering the draft invoice, or activating / notifying the portal account
  — those remain the existing `finance.*` and `portal_users.*` flows.
- A structured client-services catalogue / `client_services` join table. Services are
  captured as the accepted proposal's `packageType` + `selectedServices` text on the
  conversion record.
- Converting from any stage other than `won`.
- Bulk conversion.

## 4. Key decisions (from brainstorming)

| # | Decision |
|---|---|
| D1 | New `leads.convert` capability. Holding it authorizes the whole controlled workflow; the conversion service performs client/project/invoice/portal writes internally **without** re-checking `clients.write` / `projects.write` / `finance.write` / `portal_users.manage`. The audited `prospect_conversions` record + timeline event are the compensating control. |
| D2 | New admin-owned `prospect_conversions` table, one row per prospect (`prospect_id` UNIQUE), holding actor, timestamp, chosen options, resulting artifact ids, per-step status, and an **immutable** `opportunity_snapshot_json` frozen at first execute. |
| D3 | Execution model: **core atomic**, optional steps best-effort with per-step status. Client + conversion record + timeline + onboarding tasks + delivery project commit in ONE transaction. Draft invoice and portal provisioning run **after** commit; each writes its result / error back to `steps_json`. Re-running resumes only unfinished steps. |
| D4 | Client dedupe: preview surfaces best-effort match candidates (normalized business name / contact email / website host); operator explicitly chooses **Create new** or **Link to `<existing>`**. If `prospects.convertedClientId` is already set, that client is used and execute is a no-op. |
| D5 | Onboarding tasks: if a delivery project is created, seed `delivery_milestones` from a default set; otherwise create client-scoped `kanban_cards`. |
| D6 | Services/tier: operator picks tier from `CLIENT_SERVICE_TIERS` + confirms MRR (prefilled from accepted proposal → else `estimatedMonthlyRetainer`). The accepted `sales_proposal` / `proposal_trackings` package + `selectedServices` text is copied into the conversion record and seeds draft-invoice line items. |
| D7 | Portal step = create a **disabled** account: set `clients.portalClientId`, insert `portal_client_accounts` row with `active=false` and a discarded-random bcrypt hash. No password surfaced, no email. Activation / credential-set / notify remain the separate `portal_users.*` flow. |
| D8 | Conversion requires `stage='won'`; not overridable from the modal. |
| D9 | Options are frozen after first execute. A resume `POST` whose options differ from the persisted `options_json` is rejected. |

## 5. Architecture

### 5.1 Modules

| File | Kind | Responsibility |
|---|---|---|
| `admin/src/lib/prospect-conversion.ts` | pure (no `server-only`) | Types, options parsing/validation, `snapshotOpportunity`, `matchExistingClients`, `buildConversionPlan`, `defaultOnboardingTasks`, tier/MRR/invoice-code derivation, `assertOptionsUnchanged`. Unit-tested without a DB. |
| `admin/src/lib/server/prospect-conversion.ts` | `server-only` | `previewConversion(prospectId, actor)` and `executeConversion(prospectId, actor, confirmedOptions)`. Orchestrates existing services; owns the Phase A transaction and Phase B step recording. |
| `admin/src/lib/server/delivery-project-service.ts` | existing | Extract the value-building + insert body of `createDeliveryProject` into a `createDeliveryProjectWithTx(tx, input, actor)` so the conversion can create a project on the shared Phase A transaction. Public `createDeliveryProject` becomes a thin `db.transaction` wrapper over it. |
| `admin/src/lib/server/portal-users.ts` | existing | Add `prepareDisabledPortalAccount(clientId)`: set `clients.portalClientId` if absent, insert `portal_client_accounts` row `active=false` with a random discarded-hash. Returns `{ portalAccountId, portalClientId }`. |
| `admin/src/lib/server/invoices.ts` | existing | Unchanged. Called via existing `createInvoice({ clientId, items }, actorUserId)` in Phase B. |
| `admin/src/app/api/prospects/[id]/conversion/preview/route.ts` | new | `POST` → `previewConversion`. |
| `admin/src/app/api/prospects/[id]/conversion/route.ts` | new | `POST` → `executeConversion`. |
| `admin/src/components/prospect-conversion/ConvertProspectModal.tsx` | new | Preview + confirm + result UI. |
| `admin/src/components/ProspectPipeline.tsx` | existing | Replace `window.prompt` `onConvert` with the modal. |

### 5.2 HTTP surface

| Route | Method | Capability | Body | Response |
|---|---|---|---|---|
| `/api/prospects/[id]/conversion/preview` | `POST` | `leads.convert` | `{}` | `{ ok, plan }` — dedupe candidates, defaults, warnings, existing conversion record (if any) with per-step status |
| `/api/prospects/[id]/conversion` | `POST` | `leads.convert` | `{ options: ConfirmedConversionOptions }` | `{ ok, conversion }` — full `prospect_conversions` row with resolved artifact links |

`ConfirmedConversionOptions`:

```ts
{
  client: { mode: "create"; name: string; tier: ClientServiceTier; mrr: number; invoiceClientCode: string }
        | { mode: "link"; clientId: number; invoiceClientCode?: string };
  createProject: boolean;
  projectName?: string;              // required when createProject
  onboardingTasks: boolean;
  createDraftInvoice: boolean;
  preparePortal: boolean;
}
```

The legacy `action === "convertToClient"` branch in
`admin/src/app/api/prospects/[id]/route.ts` is **removed**; its only caller is the
`ProspectPipeline` button being replaced.

### 5.3 Data model — `prospect_conversions` (one admin migration)

```
id                        serial primary key
prospect_id               integer not null references prospects(id) on delete restrict   -- UNIQUE
client_id                 integer not null references clients(id) on delete restrict
delivery_project_id       integer references delivery_projects(id) on delete set null
draft_invoice_id          integer references invoices(id) on delete set null
portal_account_id         integer                                   -- row id in web-owned portal_client_accounts; no FK across ownership
link_mode                 text not null                             -- 'created' | 'linked'
converted_by              uuid references admin_users(id) on delete set null
converted_at              timestamptz not null default now()
options_json              jsonb not null
opportunity_snapshot_json jsonb not null
steps_json                jsonb not null default '{}'::jsonb        -- { project|invoice|portal|tasks: 'done'|'skipped'|'error:<safe msg>' }
status                    text not null                            -- 'completed' | 'partial'
created_at                timestamptz not null default now()
updated_at                timestamptz not null default now()
```

Constraints / indexes:

- `unique (prospect_id)` — DB-level idempotency anchor.
- `check link_mode in ('created','linked')`
- `check status in ('completed','partial')`
- `index (client_id)`

`prospects.convertedClientId` is kept as the denormalized fast link and set inside
Phase A.

`opportunity_snapshot_json` shape (frozen once):

```ts
{
  capturedAt: string;
  prospect: {
    id, businessName, contactName, contactEmail, contactPhone, websiteUrl, location,
    industry, source, stage, priority, estimatedProjectValue, estimatedMonthlyRetainer,
    revenueScore, trustScore, conversionScore, seoScore, mobileScore,
    auditSummary, painPoints, opportunityNotes, objectionNotes, wonAt, createdAt
  };
  outreach: { count: number; lastActivities: Array<{ type, direction, subject, outcome, createdAt }> }; // <= 50
  proposalTrackings: Array<{ packageType, quotedAmount, monthlyRetainerAmount, status, sentAt, acceptedAt }>;
  acceptedProposal: { source: 'proposal_tracking' | 'sales_proposal'; packageType; selectedServices; buildPrice; retainerPrice } | null;
  leadScore: { snapshotId: number; score: number } | null;
}
```

### 5.4 `previewConversion(prospectId, actor)`

1. Load prospect. `404` if missing.
2. Load any existing `prospect_conversions` row. If present, return it with resolved
   links + `steps_json` so the UI renders "Resume" instead of "Convert".
3. Warnings (non-blocking except W1): `W1 stage !== 'won'` (blocks execute),
   `W2 convertedClientId already set`, `W3 dedupe candidates found`,
   `W4 no accepted proposal`.
4. Dedupe candidates: normalized exact match on business name, contact email, and
   website host against `clients`. Never auto-links.
5. Defaults: client name; tier (`Retainer` if MRR > 0 else `Forge Build`); MRR (accepted
   proposal → else `estimatedMonthlyRetainer`); suggested project name
   (`"<business> — <package|Engagement>"`); default onboarding task set; suggested
   `invoiceClientCode` (derived from name, operator must confirm — permanent); draft
   invoice line items seeded from the accepted proposal.

No writes.

### 5.5 `executeConversion(prospectId, actor, confirmedOptions)`

**Phase A — single `db.transaction`:**

1. `select ... for update` on the prospect. Assert `stage === 'won'` → else
   `ProspectConversionError(409)`.
2. `insert into prospect_conversions (...) on conflict (prospect_id) do nothing`.
   - If the row already existed → **resume**: load it, assert
     `assertOptionsUnchanged(existing.options_json, confirmedOptions)` (reject `409`
     on mismatch), skip creation steps 3–8 that are already reflected, continue to
     Phase B for unfinished steps.
3. Client:
   - `mode: "link"` → validate `clientId` exists; `link_mode = 'linked'`. If
     `invoiceClientCode` supplied and the client has none, assign it via the existing
     `assignClientInvoiceCode` path (guarded, cannot silently overwrite).
   - `mode: "create"` → insert client (`name`, `tier`, `mrr`, `status: 'active'`,
     `progress: 0`, `invoiceClientCode`). Unique-violation on invoice code → `409`.
     `link_mode = 'created'`.
4. Write `opportunity_snapshot_json`, `options_json`, `converted_by`, `client_id`.
5. `update prospects set convertedClientId = client.id, wonAt = coalesce(wonAt, now())`
   (stage stays `won`).
6. If `createProject` → `createDeliveryProjectWithTx(tx, { clientId, name: projectName,
   summary: <from snapshot> }, actor)`; store `delivery_project_id`;
   `steps_json.project = 'done'`. Else `steps_json.project = 'skipped'`.
7. If `onboardingTasks`:
   - project present → insert `delivery_milestones` for each default task
     (`position` incrementing, `clientVisible: false`).
   - no project → insert client-scoped `kanban_cards` (`column: 'backlog'`).
   - `steps_json.tasks = 'done'`; else `'skipped'`.
8. `recordClientActivity(tx, { clientRecordId: client.id, sourceDomain: 'manual',
   sourceReference: 'prospect-conversion:<prospectId>', type: 'prospect_converted',
   title: 'Converted from opportunity', description: ..., visibility: 'internal',
   actor: { type: 'admin', id: actor.id, label: actor.name ?? actor.email },
   idempotencyKey: 'prospect-conversion:<prospectId>' })`.
9. Commit.

**Phase B — post-commit, best-effort, each recorded:**

10. If `createDraftInvoice` and `steps_json.invoice` not in `{done, skipped}`:
    `createInvoice({ clientId, invoiceDate?, dueDate?, items }, actor.id)`. On success
    store `draft_invoice_id`, `steps_json.invoice = 'done'`. On failure
    `steps_json.invoice = 'error:<InvoiceDomainError.safeMessage>'`. Invoice stays
    `status: 'draft'`.
11. If `preparePortal` and `steps_json.portal` not in `{done, skipped}`:
    `prepareDisabledPortalAccount(clientId)`. Store `portal_account_id`,
    `steps_json.portal = 'done'`. On failure `steps_json.portal = 'error:<msg>'`.
12. Recompute `status`: `completed` iff every **enabled** step is `done`/`skipped`,
    else `partial`. `update prospect_conversions set steps_json, status, updated_at`.
13. Return the record with resolved artifact links.

**Resume semantics:** a second `POST /conversion` when a row exists →
Phase A steps 3–8 are no-ops (row + client already exist; guarded updates);
Phase B retries only steps whose `steps_json` value is not `done`/`skipped`.
Options that differ from the persisted set → `409`.

### 5.6 Error type

`ProspectConversionError(message, status, code)` mirroring `DeliveryProjectError` /
`InvoiceDomainError`. Route handler maps it + `AdminIdentityError` to JSON;
everything else → `500` with a generic message and `console.error`.

## 6. RBAC

- `admin/src/lib/rbac.ts`: add `"leads.convert"` to `CAPABILITIES`. Grant in
  `ROLE_CAPABILITIES` to `owner`, `administrator`, `sales`, `project_manager`. Not
  `developer`, `finance`, `viewer`.
- `admin/src/lib/rbac.ts` `requiredCapabilityForRequest`: add, **before** the generic
  `/api/prospects` line, a match for
  `/^\/api\/prospects\/[^/]+\/conversion(\/preview)?$/` → `"leads.convert"`.
- `admin/src/lib/authorization-policy.ts`: add a `rule({...})` **before** the
  `id: "prospects"` rule:
  `route: /^\/api\/prospects\/[^/]+\/conversion(?:\/preview)?$/`, `methods: ["POST"]`,
  `domain: "sales"`, `capability: "leads.convert"`, `scope: "global"`.
- Both route handlers call `guardApiCapability("leads.convert")` (defense-in-depth +
  obtains `actor`).
- Update `admin/src/lib/authorization-policy.test.ts`, `admin/src/lib/rbac.test.ts`,
  `admin/src/lib/rbac-authorization.test.ts` and any route-discovery expectation for
  the two new handlers + the new capability.
- Update `docs/architecture/rbac-policy.md` capability list + role matrix.

## 7. "No auto-send" guarantees

- Draft invoice created via `createInvoice`, which structurally only produces
  `status: 'draft'` (no `invoiceNumber`, no PDF, no delivery attempt). Issuing/sending
  stays in the `finance.write` transition flow.
- Portal account is `active=false` with an unusable discarded hash; only
  `portalClientId` linkage is set. Enable / set-password / notify remain the
  `portal_users.*` flow.
- No code path in the conversion service imports or calls any email / Resend /
  invoice-delivery / notification function. Enforced by an assertion in the unit test
  file (import-surface check) and by review.

## 8. Admin UI — `ConvertProspectModal`

Replaces the `window.prompt` handler at `ProspectPipeline.tsx` `onConvert`.

- **Open** → `POST …/conversion/preview`, render:
  - **Client** — radio `Create new` / `Link to existing`; candidate cards (name, tier,
    MRR, matched-on badge); editable name, tier `<select>` (from
    `CLIENT_SERVICE_TIER_OPTIONS`), MRR, `invoiceClientCode` with a permanent-value
    caption.
  - **Optional steps** (all default off): `Create delivery project` (+ name field),
    `Seed onboarding tasks` (shows the default list), `Create draft invoice` (line-item
    preview from accepted proposal), `Prepare portal access` (caption: "creates a
    disabled account, no credentials are generated or sent").
  - **Warnings** panel: W1–W4 above; `Convert` disabled while W1 (not won).
- **Confirm** → `POST …/conversion`. **Result view** lists created artifacts with deep
  links: client, delivery project, draft invoice (finance), prepared portal account
  ("Portal Users" screen). For `status: 'partial'` shows failed steps + a **Resume**
  button (re-`POST`s the same options).
- Button label: `Convert to Client` → (row exists, partial) `Resume conversion` →
  (completed) `Converted`.

## 9. Testing

### 9.1 Unit — `admin/src/lib/prospect-conversion.test.ts` (no DB)

- `matchExistingClients`: name normalisation, email match, website-host match,
  no-match, multi-match ordering.
- `snapshotOpportunity`: shape, `acceptedProposal` resolution
  (proposal_tracking `accepted` vs sales_proposal `accepted` vs none), activity cap.
- options parsing: rejects `createProject` without `projectName`; rejects unknown
  tier; rejects negative MRR; rejects bad `invoiceClientCode` format; `link` without
  `clientId`.
- `assertOptionsUnchanged`: equal → ok; any differing field → throws.
- `buildConversionPlan`: defaults (tier/MRR/project name/invoice code/tasks), warning
  computation (W1–W4).
- `defaultOnboardingTasks`: stable ordered list.
- import-surface assertion: the server module does not pull in email/delivery modules.

### 9.2 Integration — `admin/test/integration/prospect-conversion.integration.test.ts`

Real Postgres (`test:integration`). Seed a won prospect with outreach + an accepted
proposal.

- **Full conversion, all options** → asserts: one `clients` row; one
  `prospect_conversions` row with frozen snapshot + `status='completed'` +
  `link_mode='created'`; `prospects.convertedClientId` set, `stage='won'`;
  `delivery_projects` row + seeded `delivery_milestones`; one `invoices` row
  `status='draft'` with seeded items; `portal_client_accounts` row `active=false` +
  `clients.portalClientId` set; one `client_timeline_events` `prospect_converted`
  (visibility `internal`).
- **Idempotency** — execute twice with identical options → second is a no-op: one
  client, one conversion row, snapshot unchanged, no duplicate project/invoice/portal/
  milestones.
- **Link mode** — pre-create a client, choose `mode: "link"` → `link_mode='linked'`,
  no new client, existing client's `portalClientId` respected.
- **Partial + resume** — inject an invoice-step failure (item referencing a missing
  catalogue id) → `status='partial'`, `steps_json.invoice` starts `error:`, Phase A
  artifacts intact; re-execute → invoice created, `status='completed'`.
- **Options frozen** — resume with a changed toggle → `409`, record untouched.
- **Minimal options** (client only) → no project/invoice/portal/tasks rows.
- **RBAC** — `viewer` / `finance` / `developer` sessions → `403` on both routes;
  `sales` → `200`. (Uses the integration auth/session helper pattern already in
  `admin/test/integration`.)
- **Not won** — prospect at `proposal_sent` → execute `409`, nothing written.

### 9.3 E2E — extend `admin/test/e2e/` admin journey (Playwright)

A `sales` user: prospect at Won → open Convert modal → preview renders → toggle
`Create delivery project` + `Seed onboarding tasks` → confirm → result screen lists
client + project links → reopen prospect → button reads `Converted`.

### 9.4 Policy / gate updates

- RBAC policy + route-discovery tests (§6).
- `npm run check:architecture-docs` after editing `data-model.md` / `rbac-policy.md`
  (preserve enforced headings + Mermaid).
- `npm run check:migration-history` / `test:migration-history` /
  `test:migration-consistency` for the new admin migration.
- `npm exec tsc -- --noEmit`, `npm run lint`, `npm test` (admin).

## 10. Docs

- `docs/architecture/data-model.md` — add `prospect_conversions` table + its relations
  to the ER section and the table inventory (keep enforced headings + Mermaid valid).
- `docs/architecture/rbac-policy.md` — new `leads.convert` capability + role-matrix row.
- New `docs/architecture/prospect-conversion.md` — workflow, phases, idempotency /
  resume semantics, the no-auto-send guarantees, and the elevated-service RBAC
  rationale.

## 11. Migration & rollout notes

- Single admin migration adds `prospect_conversions` only; no changes to existing
  columns (`prospects.convertedClientId` already exists). Forward-only.
- Web migrations run before admin migrations as usual; this change touches no
  web-owned table (`portal_client_accounts` is only written through the existing
  admin runtime path, not a migration).
- Removing the legacy `convertToClient` action is safe: no API consumer outside the
  replaced UI button.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Elevated service bypasses per-domain capability checks (D1). | Every conversion writes an immutable audited record + internal timeline event; `leads.convert` granted only to roles that already own the pipeline or are broad; documented in `prospect-conversion.md`. |
| `createDeliveryProjectWithTx` refactor regresses the existing project route. | Public `createDeliveryProject` becomes a thin wrapper; existing delivery-project tests must stay green unchanged. |
| Writing `portal_client_accounts` from admin for a *disabled* account diverges from `createPortalUser` assumptions. | Reuse the same table projection + `PASSWORD_ROUNDS`; `active=false`; covered by integration test. |
| Partial conversion leaves an operator unsure of state. | `status`/`steps_json` surfaced in preview + result; explicit Resume button; retries are safe. |
