# Prospect / Opportunity → Client Conversion Workflow — Design (v2)

**Status:** Approved for planning
**Date:** 2026-08-30
**Supersedes:** `docs/superpowers/specs/2026-08-29-prospect-conversion-workflow-design.md`
**Area:** `admin/` — CRM (prospects), clients, delivery projects, invoicing + service catalogue, portal provisioning, RBAC
**Baseline:** master `51e4b5a` already added, on `admin/src/lib/schema.ts` + `rbac.ts` + `authorization-policy.ts`:
the `prospect_conversions` and `client_service_assignments` table definitions, the `prospects.convert`
capability (granted to `sales`, `project_manager`, `owner`, `administrator`), and the `prospect-conversion`
authorization-policy rule (`GET` = `leads.read` preview, `POST` = `prospects.convert` execute).
This spec builds on that committed shape; it does not re-litigate it.

---

## 1. Problem

When an opportunity is genuinely won, operators must currently recreate the same data by hand across
clients, delivery projects, the service catalogue, invoicing, and portal provisioning. The existing
`action: "convertToClient"` branch in `admin/src/app/api/prospects/[id]/route.ts` only inserts a client and
stamps `prospects.convertedClientId`.

## 2. Goals

One controlled conversion action that can:

1. Create **or link** the client (never silently duplicate).
2. Preserve the source opportunity so it stays historically traceable after conversion.
3. Assign a service tier **and** structured services (rows in `client_service_assignments` referencing the
   invoice catalogue).
4. Optionally create a delivery project.
5. Optionally prepare portal provisioning (no credentials generated or sent).
6. Optionally create onboarding tasks.
7. Optionally create a draft invoice (never issued/sent).
8. Record conversion metadata (actor, timestamp, options, results, opportunity snapshot).

Constraints: **no auto-send** of credentials or invoices; **idempotent**; **preview/confirm** in admin;
**RBAC-protected**; integration + E2E tests. The source opportunity row remains and stays linked.

## 3. Non-goals

- Re-toggling options after a conversion exists (a conversion is single-shot; re-POST is a no-op returning
  the existing record).
- Issuing / delivering the draft invoice; activating / notifying the portal account.
- Converting from any stage other than `won`.
- Bulk conversion.
- A per-step "partial / resume" state machine — the master schema has no `status`/`steps` columns and the
  execution is **fully atomic** (§5.5). `metadata_json.steps` is an informational record of what each
  option did, not a resume ledger.

## 4. Key decisions

| # | Decision |
|---|---|
| D1 | Capability `prospects.convert` (already in `rbac.ts`). Preview is `GET` and needs only `leads.read`; execute is `POST` and needs `prospects.convert`. Once execute is entered, the service performs the downstream client / service-assignment / project / invoice / portal writes **without** re-checking `clients.write` / `projects.write` / `finance.write` / `portal_users.manage`. The immutable `prospect_conversions` row + the internal timeline event are the compensating control. |
| D2 | `prospect_conversions` (already defined) is the idempotency anchor: `prospect_id` UNIQUE, one row per converted prospect. It records `client_action` (`created`\|`linked`), `actor_user_id`, `project_id?`, `draft_invoice_id?`, `assigned_tier?`, `portal_provisioning_prepared`, `onboarding_task_ids` (int[]), and `metadata_json`. The opportunity snapshot and the confirmed options live inside `metadata_json`. |
| D3 | **Fully atomic execution.** Client (create/link), `client_service_assignments`, optional delivery project, optional onboarding tasks, optional draft invoice, optional disabled portal account, the `prospect_conversions` row, the `prospects` update, and the timeline event all commit in **one** `db.transaction`. Any failure rolls the whole conversion back; the operator retries. This requires extracting transaction-accepting variants of the delivery-project, invoice, and portal-prep services. |
| D4 | Client dedupe: `GET` preview returns best-effort match candidates (normalised business name + contact email against `clients` — the table has no website column). The operator explicitly chooses **Create new** or **Link to `<existing>`** on the `POST`. If `prospects.convertedClientId` is already set, that client is used and execute is a no-op returning the existing record. |
| D5 | Onboarding tasks: if a delivery project is created, seed `delivery_milestones` from a default set; otherwise create client-scoped `kanban_cards`. The created row ids are stored in `prospect_conversions.onboarding_task_ids`. |
| D6 | Services/tier: the operator picks a tier from `CLIENT_SERVICE_TIERS` (→ `clients.tier` + `prospect_conversions.assigned_tier`) and selects zero or more **active** `invoice_catalogue_items`. Each selected item becomes a `client_service_assignments` row (`client_id`, `catalogue_item_id`, `source_prospect_id`, `assigned_by`). If a draft invoice is also requested, its line items are seeded from those same catalogue items (`quantity 1`, `unit_amount = default_unit_amount`). The accepted proposal's `packageType` / `selectedServices` text is copied into `metadata_json` for reference. |
| D7 | Portal step = **disabled** account: set `clients.portalClientId`, insert a `portal_client_accounts` row with `active=false` and a discarded random bcrypt hash, set `prospect_conversions.portal_provisioning_prepared = true` (the account row id goes in `metadata_json.portalAccountId`). No password surfaced, no email. Activation / credential-set / notify remain the separate `portal_users.*` flow. |
| D8 | Conversion requires `stage='won'`; the preview returns a blocking warning otherwise and execute returns `409`. |
| D9 | A conversion is single-shot. Re-`POST` when a `prospect_conversions` row exists returns that record unchanged (no options comparison needed — there is nothing to re-run). |

## 5. Architecture

### 5.1 Modules

| File | Kind | Responsibility |
|---|---|---|
| `admin/src/lib/prospect-conversion.ts` | pure (no `server-only`) | Types, `parseConversionOptions`, `buildOpportunitySnapshot`, `matchExistingClients`, `buildConversionPlan`, `defaultOnboardingTasks`, `deriveTier`, `suggestInvoiceClientCode`. Unit-tested without a DB. |
| `admin/src/lib/server/prospect-conversion.ts` | `server-only` | `previewConversion(prospectId, actor)` and `executeConversion(prospectId, actor, rawOptions)`. Owns the single atomic transaction; calls the `…WithTx` service variants. |
| `admin/src/lib/server/delivery-project-service.ts` | existing | Extract `createDeliveryProjectWithTx(tx, input, actor)`; public `createDeliveryProject` becomes a thin `db.transaction` wrapper. |
| `admin/src/lib/server/invoices.ts` | existing | Extract `createInvoiceWithTx(tx, payload, actorUserId)` from the current `createInvoice` body; public `createInvoice` wraps it. Draft only — no PDF, no number. |
| `admin/src/lib/server/portal-users.ts` | existing | Add `prepareDisabledPortalAccountWithTx(tx, clientId)` and a thin `prepareDisabledPortalAccount` wrapper: set `clients.portalClientId` if absent, insert a disabled `portal_client_accounts` row, return `{ portalAccountId, portalClientId }`. |
| `admin/src/app/api/prospects/[id]/conversion/route.ts` | new | `GET` → `previewConversion`; `POST` → `executeConversion`. |
| `admin/src/lib/server/prospect-conversion-http.ts` | new | `parseId`, `conversionFailure` (maps `ProspectConversionError` + `AdminIdentityError`; else 500). |
| `admin/src/components/prospect-conversion/ConvertProspectModal.tsx` | new | Preview (`GET`) + confirm (`POST`) + result UI. |
| `admin/src/components/ProspectPipeline.tsx` | existing | Replace the `window.prompt` `onConvert` with the modal. |

### 5.2 HTTP surface

| Route | Method | Capability | Body | Response |
|---|---|---|---|---|
| `/api/prospects/[id]/conversion` | `GET` | `leads.read` | — | `{ ok, plan }` |
| `/api/prospects/[id]/conversion` | `POST` | `prospects.convert` | `{ options: ConfirmedConversionOptions }` | `{ ok, conversion }` |

`ConfirmedConversionOptions`:

```ts
{
  client:
    | { mode: "create"; name: string; tier: ClientServiceTier; invoiceClientCode: string }
    | { mode: "link"; clientId: number; tier?: ClientServiceTier; invoiceClientCode?: string };
  mrr: number;                       // written to clients.mrr (create) or updated (link, if provided)
  catalogueItemIds: number[];        // -> client_service_assignments; may be empty
  createProject: boolean;
  projectName?: string;              // required when createProject
  onboardingTasks: boolean;
  createDraftInvoice: boolean;       // requires catalogueItemIds.length > 0
  preparePortal: boolean;
}
```

The legacy `action === "convertToClient"` branch in `admin/src/app/api/prospects/[id]/route.ts` is removed.

### 5.3 Data model

Both tables are already in `schema.ts` (master `51e4b5a`). This spec only adds the **migration** that
creates them, registered in `scripts/migration-checksums.json`.

`prospect_conversions` — columns as committed. `metadata_json` shape (written once, in the transaction):

```ts
{
  capturedAt: string;
  options: ConfirmedConversionOptions;
  opportunitySnapshot: {
    prospect: { /* all prospect scalar fields at conversion time */ };
    outreach: { count: number; lastActivities: Array<{ type; direction; subject; outcome; createdAt }> }; // <= 50
    proposalTrackings: Array<{ packageType; quotedAmount; monthlyRetainerAmount; status; sentAt; acceptedAt }>;
    acceptedProposal: { source: "proposal_tracking" | "sales_proposal"; packageType; selectedServices; buildPrice; retainerPrice } | null;
    leadScore: { snapshotId: number; score: number } | null;
  };
  steps: { services: "done" | "skipped"; project: "done" | "skipped"; tasks: "done" | "skipped"; invoice: "done" | "skipped"; portal: "done" | "skipped" };
  portalAccountId?: number;
  serviceAssignmentIds: number[];
}
```

`client_service_assignments` — columns as committed. `unique(client_id, catalogue_item_id)` means re-assigning
the same catalogue item to a client is a no-op (`onConflictDoNothing`), which keeps conversion idempotent.

### 5.4 `previewConversion(prospectId, actor)` — `GET`

1. Load prospect. `404` if missing.
2. Load any existing `prospect_conversions` row → return it in `plan.existingConversion` so the UI shows a
   read-only "already converted" state.
3. Warnings: `not_won` (blocking), `already_converted` (non-blocking), `dedupe_candidates` (non-blocking),
   `no_accepted_proposal` (non-blocking).
4. Dedupe candidates: normalised exact match on business name / contact email against `clients`.
5. Defaults: client name; tier (`Retainer` if MRR>0 else `Forge Build`); MRR (accepted proposal → else
   `estimatedMonthlyRetainer`); suggested project name; default onboarding task list; suggested
   `invoiceClientCode` (derived from name, operator confirms — permanent); the **active invoice catalogue**
   (`id`, `name`, `defaultUnitAmount`, `category`) for the operator to select from; accepted-proposal summary.

No writes.

### 5.5 `executeConversion(prospectId, actor, rawOptions)` — `POST`, one `db.transaction`

1. `parseConversionOptions(rawOptions)`.
2. `select … for update` on the prospect. `404` if missing.
3. If a `prospect_conversions` row exists → return it (no-op, D9). Commit nothing.
4. Assert `prospect.stage === 'won'` → else `ProspectConversionError(409, "not_won")`.
5. Resolve client:
   - `mode: "link"` → validate `clientId` exists; `client_action = 'linked'`. If `tier`/`invoiceClientCode`
     supplied and the client lacks them, set them (invoice code via the guarded
     `assignClientInvoiceCode` semantics — never overwrite a set code). Update `mrr` if provided.
   - `mode: "create"` → insert client (`name`, `contactName`/`contactEmail` from prospect, `tier`, `mrr`,
     `status: 'active'`, `progress: 0`, `invoiceClientCode`). Unique-violation on code → `409`.
     `client_action = 'created'`.
6. Services: for each `catalogueItemIds` entry, `insert … onConflictDoNothing` into
   `client_service_assignments` (`clientId`, `catalogueItemId`, `sourceProspectId = prospectId`,
   `assignedBy = actor.id`). Collect the resulting ids.
7. Build the opportunity snapshot from prospect + activities + proposal trackings + sales proposals + latest
   lead score (all read on `tx`).
8. Optional project: `createDeliveryProjectWithTx(tx, { clientId, name: projectName, summary })`. Record
   `project_id`.
9. Optional onboarding tasks: project present → insert `delivery_milestones` (default set, `position`
   incrementing, `clientVisible: false`); else insert client-scoped `kanban_cards` (`column: 'backlog'`,
   `tag: 'onboarding'`). Collect ids → `onboarding_task_ids`.
10. Optional draft invoice: `createInvoiceWithTx(tx, { clientId, items }, actor.id)` where `items` come from
    the selected catalogue items (`catalogueItemId`, `title = name`, `quantity: 1`,
    `unitAmount: default_unit_amount`). Requires `catalogueItemIds.length > 0` (validated in
    `parseConversionOptions`). Record `draft_invoice_id`. Invoice stays `status: 'draft'`.
11. Optional portal: `prepareDisabledPortalAccountWithTx(tx, clientId)` → set
    `portal_provisioning_prepared = true`, `metadata_json.portalAccountId`.
12. Insert the `prospect_conversions` row (`prospectId`, `clientId`, `projectId`, `draftInvoiceId`,
    `actorUserId`, `clientAction`, `assignedTier`, `portalProvisioningPrepared`, `onboardingTaskIds`,
    `metadataJson`).
13. `update prospects set convertedClientId = clientId, wonAt = coalesce(wonAt, now())`.
14. `recordClientActivity(tx, { … type: 'prospect_converted', visibility: 'internal',
    idempotencyKey: 'prospect-conversion:<prospectId>' })`.
15. Commit. Return the record enriched with `{ deliveryProject, draftInvoice }` links.

### 5.6 Error type

`ProspectConversionError(safeMessage, status, code)` in the pure module, mirroring `DeliveryProjectError` /
`InvoiceDomainError`. The route maps it + `AdminIdentityError`; anything else → `500` + `console.error`.

## 6. RBAC

Already committed: `prospects.convert` in `CAPABILITIES`; granted to `sales`, `project_manager` (and
`owner` / `administrator` via `CAPABILITIES`); `prospect-conversion` policy rule (`GET`→`leads.read`,
`POST`→`prospects.convert`).

Remaining work:
- Add an explicit `requiredCapabilityForRequest` line for `/^\/api\/prospects\/[^/]+\/conversion$/` (GET →
  `leads.read`, other → `prospects.convert`) **before** the generic `/api/prospects` line, for parity with
  the policy table.
- Both route handlers call `guardApiCapability("leads.read")` (GET) / `guardApiCapability("prospects.convert")`
  (POST) for defense-in-depth and to obtain the actor.
- Update `admin/src/lib/rbac.test.ts`, `admin/src/lib/authorization-policy.test.ts`,
  `admin/src/lib/rbac-authorization.test.ts` for the new capability + rule (route-discovery coverage for the
  new handler).
- Update `docs/architecture/rbac-policy.md` (capability list + role matrix).

## 7. "No auto-send" guarantees

- Draft invoice via `createInvoiceWithTx`, which structurally only produces `status:'draft'` (no number, no
  PDF, no delivery). Issuing stays the `finance.write` flow.
- Portal account `active=false` with a discarded hash; only `portalClientId` linkage set. Enable / set
  password / notify remain the `portal_users.*` flow.
- No conversion code path imports or calls any email / Resend / invoice-delivery / notification module —
  asserted by a source-scan unit test.

## 8. Admin UI — `ConvertProspectModal`

Replaces the `window.prompt` handler at `ProspectPipeline.tsx` `onConvert`.

- **Open** → `GET …/conversion`, render:
  - **Client** — radio `Create new` / `Link to existing` (candidate cards from `plan.matchCandidates`);
    editable name, tier `<select>` (`CLIENT_SERVICE_TIER_OPTIONS`), MRR, permanent `invoiceClientCode`.
  - **Services** — checklist of `plan.catalogue` (name + formatted `defaultUnitAmount`); selected ids →
    `catalogueItemIds`.
  - **Optional steps** (all default off): `Create delivery project` (+ name), `Seed onboarding tasks`
    (shows the default list), `Create draft invoice` (disabled unless ≥1 service selected; shows the line
    items), `Prepare portal access` (caption: "creates a disabled account — no credentials generated or
    sent").
  - **Warnings** panel; `Convert` disabled while any blocking warning is present or when
    `mode:"link"` without a chosen client.
- **Confirm** → `POST …/conversion`. **Result view** lists created artifacts with deep links: client,
  delivery project, draft invoice (finance), prepared portal account ("Portal Users"). If a conversion
  already exists, the modal opens straight into the read-only result view.
- Button label: `Convert to Client` → (converted) `Converted`.

## 9. Testing

### 9.1 Unit — `admin/src/lib/prospect-conversion.test.ts` (no DB)

`parseConversionOptions` (create/link, tier validation, invoice-code format, `createProject` needs
`projectName`, `createDraftInvoice` needs a non-empty `catalogueItemIds`, negative MRR rejected);
`matchExistingClients` (name / email normalisation, no-match, multi-match order);
`buildOpportunitySnapshot` (activity cap at 50, accepted-proposal resolution: proposal_tracking → sales
proposal → null); `buildConversionPlan` (defaults, warnings incl. blocking `not_won`);
`defaultOnboardingTasks` (stable ordered list); `deriveTier`; `suggestInvoiceClientCode`
(`^[A-Z0-9]{2,12}$`); source-scan assertion that `server/prospect-conversion.ts` imports no
email/delivery module.

### 9.2 Integration — `admin/test/integration/prospect-conversion.integration.test.ts` (real Postgres)

- migration creates both tables with the committed shape (constraints enforced).
- full conversion, all options → asserts: `clients` row; `prospect_conversions` row with
  `client_action='created'`, `assigned_tier`, `onboarding_task_ids`, `metadata_json.opportunitySnapshot`,
  `portal_provisioning_prepared=true`; `client_service_assignments` rows; `prospects.convertedClientId`
  set, `stage='won'`; `delivery_projects` + seeded `delivery_milestones`; `invoices` row `status='draft'`
  with items from the catalogue; disabled `portal_client_accounts` row + `clients.portalClientId`; one
  internal `client_timeline_events` `prospect_converted`.
- **idempotency** — execute twice → second returns the same record, no duplicate rows anywhere
  (`client_service_assignments` `onConflictDoNothing` verified).
- **link mode** — pre-existing client chosen → `client_action='linked'`, no new client; tier/MRR updated
  only if supplied.
- **atomic rollback** — force the invoice step to fail (catalogue id points at an inactive/missing item) →
  whole transaction rolls back: no client, no `prospect_conversions`, no assignments, prospect untouched.
- **not won** — prospect at `proposal_sent` → `409`, nothing written.
- **minimal options** (client + one service, nothing else) → no project / invoice / portal / tasks rows.
- **RBAC** — `viewer` GET preview → `200`; `viewer` POST execute → `403`; `sales` POST → `200`;
  `finance` POST → `403`.

### 9.3 E2E — `admin/test/e2e/` (Playwright)

`sales` user: prospect at Won → open Convert modal → preview renders (client defaults + catalogue) →
select a service + toggle `Create delivery project` → confirm → result screen shows client + project
links → reopen prospect → button reads `Converted`.

### 9.4 Gate updates

RBAC policy + route-discovery tests; `check:architecture-docs` after editing `data-model.md` /
`rbac-policy.md`; `check:migration-history` / `test:migration-history` / `test:migration-consistency` for
the new migration; `tsc --noEmit`, `lint`, `test`, `build` (admin); `test:integration` (root).

## 10. Docs

- `docs/architecture/data-model.md` — add `prospect_conversions` + `client_service_assignments` and their
  relations (keep enforced headings + Mermaid valid).
- `docs/architecture/rbac-policy.md` — `prospects.convert` capability + role-matrix row.
- New `docs/architecture/prospect-conversion.md` — workflow, capability model (GET preview / POST execute),
  atomic execution, idempotency (`prospect_id` unique), dedupe rules, services-as-catalogue-assignments,
  and the no-auto-send guarantees.

## 11. Migration & rollout notes

- One admin migration creating `prospect_conversions` + `client_service_assignments`. Forward-only. No
  changes to existing columns (`prospects.convertedClientId` already exists).
- Touches no web-owned table (`portal_client_accounts` is written only at runtime, as `provisionPortalAccount`
  already does).
- Removing the legacy `convertToClient` action is safe: its only caller is the replaced UI button.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Elevated service bypasses per-domain capability checks (D1). | Immutable audited `prospect_conversions` row + internal timeline event; `prospects.convert` granted only to pipeline-owning / broad roles; documented in `prospect-conversion.md`. |
| Extracting `createInvoiceWithTx` / `createDeliveryProjectWithTx` / portal-prep-with-tx regresses existing callers. | Each public function becomes a thin `db.transaction` wrapper over the extracted body; existing tests for those services must stay green unchanged. |
| bcrypt hash inside the conversion transaction holds it open ~100 ms. | Acceptable for a single interactive admin action; documented. |
| Fully-atomic execution means one failing optional step aborts the whole conversion. | The operator retries after fixing the cause; `prospect_id` unique + the no-op re-POST make retries safe; preview surfaces likely problems (missing catalogue, not won) first. |
| `client_service_assignments.unique(client_id, catalogue_item_id)` collides on a re-link to a client that already has the service. | `onConflictDoNothing`; the assignment id is resolved by a follow-up select for `metadata_json.serviceAssignmentIds`. |
