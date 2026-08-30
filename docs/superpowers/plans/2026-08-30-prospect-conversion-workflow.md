# Prospect → Client Conversion Workflow Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single, idempotent, RBAC-protected admin action that converts a won prospect into a client — creating or linking the client, assigning a tier + structured services, freezing an opportunity snapshot, and optionally creating a delivery project, onboarding tasks, a draft invoice, and a disabled portal account — behind a GET-preview / POST-execute pair with a preview/confirm modal.

**Architecture:** An orchestration service (`admin/src/lib/server/prospect-conversion.ts`) runs **one atomic `db.transaction`** that calls transaction-accepting variants of the delivery-project, invoice, and portal-prep services. Pure helpers live in `admin/src/lib/prospect-conversion.ts`. The `prospect_conversions` and `client_service_assignments` tables (already defined in `schema.ts` by master `51e4b5a`) get their migration here. `prospect_conversions.prospect_id` UNIQUE is the idempotency anchor; a re-POST returns the existing record. Preview is `GET` (`leads.read`); execute is `POST` (`prospects.convert`, already in `rbac.ts`).

**Tech Stack:** Next.js 15.5.22 (App Router, Node runtime), Drizzle ORM + drizzle-kit, PostgreSQL, Vitest (unit + `test:integration`), Playwright (`test/e2e`), bcryptjs.

**Spec:** `docs/superpowers/specs/2026-08-30-prospect-conversion-workflow-design.md`

## Global Constraints

- Node `>=22 <23`, npm `~10.9`. Next.js pinned at **15.5.22** — do not bump governed deps.
- Two npm contexts: run app commands from `admin/`. Typecheck is `npm exec tsc -- --noEmit` (no `npm run typecheck`).
- Migrations: **admin owns** `prospects`, `clients`, `prospect_conversions`, `client_service_assignments`. `portal_client_accounts` is **web-owned** — never generate an admin migration touching it; only admin *runtime* writes it (precedent: `createPortalUser`).
- Never edit a committed migration. New migration files must be registered in `scripts/migration-checksums.json` (`forwardMigrations` + `journals.admin.appendedEntries`) or `check:migration-history` fails.
- RBAC / authorization / financial logic are protected areas: never convert an auth/authz failure into permissive behaviour. RBAC changes update `admin/src/lib/authorization-policy.test.ts`, `admin/src/lib/rbac.test.ts`, `admin/src/lib/rbac-authorization.test.ts`.
- **No auto-send:** the conversion code path must not import or call any email / Resend / invoice-delivery / notification module. Draft invoices stay `status:'draft'`. Portal accounts are `active=false` with a discarded random hash; no password returned, no email sent.
- Money values are integer minor units (GBP) as used by `clients.mrr` and invoice amounts.
- Style: no semicolons, 2-space indent, `T` style-token object in components, `db.transaction(async (tx) => …)`, domain error classes with `safeMessage`.
- **Baseline already committed on master `51e4b5a`** — do not re-add: `prospectConversions` + `clientServiceAssignments` in `schema.ts`; `"prospects.convert"` in `CAPABILITIES` + `sales` + `project_manager` grants; the `prospect-conversion` rule in `AUTHORIZATION_POLICY`. Verify these exist; build on them.

### Committed `prospect_conversions` columns (use these exact names)

`id`, `prospectId`, `clientId`, `projectId` (nullable), `draftInvoiceId` (nullable), `actorUserId` (nullable uuid), `clientAction` (`"created"|"linked"`), `assignedTier` (nullable text), `portalProvisioningPrepared` (bool, default false), `onboardingTaskIds` (`number[]` jsonb, default `[]`), `metadataJson` (`Record<string,unknown>` jsonb, default `{}`), `convertedAt` (timestamptz, default now). Unique index on `prospectId`; index on `(clientId, convertedAt)`.

### Committed `client_service_assignments` columns

`id`, `clientId` (-> clients, cascade), `catalogueItemId` (-> invoice_catalogue_items, restrict), `sourceProspectId` (-> prospects, set null), `assignedBy` (nullable uuid), `active` (bool default true), `createdAt`. Unique index on `(clientId, catalogueItemId)`; index on `sourceProspectId`.

---

### Task 1: Migration for `prospect_conversions` + `client_service_assignments`

**Files:**
- Verify (do not re-edit): `admin/src/lib/schema.ts` — both tables present from `51e4b5a`
- Create: `admin/drizzle/0055_prospect_conversion.sql` (generated, then renamed)
- Modify: `admin/drizzle/meta/_journal.json`, `admin/drizzle/meta/0055_snapshot.json` (generated)
- Modify: `scripts/migration-checksums.json` (repo root)
- Test: `admin/test/integration/prospect-conversion.integration.test.ts` (new — schema case only)

**Interfaces:**
- Consumes: the committed `prospectConversions`, `clientServiceAssignments` exports from `@/lib/schema`.
- Produces: migration `0055_prospect_conversion.sql` creating both tables; `ProspectConversionRow = typeof prospectConversions.$inferSelect` used by later tasks.

- [ ] **Step 1: Verify the schema baseline**

Run: `cd admin && grep -n "prospectConversions\|clientServiceAssignments" src/lib/schema.ts`
Expected: both `export const … = pgTable(…)` present. If missing, STOP and report — the plan assumes `51e4b5a`.

- [ ] **Step 2: Generate the migration**

Run: `cd admin && npm run db:generate`
Expected: creates `admin/drizzle/0055_<random>.sql` + `admin/drizzle/meta/0055_snapshot.json`; appends idx 55 to `_journal.json`. The SQL must contain exactly two `CREATE TABLE`s (`prospect_conversions`, `client_service_assignments`) plus their FKs and indexes — **no `ALTER`/`DROP`** on existing tables. If other statements appear, STOP and report (schema drift unrelated to this feature).

- [ ] **Step 3: Rename for a stable tag**

```bash
cd admin/drizzle && mv 0055_*.sql 0055_prospect_conversion.sql
```
Edit `admin/drizzle/meta/_journal.json`: set the idx-55 entry's `"tag"` to `"0055_prospect_conversion"`.

- [ ] **Step 4: Register in the checksum manifest**

Hash:
```bash
cd /d/Projects/scalesmiths/ss
node -e "const{createHash}=require('crypto');const fs=require('fs');console.log(createHash('sha256').update(fs.readFileSync('admin/drizzle/0055_prospect_conversion.sql')).digest('hex'))"
```
In `scripts/migration-checksums.json`:
1. Append to `forwardMigrations`:
```json
{
  "path": "admin/drizzle/0055_prospect_conversion.sql",
  "sha256": "<hash>",
  "lifecycle": "forward",
  "reason": "Adds prospect_conversions (idempotency anchor + immutable audit record for the prospect-to-client conversion workflow) and client_service_assignments (structured client service tier/catalogue assignments captured at conversion)."
}
```
2. Append to `journals.admin.appendedEntries` the idx-55 entry, byte-for-byte matching `_journal.json`.

- [ ] **Step 5: Migration-history gates**

Run: `cd /d/Projects/scalesmiths/ss && npm run check:migration-history && npm run test:migration-history && npm run test:migration-consistency`
Expected: pass. Fix manifest to match the journal on "Unregistered migration" / "journal entries do not match".

- [ ] **Step 6: Write the schema integration test**

Create `admin/test/integration/prospect-conversion.integration.test.ts`. Copy the `beforeAll`/`beforeEach`/`afterAll` harness from `admin/test/integration/postgres.integration.test.ts` verbatim (role URLs, `provision-postgres-roles.mjs`, web-then-admin `migrate(...)`, `beforeEach` truncation). Then:

```ts
import { and, eq, sql } from "drizzle-orm"
import { prospectConversions, clientServiceAssignments } from "../../src/lib/schema"
import * as currentSchema from "../../src/lib/schema"

describe("prospect_conversions + client_service_assignments schema", () => {
  it("accepts a minimal conversion row and enforces the prospect unique index", async () => {
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const [prospect] = await adminDb.insert(currentSchema.prospects).values({ businessName: "Acme", stage: "won" }).returning()
    const [client] = await adminDb.insert(currentSchema.clients).values({ name: "Acme", updatedAt: new Date() }).returning()
    await adminDb.insert(prospectConversions).values({ prospectId: prospect.id, clientId: client.id, clientAction: "created" })
    await expect(
      adminDb.insert(prospectConversions).values({ prospectId: prospect.id, clientId: client.id, clientAction: "linked" }),
    ).rejects.toThrow()
  })

  it("enforces client_service_assignments uniqueness per (client, catalogue item)", async () => {
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const [client] = await adminDb.insert(currentSchema.clients).values({ name: "Beta", updatedAt: new Date() }).returning()
    const [item] = await adminDb.insert(currentSchema.invoiceCatalogueItems).values({ name: "Care Plan", defaultUnitAmount: 5000, updatedAt: new Date() }).returning()
    await adminDb.insert(clientServiceAssignments).values({ clientId: client.id, catalogueItemId: item.id })
    await expect(
      adminDb.insert(clientServiceAssignments).values({ clientId: client.id, catalogueItemId: item.id }),
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 7: Run it**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS. If Docker Postgres is unavailable locally, run `cd admin && npm exec tsc -- --noEmit` to prove the test compiles, commit, and report DONE_WITH_CONCERNS noting the integration run was not executed.

- [ ] **Step 8: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
cd /d/Projects/scalesmiths/ss
git add admin/drizzle/0055_prospect_conversion.sql admin/drizzle/meta/_journal.json admin/drizzle/meta/0055_snapshot.json scripts/migration-checksums.json admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: migration for prospect_conversions and client_service_assignments"
```

---

### Task 2: Pure conversion module

**Files:**
- Create: `admin/src/lib/prospect-conversion.ts`
- Test: `admin/src/lib/prospect-conversion.test.ts`

**Interfaces:**
- Consumes: `ClientServiceTier`, `CLIENT_SERVICE_TIERS`, `isClientServiceTier`, `CLIENT_FORGE_BUILD_TIER`, `CLIENT_RETAINER_TIER` from `@/lib/clients`.
- Produces:
  - `class ProspectConversionError extends Error` — `safeMessage: string`, `status = 400`, `code = "prospect_conversion"`.
  - `interface ClientCreateOption { mode: "create"; name: string; tier: ClientServiceTier; invoiceClientCode: string }`
  - `interface ClientLinkOption { mode: "link"; clientId: number; tier?: ClientServiceTier; invoiceClientCode?: string }`
  - `type ClientOption = ClientCreateOption | ClientLinkOption`
  - `interface ConfirmedConversionOptions { client: ClientOption; mrr: number; catalogueItemIds: number[]; createProject: boolean; projectName?: string; onboardingTasks: boolean; createDraftInvoice: boolean; preparePortal: boolean }`
  - `interface OpportunitySnapshot { capturedAt: string; prospect: Record<string, unknown>; outreach: { count: number; lastActivities: Array<{ type: string; direction: string; subject: string | null; outcome: string | null; createdAt: string }> }; proposalTrackings: Array<{ packageType: string; quotedAmount: number; monthlyRetainerAmount: number; status: string; sentAt: string | null; acceptedAt: string | null }>; acceptedProposal: AcceptedProposalSummary | null; leadScore: { snapshotId: number; score: number } | null }`
  - `interface AcceptedProposalSummary { source: "proposal_tracking" | "sales_proposal"; packageType: string; selectedServices: string | null; buildPrice: number; retainerPrice: number }`
  - `interface ClientMatchCandidate { clientId: number; name: string; tier: string | null; mrr: number; matchedOn: Array<"name" | "email"> }`
  - `interface ConversionWarning { code: "not_won" | "already_converted" | "dedupe_candidates" | "no_accepted_proposal"; message: string; blocksExecute: boolean }`
  - `interface ConversionPlan { prospectId: number; alreadyConverted: boolean; warnings: ConversionWarning[]; defaults: { clientName: string; tier: ClientServiceTier; mrr: number; invoiceClientCode: string; projectName: string; onboardingTasks: Array<{ title: string }> }; matchCandidates: ClientMatchCandidate[]; acceptedProposal: AcceptedProposalSummary | null; existingConversionId: number | null }`
  - Functions:
    - `parseConversionOptions(input: unknown): ConfirmedConversionOptions`
    - `defaultOnboardingTasks(): Array<{ title: string }>`
    - `deriveTier(mrr: number): ClientServiceTier`
    - `suggestInvoiceClientCode(name: string): string`
    - `normaliseName(v: string | null | undefined): string`
    - `matchExistingClients(prospect: { businessName: string; contactEmail: string | null }, clients: Array<{ id: number; name: string; contactEmail: string | null; tier: string | null; mrr: number }>): ClientMatchCandidate[]`
    - `buildOpportunitySnapshot(input: SnapshotInput): OpportunitySnapshot`
    - `buildConversionPlan(input: PlanInput): ConversionPlan`

- [ ] **Step 1: Write failing tests**

Create `admin/src/lib/prospect-conversion.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  ProspectConversionError,
  parseConversionOptions,
  defaultOnboardingTasks,
  deriveTier,
  suggestInvoiceClientCode,
  matchExistingClients,
  buildOpportunitySnapshot,
  buildConversionPlan,
} from "./prospect-conversion"

const createOptions = {
  client: { mode: "create", name: "Acme Ltd", tier: "Retainer", invoiceClientCode: "ACME" },
  mrr: 500, catalogueItemIds: [1, 2],
  createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
} as const

describe("parseConversionOptions", () => {
  it("accepts a valid create payload", () => {
    expect(parseConversionOptions(createOptions).client).toMatchObject({ mode: "create", invoiceClientCode: "ACME" })
  })
  it("rejects createProject without projectName", () => {
    expect(() => parseConversionOptions({ ...createOptions, createProject: true })).toThrow(ProspectConversionError)
  })
  it("rejects createDraftInvoice with no catalogue items", () => {
    expect(() => parseConversionOptions({ ...createOptions, catalogueItemIds: [], createDraftInvoice: true })).toThrow(/service/i)
  })
  it("rejects an unknown tier", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { ...createOptions.client, tier: "Platinum" } })).toThrow(/tier/i)
  })
  it("rejects a negative mrr", () => {
    expect(() => parseConversionOptions({ ...createOptions, mrr: -1 })).toThrow(ProspectConversionError)
  })
  it("rejects a malformed invoiceClientCode on create", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { ...createOptions.client, invoiceClientCode: "a" } })).toThrow(/code/i)
  })
  it("rejects link mode without clientId", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { mode: "link" } })).toThrow(ProspectConversionError)
  })
  it("dedupes and sorts catalogueItemIds, rejects non-integers", () => {
    expect(parseConversionOptions({ ...createOptions, catalogueItemIds: [3, 3, 1] }).catalogueItemIds).toEqual([1, 3])
    expect(() => parseConversionOptions({ ...createOptions, catalogueItemIds: [1.5] })).toThrow(ProspectConversionError)
  })
})

describe("deriveTier / suggestInvoiceClientCode", () => {
  it("uses Retainer when mrr > 0 else Forge Build", () => {
    expect(deriveTier(1)).toBe("Retainer")
    expect(deriveTier(0)).toBe("Forge Build")
  })
  it("produces an uppercase 2-12 char alnum code", () => {
    expect(suggestInvoiceClientCode("Acme & Co. Marketing")).toMatch(/^[A-Z0-9]{2,12}$/)
    expect(suggestInvoiceClientCode("X")).toMatch(/^[A-Z0-9]{2,12}$/)
  })
})

describe("defaultOnboardingTasks", () => {
  it("returns a stable ordered 5-item list", () => {
    expect(defaultOnboardingTasks().map((t) => t.title)).toEqual([
      "Kickoff & welcome",
      "Collect brand assets & access",
      "Confirm scope & timeline",
      "Staging environment",
      "Go-live checklist",
    ])
  })
})

describe("matchExistingClients", () => {
  const clients = [
    { id: 1, name: "Acme Ltd", contactEmail: "hi@acme.com", tier: "Retainer", mrr: 500 },
    { id: 2, name: "Globex", contactEmail: null, tier: null, mrr: 0 },
  ]
  it("matches on normalised name", () => {
    const r = matchExistingClients({ businessName: "ACME  ltd.", contactEmail: null }, clients)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ clientId: 1, matchedOn: ["name"] })
  })
  it("matches on email", () => {
    const r = matchExistingClients({ businessName: "Nope", contactEmail: "HI@ACME.COM" }, clients)
    expect(r[0]).toMatchObject({ clientId: 1, matchedOn: ["email"] })
  })
  it("returns [] on no match", () => {
    expect(matchExistingClients({ businessName: "Zzz", contactEmail: "z@z.z" }, clients)).toEqual([])
  })
})

describe("buildOpportunitySnapshot", () => {
  const prospectRow = { id: 7, businessName: "Acme", stage: "won", source: "referral", priority: "high", estimatedProjectValue: 9000, estimatedMonthlyRetainer: 500, revenueScore: 5, trustScore: 5, conversionScore: 5, seoScore: 5, mobileScore: 5, contactName: null, contactEmail: null, contactPhone: null, websiteUrl: null, location: null, industry: null, auditSummary: null, painPoints: null, opportunityNotes: null, objectionNotes: null, wonAt: new Date("2026-08-01"), createdAt: new Date("2026-07-01") }
  it("caps activities at 50 and resolves an accepted proposal tracking", () => {
    const s = buildOpportunitySnapshot({
      prospect: prospectRow,
      activities: Array.from({ length: 60 }, () => ({ type: "email", direction: "outbound", subject: "s", outcome: null, createdAt: new Date() })),
      proposalTrackings: [{ packageType: "growth", quotedAmount: 9000, monthlyRetainerAmount: 500, status: "accepted", sentAt: new Date(), acceptedAt: new Date() }],
      salesProposals: [],
      leadScore: { id: 3, score: 82 },
    })
    expect(s.outreach.count).toBe(60)
    expect(s.outreach.lastActivities).toHaveLength(50)
    expect(s.acceptedProposal).toMatchObject({ source: "proposal_tracking", packageType: "growth" })
    expect(s.leadScore).toEqual({ snapshotId: 3, score: 82 })
  })
  it("falls back to accepted sales_proposal then null", () => {
    const base = { prospect: prospectRow, activities: [], proposalTrackings: [], leadScore: null }
    expect(buildOpportunitySnapshot({ ...base, salesProposals: [{ status: "accepted", selectedServices: "SEO", buildPrice: 4000, retainerPrice: 250, packageType: null }] }).acceptedProposal).toMatchObject({ source: "sales_proposal", selectedServices: "SEO" })
    expect(buildOpportunitySnapshot({ ...base, salesProposals: [] }).acceptedProposal).toBeNull()
  })
})

describe("buildConversionPlan", () => {
  const prospect = { id: 5, businessName: "Acme Ltd", contactName: "Sam", contactEmail: "sam@acme.com", contactPhone: null, websiteUrl: "https://acme.com", location: null, industry: null, stage: "won", source: "referral", priority: "high", estimatedProjectValue: 9000, estimatedMonthlyRetainer: 500, revenueScore: 5, trustScore: 5, conversionScore: 5, seoScore: 5, mobileScore: 5, auditSummary: null, painPoints: null, opportunityNotes: null, objectionNotes: null, wonAt: new Date(), createdAt: new Date() }
  it("computes defaults, no blocking warnings for a won prospect", () => {
    const plan = buildConversionPlan({ prospect, activities: [], proposalTrackings: [{ packageType: "growth", quotedAmount: 9000, monthlyRetainerAmount: 500, status: "accepted", sentAt: new Date(), acceptedAt: new Date() }], salesProposals: [], leadScore: null, matchCandidates: [], existingConversionId: null })
    expect(plan.defaults.tier).toBe("Retainer")
    expect(plan.defaults.mrr).toBe(500)
    expect(plan.defaults.invoiceClientCode).toMatch(/^[A-Z0-9]{2,12}$/)
    expect(plan.defaults.onboardingTasks).toHaveLength(5)
    expect(plan.warnings.some((w) => w.blocksExecute)).toBe(false)
  })
  it("flags not_won as blocking, dedupe + no_accepted_proposal as non-blocking", () => {
    const plan = buildConversionPlan({ prospect: { ...prospect, stage: "proposal_sent" }, activities: [], proposalTrackings: [], salesProposals: [], leadScore: null, matchCandidates: [{ clientId: 9, name: "Acme Ltd", tier: null, mrr: 0, matchedOn: ["name"] }], existingConversionId: null })
    expect(plan.warnings.find((w) => w.code === "not_won")?.blocksExecute).toBe(true)
    expect(plan.warnings.find((w) => w.code === "dedupe_candidates")?.blocksExecute).toBe(false)
    expect(plan.warnings.find((w) => w.code === "no_accepted_proposal")).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd admin && npm test -- src/lib/prospect-conversion.test.ts`
Expected: FAIL — `Cannot find module './prospect-conversion'`.

- [ ] **Step 3: Implement `admin/src/lib/prospect-conversion.ts`**

```ts
import { CLIENT_FORGE_BUILD_TIER, CLIENT_RETAINER_TIER, isClientServiceTier, type ClientServiceTier } from "@/lib/clients"

export class ProspectConversionError extends Error {
  constructor(public safeMessage: string, public status = 400, public code = "prospect_conversion") {
    super(safeMessage)
    this.name = "ProspectConversionError"
  }
}

export interface ClientCreateOption { mode: "create"; name: string; tier: ClientServiceTier; invoiceClientCode: string }
export interface ClientLinkOption { mode: "link"; clientId: number; tier?: ClientServiceTier; invoiceClientCode?: string }
export type ClientOption = ClientCreateOption | ClientLinkOption

export interface ConfirmedConversionOptions {
  client: ClientOption
  mrr: number
  catalogueItemIds: number[]
  createProject: boolean
  projectName?: string
  onboardingTasks: boolean
  createDraftInvoice: boolean
  preparePortal: boolean
}

const INVOICE_CODE_RE = /^[A-Z0-9]{2,12}$/

function bool(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new ProspectConversionError(`${field} must be true or false.`)
  return value
}
function nonNegativeInt(value: unknown, field: string) {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(n) || n < 0) throw new ProspectConversionError(`${field} must be zero or a positive whole number.`)
  return n
}
function catalogueIds(value: unknown) {
  if (!Array.isArray(value)) throw new ProspectConversionError("Service selection must be a list.")
  const ids = value.map((v) => {
    const n = typeof v === "number" ? v : Number(v)
    if (!Number.isInteger(n) || n <= 0) throw new ProspectConversionError("Service ids must be positive whole numbers.")
    return n
  })
  return [...new Set(ids)].sort((a, b) => a - b)
}

export function parseConversionOptions(input: unknown): ConfirmedConversionOptions {
  if (!input || typeof input !== "object") throw new ProspectConversionError("A conversion options object is required.")
  const raw = input as Record<string, unknown>
  const c = raw.client
  if (!c || typeof c !== "object") throw new ProspectConversionError("A client option is required.")
  const cr = c as Record<string, unknown>

  let client: ClientOption
  if (cr.mode === "create") {
    const name = typeof cr.name === "string" ? cr.name.trim() : ""
    if (!name) throw new ProspectConversionError("Client name is required.")
    if (!isClientServiceTier(cr.tier)) throw new ProspectConversionError("Select a valid client service tier.")
    const code = typeof cr.invoiceClientCode === "string" ? cr.invoiceClientCode.trim().toUpperCase() : ""
    if (!INVOICE_CODE_RE.test(code)) throw new ProspectConversionError("Invoice client code must be 2–12 letters or numbers.")
    client = { mode: "create", name, tier: cr.tier, invoiceClientCode: code }
  } else if (cr.mode === "link") {
    const clientId = typeof cr.clientId === "number" ? cr.clientId : Number(cr.clientId)
    if (!Number.isInteger(clientId) || clientId <= 0) throw new ProspectConversionError("Select an existing client to link.")
    const tier = cr.tier == null || cr.tier === "" ? undefined : cr.tier
    if (tier !== undefined && !isClientServiceTier(tier)) throw new ProspectConversionError("Select a valid client service tier.")
    const code = cr.invoiceClientCode == null || cr.invoiceClientCode === "" ? undefined : String(cr.invoiceClientCode).trim().toUpperCase()
    if (code !== undefined && !INVOICE_CODE_RE.test(code)) throw new ProspectConversionError("Invoice client code must be 2–12 letters or numbers.")
    client = { mode: "link", clientId, tier: tier as ClientServiceTier | undefined, invoiceClientCode: code }
  } else {
    throw new ProspectConversionError("Client mode must be 'create' or 'link'.")
  }

  const ids = catalogueIds(raw.catalogueItemIds)
  const createProject = bool(raw.createProject, "Create project")
  const projectName = typeof raw.projectName === "string" ? raw.projectName.trim() : ""
  if (createProject && !projectName) throw new ProspectConversionError("A project name is required to create a project.")
  const createDraftInvoice = bool(raw.createDraftInvoice, "Create draft invoice")
  if (createDraftInvoice && ids.length === 0) throw new ProspectConversionError("Select at least one service before creating a draft invoice.")

  return {
    client,
    mrr: nonNegativeInt(raw.mrr, "MRR"),
    catalogueItemIds: ids,
    createProject,
    projectName: createProject ? projectName : undefined,
    onboardingTasks: bool(raw.onboardingTasks, "Onboarding tasks"),
    createDraftInvoice,
    preparePortal: bool(raw.preparePortal, "Prepare portal"),
  }
}

export function defaultOnboardingTasks() {
  return [
    { title: "Kickoff & welcome" },
    { title: "Collect brand assets & access" },
    { title: "Confirm scope & timeline" },
    { title: "Staging environment" },
    { title: "Go-live checklist" },
  ]
}

export function deriveTier(mrr: number): ClientServiceTier {
  return mrr > 0 ? CLIENT_RETAINER_TIER : CLIENT_FORGE_BUILD_TIER
}

export function suggestInvoiceClientCode(name: string) {
  const cleaned = (name ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")
  const base = (cleaned || "CLIENT").slice(0, 12)
  return base.length >= 2 ? base : (base + "00").slice(0, 2)
}

export function normaliseName(v: string | null | undefined) {
  return (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

export interface ClientMatchCandidate { clientId: number; name: string; tier: string | null; mrr: number; matchedOn: Array<"name" | "email"> }

export function matchExistingClients(
  prospect: { businessName: string; contactEmail: string | null },
  clients: Array<{ id: number; name: string; contactEmail: string | null; tier: string | null; mrr: number }>,
): ClientMatchCandidate[] {
  const name = normaliseName(prospect.businessName)
  const email = (prospect.contactEmail ?? "").trim().toLowerCase()
  const out: ClientMatchCandidate[] = []
  for (const client of clients) {
    const matchedOn: Array<"name" | "email"> = []
    if (name && normaliseName(client.name) === name) matchedOn.push("name")
    if (email && (client.contactEmail ?? "").trim().toLowerCase() === email) matchedOn.push("email")
    if (matchedOn.length) out.push({ clientId: client.id, name: client.name, tier: client.tier, mrr: client.mrr, matchedOn })
  }
  return out.sort((a, b) => b.matchedOn.length - a.matchedOn.length || a.clientId - b.clientId)
}

export interface AcceptedProposalSummary { source: "proposal_tracking" | "sales_proposal"; packageType: string; selectedServices: string | null; buildPrice: number; retainerPrice: number }

interface SnapshotInput {
  prospect: Record<string, unknown> & { id: number }
  activities: Array<{ type: string; direction: string; subject: string | null; outcome: string | null; createdAt: Date }>
  proposalTrackings: Array<{ packageType: string; quotedAmount: number; monthlyRetainerAmount: number; status: string; sentAt: Date | null; acceptedAt: Date | null }>
  salesProposals: Array<{ status: string; selectedServices: string | null; buildPrice: number; retainerPrice: number; packageType?: string | null }>
  leadScore: { id: number; score: number } | null
}

export interface OpportunitySnapshot {
  capturedAt: string
  prospect: Record<string, unknown>
  outreach: { count: number; lastActivities: Array<{ type: string; direction: string; subject: string | null; outcome: string | null; createdAt: string }> }
  proposalTrackings: Array<{ packageType: string; quotedAmount: number; monthlyRetainerAmount: number; status: string; sentAt: string | null; acceptedAt: string | null }>
  acceptedProposal: AcceptedProposalSummary | null
  leadScore: { snapshotId: number; score: number } | null
}

function iso(v: Date | null | undefined) { return v ? new Date(v).toISOString() : null }

function resolveAccepted(input: SnapshotInput): AcceptedProposalSummary | null {
  const t = input.proposalTrackings.find((r) => r.status === "accepted")
  if (t) return { source: "proposal_tracking", packageType: t.packageType, selectedServices: null, buildPrice: t.quotedAmount, retainerPrice: t.monthlyRetainerAmount }
  const p = input.salesProposals.find((r) => r.status === "accepted")
  if (p) return { source: "sales_proposal", packageType: p.packageType ?? "custom", selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice }
  return null
}

export function buildOpportunitySnapshot(input: SnapshotInput): OpportunitySnapshot {
  return {
    capturedAt: new Date().toISOString(),
    prospect: { ...input.prospect },
    outreach: {
      count: input.activities.length,
      lastActivities: input.activities.slice(0, 50).map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: new Date(a.createdAt).toISOString() })),
    },
    proposalTrackings: input.proposalTrackings.map((r) => ({ packageType: r.packageType, quotedAmount: r.quotedAmount, monthlyRetainerAmount: r.monthlyRetainerAmount, status: r.status, sentAt: iso(r.sentAt), acceptedAt: iso(r.acceptedAt) })),
    acceptedProposal: resolveAccepted(input),
    leadScore: input.leadScore ? { snapshotId: input.leadScore.id, score: input.leadScore.score } : null,
  }
}

export interface ConversionWarning { code: "not_won" | "already_converted" | "dedupe_candidates" | "no_accepted_proposal"; message: string; blocksExecute: boolean }

interface PlanInput extends SnapshotInput {
  matchCandidates: ClientMatchCandidate[]
  existingConversionId: number | null
}

export interface ConversionPlan {
  prospectId: number
  alreadyConverted: boolean
  warnings: ConversionWarning[]
  defaults: { clientName: string; tier: ClientServiceTier; mrr: number; invoiceClientCode: string; projectName: string; onboardingTasks: Array<{ title: string }> }
  matchCandidates: ClientMatchCandidate[]
  acceptedProposal: AcceptedProposalSummary | null
  existingConversionId: number | null
}

export function buildConversionPlan(input: PlanInput): ConversionPlan {
  const p = input.prospect as Record<string, unknown> & { id: number; businessName: string; stage: string; estimatedMonthlyRetainer: number }
  const accepted = resolveAccepted(input)
  const mrr = accepted ? accepted.retainerPrice : p.estimatedMonthlyRetainer
  const packageLabel = accepted ? accepted.packageType : "Engagement"

  const warnings: ConversionWarning[] = []
  if (p.stage !== "won") warnings.push({ code: "not_won", message: "This opportunity is not marked Won. Move it to Won before converting.", blocksExecute: true })
  if (input.existingConversionId) warnings.push({ code: "already_converted", message: "This opportunity has already been converted.", blocksExecute: false })
  if (input.matchCandidates.length) warnings.push({ code: "dedupe_candidates", message: `Found ${input.matchCandidates.length} existing client(s) that may already represent this business.`, blocksExecute: false })
  if (!accepted) warnings.push({ code: "no_accepted_proposal", message: "No accepted proposal found; tier and MRR defaults come from the prospect estimates.", blocksExecute: false })

  return {
    prospectId: p.id,
    alreadyConverted: Boolean(input.existingConversionId),
    warnings,
    defaults: {
      clientName: p.businessName,
      tier: deriveTier(mrr),
      mrr,
      invoiceClientCode: suggestInvoiceClientCode(p.businessName),
      projectName: `${p.businessName} — ${packageLabel}`,
      onboardingTasks: defaultOnboardingTasks(),
    },
    matchCandidates: input.matchCandidates,
    acceptedProposal: accepted,
    existingConversionId: input.existingConversionId,
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd admin && npm test -- src/lib/prospect-conversion.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/prospect-conversion.ts admin/src/lib/prospect-conversion.test.ts
git commit -m "feat: pure helpers for prospect conversion (options, matching, snapshot, plan)"
```

---

### Task 3: Extract `createDeliveryProjectWithTx`

**Files:**
- Modify: `admin/src/lib/server/delivery-project-service.ts` (`createDeliveryProject`, ~lines 111-144)
- Test: `admin/src/lib/delivery-projects.test.ts` (must stay green, same count)

**Interfaces:**
- Consumes: `AdminDatabaseTransaction` from `@/lib/db`, `DeliveryActor` (already exported here).
- Produces: `export async function createDeliveryProjectWithTx(tx: AdminDatabaseTransaction, input: Record<string, unknown>, actor: DeliveryActor): Promise<typeof deliveryProjects.$inferSelect>`. `createDeliveryProject(input, actor)` becomes `db.transaction((tx) => createDeliveryProjectWithTx(tx, input, actor))`.

- [ ] **Step 1: Baseline the delivery tests**

Run: `cd admin && npm test -- src/lib/delivery-projects.test.ts`
Expected: PASS — note the count.

- [ ] **Step 2: Refactor**

In `admin/src/lib/server/delivery-project-service.ts` add `type { AdminDatabaseTransaction } from "@/lib/db"` to the `db` import. Move the entire current body of `createDeliveryProject` (validation block + the `db.transaction(async (tx) => { … })` inner body) into a new exported `createDeliveryProjectWithTx(tx, input, actor)` — cut and paste the `values` object and the inner statements verbatim, dropping only the `db.transaction(async (tx) => { … })` wrapper. Then:

```ts
export async function createDeliveryProject(input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction((tx) => createDeliveryProjectWithTx(tx, input, actor))
}
```

- [ ] **Step 3: Re-run delivery tests**

Run: `cd admin && npm test -- src/lib/delivery-projects.test.ts`
Expected: PASS, same count as Step 1.

- [ ] **Step 4: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/delivery-project-service.ts
git commit -m "refactor: expose createDeliveryProjectWithTx for shared-transaction callers"
```

---

### Task 4: Extract `createInvoiceWithTx`

**Files:**
- Modify: `admin/src/lib/server/invoices.ts` (`createInvoice`, ~lines 25-46)
- Test: `admin/src/lib/invoices.test.ts` + `admin/src/lib/server/invoice-*.test.ts` (must stay green)

**Interfaces:**
- Consumes: `AdminDatabaseTransaction` (already imported in this file as `type { … AdminDatabaseTransaction }`).
- Produces: `export async function createInvoiceWithTx(tx: AdminDatabaseTransaction, payload: InvoicePayload, actorUserId: string): Promise<Awaited<ReturnType<typeof loadInvoice>>>`. `createInvoice(payload, actorUserId)` becomes `db.transaction((tx) => createInvoiceWithTx(tx, payload, actorUserId))`. `InvoicePayload` is the file-local interface already declared.

- [ ] **Step 1: Baseline invoice tests**

Run: `cd admin && npm test -- src/lib/invoices.test.ts`
Expected: PASS — note the count.

- [ ] **Step 2: Refactor**

In `admin/src/lib/server/invoices.ts`, the current `createInvoice` is:

```ts
export async function createInvoice(payload: InvoicePayload, actorUserId: string) {
  const clientId = positiveInteger(payload.clientId, "Client")
  return db.transaction(async (tx) => { /* … body … */ })
}
```

Split into:

```ts
export async function createInvoice(payload: InvoicePayload, actorUserId: string) {
  return db.transaction((tx) => createInvoiceWithTx(tx, payload, actorUserId))
}

export async function createInvoiceWithTx(tx: AdminDatabaseTransaction, payload: InvoicePayload, actorUserId: string) {
  const clientId = positiveInteger(payload.clientId, "Client")
  // … the exact statements from the old db.transaction callback, verbatim …
  return loadInvoice(tx, invoice.id)
}
```

Move `positiveInteger(payload.clientId, …)` inside `createInvoiceWithTx` (as shown). Keep every other line of the callback unchanged.

- [ ] **Step 3: Re-run invoice tests**

Run: `cd admin && npm test -- src/lib/invoices.test.ts src/lib/server`
Expected: PASS, invoice suites unchanged.

- [ ] **Step 4: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/invoices.ts
git commit -m "refactor: expose createInvoiceWithTx for shared-transaction callers"
```

---

### Task 5: `prepareDisabledPortalAccountWithTx`

**Files:**
- Modify: `admin/src/lib/server/portal-users.ts`
- Test: `admin/test/integration/prospect-conversion.integration.test.ts` (focused case)

**Interfaces:**
- Consumes: `db`, `AdminDatabaseTransaction` from `@/lib/db`; `clients` from `@/lib/schema`; the file-local `portalClientAccounts` projection; `bcrypt`, `randomBytes`, `PASSWORD_ROUNDS`, `isUniqueViolation`, `PortalUserError`.
- Produces:
  - `export async function prepareDisabledPortalAccountWithTx(tx: AdminDatabaseTransaction, clientId: number): Promise<{ portalAccountId: number; portalClientId: string }>`
  - `export async function prepareDisabledPortalAccount(clientId: number)` — thin `db.transaction` wrapper.

- [ ] **Step 1: Failing integration case**

Add to `admin/test/integration/prospect-conversion.integration.test.ts`:

```ts
import { prepareDisabledPortalAccount } from "../../src/lib/server/portal-users"

it("prepareDisabledPortalAccount links portalClientId and creates a disabled account", async () => {
  process.env.ADMIN_DATABASE_URL = adminUrl
  const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
  const [client] = await adminDb.insert(currentSchema.clients).values({ name: "Portalless", updatedAt: new Date() }).returning()
  const result = await prepareDisabledPortalAccount(client.id)
  expect(result.portalClientId).toBe(`portal-client-${client.id}`)
  const [updated] = await adminDb.select().from(currentSchema.clients).where(eq(currentSchema.clients.id, client.id))
  expect(updated.portalClientId).toBe(result.portalClientId)
  const rows = await adminDb.execute(sql`select active, password_hash from portal_client_accounts where id = ${result.portalAccountId}`)
  expect(rows.rows[0].active).toBe(false)
  expect(String(rows.rows[0].password_hash).length).toBeGreaterThan(20)
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: FAIL — `prepareDisabledPortalAccount is not a function`.

- [ ] **Step 3: Implement**

Append to `admin/src/lib/server/portal-users.ts` (add `type { AdminDatabaseTransaction } from "@/lib/db"` to the `db` import if not present):

```ts
export async function prepareDisabledPortalAccountWithTx(tx: AdminDatabaseTransaction, clientId: number) {
  if (!Number.isInteger(clientId) || clientId <= 0) throw new PortalUserError("A valid client is required.")
  const [client] = await tx.select({ id: clients.id, portalClientId: clients.portalClientId })
    .from(clients).where(eq(clients.id, clientId)).for("update").limit(1)
  if (!client) throw new PortalUserError("The selected client no longer exists.", 404, "client_not_found")
  const portalClientId = client.portalClientId ?? `portal-client-${client.id}`
  if (!client.portalClientId) await tx.update(clients).set({ portalClientId, updatedAt: new Date() }).where(eq(clients.id, client.id))
  try {
    const [account] = await tx.insert(portalClientAccounts).values({
      clientId: portalClientId,
      email: `portal-disabled+${client.id}@scalesmiths.co.uk`,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("base64url"), PASSWORD_ROUNDS),
      active: false,
    }).returning({ id: portalClientAccounts.id })
    return { portalAccountId: account.id, portalClientId }
  } catch (error) {
    if (isUniqueViolation(error)) throw new PortalUserError("A portal account already exists for this client.", 409, "duplicate_account")
    throw error
  }
}

export async function prepareDisabledPortalAccount(clientId: number) {
  return db.transaction((tx) => prepareDisabledPortalAccountWithTx(tx, clientId))
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/portal-users.ts admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: prepareDisabledPortalAccount(WithTx) for conversion portal provisioning"
```

---

### Task 6: `previewConversion` (GET)

**Files:**
- Create: `admin/src/lib/server/prospect-conversion.ts`
- Test: `admin/test/integration/prospect-conversion.integration.test.ts`

**Interfaces:**
- Consumes: pure helpers from `@/lib/prospect-conversion`; `db` from `@/lib/db`; schema `prospects`, `clients`, `outreachActivities`, `proposalTrackings`, `salesProposals`, `leadScoreSnapshots`, `prospectConversions`, `invoiceCatalogueItems`.
- Produces:
  - `interface ConversionActor { id: string; email?: string | null; name?: string | null }`
  - `type ProspectConversionRow = typeof prospectConversions.$inferSelect`
  - `interface ConversionPlanResponse extends ConversionPlan { catalogue: Array<{ id: number; name: string; defaultUnitAmount: number; category: string | null }> }`
  - `export async function previewConversion(prospectId: number, actor: ConversionActor): Promise<ConversionPlanResponse>` — `ProspectConversionError(404)` if the prospect is missing.
  - `export async function loadConversionRecord(prospectId: number): Promise<ProspectConversionRow | null>`

- [ ] **Step 1: Failing integration tests**

Add to the integration test:

```ts
import { previewConversion } from "../../src/lib/server/prospect-conversion"

const actor = { id: "00000000-0000-0000-0000-000000000001", email: "op@scalesmiths.co.uk", name: "Op" }

async function seedWonProspect(adminDb: ReturnType<typeof drizzle>) {
  const [prospect] = await adminDb.insert(currentSchema.prospects).values({
    businessName: "Acme Ltd", contactEmail: "sam@acme.com", websiteUrl: "https://acme.com",
    stage: "won", estimatedProjectValue: 9000, estimatedMonthlyRetainer: 500, wonAt: new Date(),
  }).returning()
  await adminDb.insert(currentSchema.proposalTrackings).values({
    prospectId: prospect.id, packageType: "growth", quotedAmount: 9000, monthlyRetainerAmount: 500,
    status: "accepted", acceptedAt: new Date(), updatedAt: new Date(),
  })
  return prospect
}

describe("previewConversion", () => {
  it("returns defaults, catalogue, dedupe candidates, no blocking warnings", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    await adminDb.insert(currentSchema.clients).values({ name: "Acme Ltd", contactEmail: "x@y.z", updatedAt: new Date() })
    await adminDb.insert(currentSchema.invoiceCatalogueItems).values({ name: "Care Plan", defaultUnitAmount: 5000, updatedAt: new Date() })
    const plan = await previewConversion(prospect.id, actor)
    expect(plan.defaults.tier).toBe("Retainer")
    expect(plan.defaults.mrr).toBe(500)
    expect(plan.matchCandidates[0]).toMatchObject({ matchedOn: ["name"] })
    expect(plan.catalogue.some((c) => c.name === "Care Plan")).toBe(true)
    expect(plan.warnings.some((w) => w.blocksExecute)).toBe(false)
    expect(plan.existingConversionId).toBeNull()
  })
  it("404s on a missing prospect", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    await expect(previewConversion(999999, actor)).rejects.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `admin/src/lib/server/prospect-conversion.ts` (preview only)**

```ts
import "server-only"

import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  clients,
  invoiceCatalogueItems,
  leadScoreSnapshots,
  outreachActivities,
  proposalTrackings,
  prospectConversions,
  prospects,
  salesProposals,
} from "@/lib/schema"
import {
  ProspectConversionError,
  buildConversionPlan,
  matchExistingClients,
  type ConversionPlan,
} from "@/lib/prospect-conversion"

export interface ConversionActor { id: string; email?: string | null; name?: string | null }
export type ProspectConversionRow = typeof prospectConversions.$inferSelect
export interface ConversionPlanResponse extends ConversionPlan {
  catalogue: Array<{ id: number; name: string; defaultUnitAmount: number; category: string | null }>
}

export async function loadConversionRecord(prospectId: number) {
  const [row] = await db.select().from(prospectConversions).where(eq(prospectConversions.prospectId, prospectId)).limit(1)
  return row ?? null
}

async function loadOpportunity(prospectId: number) {
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1)
  if (!prospect) throw new ProspectConversionError("Prospect not found.", 404, "not_found")
  const [activities, trackings, proposals, scores] = await Promise.all([
    db.select().from(outreachActivities).where(eq(outreachActivities.prospectId, prospectId)).orderBy(desc(outreachActivities.createdAt)),
    db.select().from(proposalTrackings).where(eq(proposalTrackings.prospectId, prospectId)).orderBy(desc(proposalTrackings.createdAt)),
    db.select().from(salesProposals).where(eq(salesProposals.prospectId, prospectId)).orderBy(desc(salesProposals.updatedAt)),
    db.select().from(leadScoreSnapshots).where(eq(leadScoreSnapshots.prospectId, prospectId)).orderBy(desc(leadScoreSnapshots.createdAt)).limit(1),
  ])
  return { prospect, activities, trackings, proposals, leadScore: scores[0] ?? null }
}

export function planInputs(data: Awaited<ReturnType<typeof loadOpportunity>>) {
  return {
    prospect: data.prospect as Record<string, unknown> & { id: number },
    activities: data.activities.map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: a.createdAt })),
    proposalTrackings: data.trackings.map((t) => ({ packageType: t.packageType, quotedAmount: t.quotedAmount, monthlyRetainerAmount: t.monthlyRetainerAmount, status: t.status, sentAt: t.sentAt, acceptedAt: t.acceptedAt })),
    salesProposals: data.proposals.map((p) => ({ status: p.status, selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice, packageType: null })),
    leadScore: data.leadScore ? { id: data.leadScore.id, score: data.leadScore.score } : null,
  }
}

export async function previewConversion(prospectId: number, _actor: ConversionActor): Promise<ConversionPlanResponse> {
  const data = await loadOpportunity(prospectId)
  const existing = await loadConversionRecord(prospectId)
  const [allClients, catalogue] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, contactEmail: clients.contactEmail, tier: clients.tier, mrr: clients.mrr }).from(clients),
    db.select({ id: invoiceCatalogueItems.id, name: invoiceCatalogueItems.name, defaultUnitAmount: invoiceCatalogueItems.defaultUnitAmount, category: invoiceCatalogueItems.category, active: invoiceCatalogueItems.active }).from(invoiceCatalogueItems).orderBy(invoiceCatalogueItems.position, invoiceCatalogueItems.name),
  ])
  const matchCandidates = matchExistingClients(
    { businessName: data.prospect.businessName, contactEmail: data.prospect.contactEmail },
    allClients,
  )
  const plan = buildConversionPlan({ ...planInputs(data), matchCandidates, existingConversionId: existing?.id ?? null })
  return { ...plan, catalogue: catalogue.filter((c) => c.active).map(({ active: _a, ...rest }) => rest) }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/prospect-conversion.ts admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: previewConversion computes the conversion plan and catalogue"
```

---

### Task 7: `executeConversion` (one atomic transaction)

**Files:**
- Modify: `admin/src/lib/server/prospect-conversion.ts`
- Test: `admin/test/integration/prospect-conversion.integration.test.ts`

**Interfaces:**
- Consumes: `parseConversionOptions`, `buildOpportunitySnapshot`, `defaultOnboardingTasks` from `@/lib/prospect-conversion`; `createDeliveryProjectWithTx`, `DeliveryActor` from `@/lib/server/delivery-project-service`; `createInvoiceWithTx` from `@/lib/server/invoices`; `prepareDisabledPortalAccountWithTx` from `@/lib/server/portal-users`; `recordClientActivity` from `@/lib/server/client-activity`; `assignClientInvoiceCode` from `@/lib/server/invoices`; schema `clients`, `kanbanCards`, `deliveryMilestones`, `deliveryProjects`, `invoices`, `clientServiceAssignments`, `prospects`, `prospectConversions`.
- Produces:
  - `interface ConversionRecordView extends ProspectConversionRow { deliveryProject: { id: number; name: string } | null; draftInvoice: { id: number; status: string } | null }`
  - `export async function executeConversion(prospectId: number, actor: ConversionActor, rawOptions: unknown): Promise<ConversionRecordView>`

- [ ] **Step 1: Failing integration tests**

```ts
import { executeConversion } from "../../src/lib/server/prospect-conversion"

async function seedCatalogue(adminDb: ReturnType<typeof drizzle>) {
  const [item] = await adminDb.insert(currentSchema.invoiceCatalogueItems).values({ name: "Care Plan", defaultUnitAmount: 5000, updatedAt: new Date() }).returning()
  return item
}

describe("executeConversion (atomic)", () => {
  function baseOptions(catalogueItemIds: number[]) {
    return {
      client: { mode: "create", name: "Acme Ltd", tier: "Retainer", invoiceClientCode: "ACME1" },
      mrr: 500, catalogueItemIds,
      createProject: true, projectName: "Acme — growth", onboardingTasks: true,
      createDraftInvoice: true, preparePortal: true,
    }
  }

  it("creates every artifact in one transaction", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const item = await seedCatalogue(adminDb)
    const record = await executeConversion(prospect.id, actor, baseOptions([item.id]))
    expect(record.clientAction).toBe("created")
    expect(record.assignedTier).toBe("Retainer")
    expect(record.portalProvisioningPrepared).toBe(true)
    expect(record.onboardingTaskIds.length).toBe(5)
    expect((record.metadataJson as any).opportunitySnapshot.acceptedProposal.packageType).toBe("growth")
    const [client] = await adminDb.select().from(currentSchema.clients).where(eq(currentSchema.clients.id, record.clientId))
    expect(client.tier).toBe("Retainer")
    expect(client.invoiceClientCode).toBe("ACME1")
    expect(client.portalClientId).toBe(`portal-client-${client.id}`)
    const [updated] = await adminDb.select().from(currentSchema.prospects).where(eq(currentSchema.prospects.id, prospect.id))
    expect(updated.convertedClientId).toBe(record.clientId)
    const assigns = await adminDb.select().from(currentSchema.clientServiceAssignments).where(eq(currentSchema.clientServiceAssignments.clientId, record.clientId))
    expect(assigns).toHaveLength(1)
    expect(assigns[0].sourceProspectId).toBe(prospect.id)
    const milestones = await adminDb.select().from(currentSchema.deliveryMilestones).where(eq(currentSchema.deliveryMilestones.projectId, record.projectId!))
    expect(milestones).toHaveLength(5)
    const [invoice] = await adminDb.select().from(currentSchema.invoices).where(eq(currentSchema.invoices.id, record.draftInvoiceId!))
    expect(invoice.status).toBe("draft")
    expect(invoice.invoiceNumber).toBeNull()
    const portalRows = await adminDb.execute(sql`select active from portal_client_accounts where client_id = ${client.portalClientId}`)
    expect(portalRows.rows[0].active).toBe(false)
    const events = await adminDb.select().from(currentSchema.clientTimelineEvents).where(eq(currentSchema.clientTimelineEvents.clientRecordId, record.clientId))
    expect(events.some((e) => e.type === "prospect_converted")).toBe(true)
  })

  it("is idempotent: a second call returns the same record, no duplicates", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const item = await seedCatalogue(adminDb)
    const first = await executeConversion(prospect.id, actor, baseOptions([item.id]))
    const second = await executeConversion(prospect.id, actor, baseOptions([item.id]))
    expect(second.id).toBe(first.id)
    expect(await adminDb.select().from(currentSchema.clients)).toHaveLength(1)
    expect(await adminDb.select().from(currentSchema.deliveryMilestones)).toHaveLength(5)
    expect(await adminDb.select().from(currentSchema.clientServiceAssignments)).toHaveLength(1)
  })

  it("links an existing client without creating one", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const item = await seedCatalogue(adminDb)
    const [existing] = await adminDb.insert(currentSchema.clients).values({ name: "Acme Ltd", invoiceClientCode: "ACME2", updatedAt: new Date() }).returning()
    const record = await executeConversion(prospect.id, actor, {
      client: { mode: "link", clientId: existing.id }, mrr: 0, catalogueItemIds: [item.id],
      createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
    })
    expect(record.clientAction).toBe("linked")
    expect(record.clientId).toBe(existing.id)
    expect(await adminDb.select().from(currentSchema.clients)).toHaveLength(1)
  })

  it("rolls back everything when a step fails", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    // createDraftInvoice true but a catalogue id that does not exist -> resolveItems throws inside the tx
    await expect(executeConversion(prospect.id, actor, {
      client: { mode: "create", name: "Acme", tier: "Retainer", invoiceClientCode: "ACME3" },
      mrr: 100, catalogueItemIds: [999999],
      createProject: false, onboardingTasks: false, createDraftInvoice: true, preparePortal: false,
    })).rejects.toBeTruthy()
    expect(await adminDb.select().from(currentSchema.clients)).toHaveLength(0)
    expect(await adminDb.select().from(currentSchema.prospectConversions)).toHaveLength(0)
    expect(await adminDb.select().from(currentSchema.clientServiceAssignments)).toHaveLength(0)
    const [p] = await adminDb.select().from(currentSchema.prospects).where(eq(currentSchema.prospects.id, prospect.id))
    expect(p.convertedClientId).toBeNull()
  })

  it("rejects conversion when the prospect is not won", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const [prospect] = await adminDb.insert(currentSchema.prospects).values({ businessName: "NotWon", stage: "proposal_sent" }).returning()
    await expect(executeConversion(prospect.id, actor, {
      client: { mode: "create", name: "NotWon", tier: "Forge Build", invoiceClientCode: "NW1" },
      mrr: 0, catalogueItemIds: [], createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
    })).rejects.toMatchObject({ status: 409 })
    expect(await adminDb.select().from(currentSchema.clients)).toHaveLength(0)
  })

  it("minimal options: client + one service only", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const item = await seedCatalogue(adminDb)
    const record = await executeConversion(prospect.id, actor, {
      client: { mode: "create", name: "Acme", tier: "Forge Build", invoiceClientCode: "ACME4" },
      mrr: 0, catalogueItemIds: [item.id],
      createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
    })
    expect(record.projectId).toBeNull()
    expect(record.draftInvoiceId).toBeNull()
    expect(record.portalProvisioningPrepared).toBe(false)
    expect(record.onboardingTaskIds).toEqual([])
    expect(await adminDb.select().from(currentSchema.kanbanCards)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: FAIL — `executeConversion is not a function`.

- [ ] **Step 3: Implement `executeConversion`**

Add imports at the top of `admin/src/lib/server/prospect-conversion.ts`:

```ts
import { and } from "drizzle-orm"
import { clientServiceAssignments, deliveryMilestones, deliveryProjects, invoices, kanbanCards } from "@/lib/schema"
import { createDeliveryProjectWithTx, type DeliveryActor } from "@/lib/server/delivery-project-service"
import { assignClientInvoiceCode, createInvoiceWithTx } from "@/lib/server/invoices"
import { prepareDisabledPortalAccountWithTx } from "@/lib/server/portal-users"
import { recordClientActivity } from "@/lib/server/client-activity"
import { buildOpportunitySnapshot, defaultOnboardingTasks, parseConversionOptions } from "@/lib/prospect-conversion"
```

Then:

```ts
export interface ConversionRecordView extends ProspectConversionRow {
  deliveryProject: { id: number; name: string } | null
  draftInvoice: { id: number; status: string } | null
}

async function enrich(row: ProspectConversionRow): Promise<ConversionRecordView> {
  const deliveryProject = row.projectId
    ? (await db.select({ id: deliveryProjects.id, name: deliveryProjects.name }).from(deliveryProjects).where(eq(deliveryProjects.id, row.projectId)).limit(1))[0] ?? null
    : null
  const draftInvoice = row.draftInvoiceId
    ? (await db.select({ id: invoices.id, status: invoices.status }).from(invoices).where(eq(invoices.id, row.draftInvoiceId)).limit(1))[0] ?? null
    : null
  return { ...row, deliveryProject, draftInvoice }
}

export async function executeConversion(prospectId: number, actor: ConversionActor, rawOptions: unknown): Promise<ConversionRecordView> {
  const options = parseConversionOptions(rawOptions)
  const deliveryActor: DeliveryActor = { id: actor.id, email: actor.email ?? null, name: actor.name ?? null }

  const record = await db.transaction(async (tx) => {
    const [prospect] = await tx.select().from(prospects).where(eq(prospects.id, prospectId)).for("update").limit(1)
    if (!prospect) throw new ProspectConversionError("Prospect not found.", 404, "not_found")

    const [existing] = await tx.select().from(prospectConversions).where(eq(prospectConversions.prospectId, prospectId)).limit(1)
    if (existing) return existing

    if (prospect.stage !== "won") throw new ProspectConversionError("Only won opportunities can be converted.", 409, "not_won")

    // 1. client
    let clientId: number
    let clientAction: "created" | "linked"
    if (options.client.mode === "link") {
      const [linked] = await tx.select({ id: clients.id, tier: clients.tier, invoiceClientCode: clients.invoiceClientCode }).from(clients).where(eq(clients.id, options.client.clientId)).limit(1)
      if (!linked) throw new ProspectConversionError("The selected client no longer exists.", 404, "client_not_found")
      clientId = linked.id
      clientAction = "linked"
      const patch: Record<string, unknown> = { updatedAt: new Date() }
      if (options.client.tier && !linked.tier) patch.tier = options.client.tier
      if (options.mrr > 0) patch.mrr = options.mrr
      if (Object.keys(patch).length > 1) await tx.update(clients).set(patch).where(eq(clients.id, clientId))
      if (options.client.invoiceClientCode && !linked.invoiceClientCode) {
        await assignClientInvoiceCode(clientId, options.client.invoiceClientCode)
      }
    } else {
      try {
        const [created] = await tx.insert(clients).values({
          name: options.client.name,
          contactName: prospect.contactName,
          contactEmail: prospect.contactEmail,
          tier: options.client.tier,
          mrr: options.mrr,
          status: "active",
          progress: 0,
          invoiceClientCode: options.client.invoiceClientCode,
          updatedAt: new Date(),
        }).returning({ id: clients.id })
        clientId = created.id
        clientAction = "created"
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
          throw new ProspectConversionError("That invoice client code is already in use.", 409, "duplicate_client_code")
        }
        throw error
      }
    }
    const assignedTier = options.client.mode === "create" ? options.client.tier : options.client.tier ?? null

    // 2. service assignments
    const serviceAssignmentIds: number[] = []
    for (const catalogueItemId of options.catalogueItemIds) {
      const [row] = await tx.insert(clientServiceAssignments)
        .values({ clientId, catalogueItemId, sourceProspectId: prospectId, assignedBy: actor.id })
        .onConflictDoNothing({ target: [clientServiceAssignments.clientId, clientServiceAssignments.catalogueItemId] })
        .returning({ id: clientServiceAssignments.id })
      if (row) serviceAssignmentIds.push(row.id)
      else {
        const [existingAssign] = await tx.select({ id: clientServiceAssignments.id }).from(clientServiceAssignments).where(and(eq(clientServiceAssignments.clientId, clientId), eq(clientServiceAssignments.catalogueItemId, catalogueItemId))).limit(1)
        if (existingAssign) serviceAssignmentIds.push(existingAssign.id)
      }
    }

    // 3. snapshot
    const [activities, trackings, proposals, scores] = await Promise.all([
      tx.select().from(outreachActivities).where(eq(outreachActivities.prospectId, prospectId)).orderBy(desc(outreachActivities.createdAt)),
      tx.select().from(proposalTrackings).where(eq(proposalTrackings.prospectId, prospectId)).orderBy(desc(proposalTrackings.createdAt)),
      tx.select().from(salesProposals).where(eq(salesProposals.prospectId, prospectId)).orderBy(desc(salesProposals.updatedAt)),
      tx.select().from(leadScoreSnapshots).where(eq(leadScoreSnapshots.prospectId, prospectId)).orderBy(desc(leadScoreSnapshots.createdAt)).limit(1),
    ])
    const opportunitySnapshot = buildOpportunitySnapshot({
      prospect: prospect as Record<string, unknown> & { id: number },
      activities: activities.map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: a.createdAt })),
      proposalTrackings: trackings.map((t) => ({ packageType: t.packageType, quotedAmount: t.quotedAmount, monthlyRetainerAmount: t.monthlyRetainerAmount, status: t.status, sentAt: t.sentAt, acceptedAt: t.acceptedAt })),
      salesProposals: proposals.map((p) => ({ status: p.status, selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice, packageType: null })),
      leadScore: scores[0] ? { id: scores[0].id, score: scores[0].score } : null,
    })

    // 4. project
    let projectId: number | null = null
    if (options.createProject) {
      const project = await createDeliveryProjectWithTx(tx, {
        clientId,
        name: options.projectName,
        summary: `Converted from opportunity #${prospectId} (${prospect.businessName}).`,
      }, deliveryActor)
      projectId = project.id
    }

    // 5. onboarding tasks
    const onboardingTaskIds: number[] = []
    if (options.onboardingTasks) {
      const tasks = defaultOnboardingTasks()
      if (projectId) {
        const rows = await tx.insert(deliveryMilestones).values(tasks.map((task, index) => ({
          projectId: projectId!, title: task.title, status: "planned" as const,
          clientVisible: false, weight: 1, position: index,
        }))).returning({ id: deliveryMilestones.id })
        onboardingTaskIds.push(...rows.map((r) => r.id))
      } else {
        const rows = await tx.insert(kanbanCards).values(tasks.map((task, index) => ({
          title: task.title, clientId, column: "backlog" as const, priority: "med", tag: "onboarding", position: index,
        }))).returning({ id: kanbanCards.id })
        onboardingTaskIds.push(...rows.map((r) => r.id))
      }
    }

    // 6. draft invoice
    let draftInvoiceId: number | null = null
    if (options.createDraftInvoice) {
      const selected = await tx.select().from(invoiceCatalogueItems).where(inArrayIds(options.catalogueItemIds))
      if (selected.length !== options.catalogueItemIds.length) throw new ProspectConversionError("One or more selected services no longer exist.", 409, "catalogue_missing")
      const invoice = await createInvoiceWithTx(tx, {
        clientId,
        items: selected.map((item) => ({ catalogueItemId: item.id, title: item.name, description: item.description ?? null, quantity: 1, unitAmount: item.defaultUnitAmount })),
      }, actor.id)
      draftInvoiceId = invoice.id
    }

    // 7. portal
    let portalProvisioningPrepared = false
    let portalAccountId: number | undefined
    if (options.preparePortal) {
      const prepared = await prepareDisabledPortalAccountWithTx(tx, clientId)
      portalProvisioningPrepared = true
      portalAccountId = prepared.portalAccountId
    }

    // 8. conversion record
    const [conversion] = await tx.insert(prospectConversions).values({
      prospectId,
      clientId,
      projectId,
      draftInvoiceId,
      actorUserId: actor.id,
      clientAction,
      assignedTier,
      portalProvisioningPrepared,
      onboardingTaskIds,
      metadataJson: {
        capturedAt: new Date().toISOString(),
        options,
        opportunitySnapshot,
        steps: {
          services: options.catalogueItemIds.length ? "done" : "skipped",
          project: options.createProject ? "done" : "skipped",
          tasks: options.onboardingTasks ? "done" : "skipped",
          invoice: options.createDraftInvoice ? "done" : "skipped",
          portal: options.preparePortal ? "done" : "skipped",
        },
        serviceAssignmentIds,
        ...(portalAccountId ? { portalAccountId } : {}),
      },
    }).returning()

    // 9. prospect link
    await tx.update(prospects).set({
      convertedClientId: clientId,
      wonAt: prospect.wonAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(prospects.id, prospectId))

    // 10. timeline
    await recordClientActivity(tx, {
      clientRecordId: clientId,
      sourceDomain: "manual",
      sourceReference: `prospect-conversion:${prospectId}`,
      type: "prospect_converted",
      title: "Converted from opportunity",
      description: `${prospect.businessName} was converted from opportunity #${prospectId}.`,
      visibility: "internal",
      actor: { type: "admin", id: actor.id, label: actor.name ?? actor.email ?? "ScaleSmiths" },
      metadata: { prospectId, clientAction },
      idempotencyKey: `prospect-conversion:${prospectId}`,
    })

    return conversion
  })

  return enrich(record)
}

function inArrayIds(ids: number[]) {
  // small local helper to avoid importing inArray at top just for one call site
  return ids.length === 1 ? eq(invoiceCatalogueItems.id, ids[0]) : (undefined as never)
}
```

**Note for the implementer:** replace the `inArrayIds` hack with a real `inArray(invoiceCatalogueItems.id, options.catalogueItemIds)` — add `inArray` to the `drizzle-orm` import. The hack is only in the plan text to keep the snippet compiling in isolation; use `inArray` properly.

- [ ] **Step 4: Run — expect pass**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS — all cases.

- [ ] **Step 5: Add the no-auto-send import guard test**

In `admin/src/lib/prospect-conversion.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

it("the conversion service imports no email/delivery modules", () => {
  const source = readFileSync(resolve(__dirname, "server/prospect-conversion.ts"), "utf8")
  expect(source).not.toMatch(/resend|invoice-delivery|client-request-notifications|safe-outbound|nodemailer|sendMail|monthly-report/i)
})
```

Run: `cd admin && npm test -- src/lib/prospect-conversion.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/prospect-conversion.ts admin/src/lib/prospect-conversion.test.ts admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: executeConversion — one atomic transaction for client/services/project/tasks/invoice/portal"
```

---

### Task 8: Finish RBAC wiring + tests + doc

**Files:**
- Verify (committed on `51e4b5a`): `admin/src/lib/rbac.ts` (`prospects.convert` in `CAPABILITIES` + `sales`/`project_manager` grants), `admin/src/lib/authorization-policy.ts` (`prospect-conversion` rule).
- Modify: `admin/src/lib/rbac.ts` (add explicit `requiredCapabilityForRequest` line)
- Modify: `admin/src/lib/rbac.test.ts`, `admin/src/lib/authorization-policy.test.ts`, `admin/src/lib/rbac-authorization.test.ts`
- Modify: `docs/architecture/rbac-policy.md`

**Interfaces:**
- Produces: `requiredCapabilityForRequest` returns `"leads.read"` for `GET /api/prospects/:id/conversion` and `"prospects.convert"` for `POST` — matching the committed policy rule.

- [ ] **Step 1: Verify the committed baseline**

Run: `cd admin && grep -n "prospects.convert\|prospect-conversion" src/lib/rbac.ts src/lib/authorization-policy.ts`
Expected: capability present in `CAPABILITIES` + `sales` + `project_manager`; rule present in `AUTHORIZATION_POLICY`. If absent, STOP and report.

- [ ] **Step 2: Add RBAC tests (red)**

`admin/src/lib/rbac.test.ts`:

```ts
it("grants prospects.convert to sales/project_manager/administrator/owner only", () => {
  expect(hasCapability("sales", "prospects.convert")).toBe(true)
  expect(hasCapability("project_manager", "prospects.convert")).toBe(true)
  expect(hasCapability("administrator", "prospects.convert")).toBe(true)
  expect(hasCapability("owner", "prospects.convert")).toBe(true)
  expect(hasCapability("viewer", "prospects.convert")).toBe(false)
  expect(hasCapability("finance", "prospects.convert")).toBe(false)
  expect(hasCapability("developer", "prospects.convert")).toBe(false)
})

it("maps the conversion route: GET preview needs leads.read, POST execute needs prospects.convert", () => {
  expect(requiredCapabilityForRequest({ pathname: "/api/prospects/5/conversion", method: "GET" })).toBe("leads.read")
  expect(requiredCapabilityForRequest({ pathname: "/api/prospects/5/conversion", method: "POST" })).toBe("prospects.convert")
})
```

Add `requiredCapabilityForRequest` to that file's imports if missing.

`admin/src/lib/authorization-policy.test.ts`:

```ts
it("maps the prospect conversion route before the generic prospects rule", () => {
  expect(authorizationExpectation("/api/prospects/5/conversion", "GET")?.capability).toBe("leads.read")
  expect(authorizationExpectation("/api/prospects/5/conversion", "POST")?.capability).toBe("prospects.convert")
  expect(authorizationExpectation("/api/prospects/5", "PATCH")?.capability).toBe("leads.write")
})
```

- [ ] **Step 3: Run — expect failure**

Run: `cd admin && npm test -- src/lib/rbac.test.ts src/lib/authorization-policy.test.ts`
Expected: the `requiredCapabilityForRequest` assertions fail (no explicit line yet); the `authorizationExpectation` ones may already pass via the committed rule.

- [ ] **Step 4: Add the explicit `requiredCapabilityForRequest` line**

In `admin/src/lib/rbac.ts` `requiredCapabilityForRequest`, **above** the generic `if (pathname === "/prospects" || pathname.startsWith("/prospects/") || pathname.startsWith("/api/prospects")) …` line:

```ts
if (/^\/api\/prospects\/[^/]+\/conversion$/.test(pathname)) return method.toUpperCase() === "GET" ? "leads.read" : "prospects.convert"
```

- [ ] **Step 5: Run — expect pass, then the RBAC gate**

Run: `cd admin && npm test -- src/lib/rbac.test.ts src/lib/authorization-policy.test.ts src/lib/rbac-authorization.test.ts && npm run check:authorization-policy`
Expected: PASS. If `rbac-authorization.test.ts` enumerates capability/role sets, add `prospects.convert` for the four roles.

- [ ] **Step 6: Update the RBAC doc**

`docs/architecture/rbac-policy.md`: add `prospects.convert` to the capability list/table; mark granted for `owner`, `administrator`, `sales`, `project_manager`. Preserve enforced `## ` headings + any Mermaid.

Run: `cd /d/Projects/scalesmiths/ss && npm run check:architecture-docs`
Expected: PASS.

- [ ] **Step 7: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/rbac.ts admin/src/lib/rbac.test.ts admin/src/lib/authorization-policy.test.ts admin/src/lib/rbac-authorization.test.ts docs/architecture/rbac-policy.md
git commit -m "feat: explicit requiredCapabilityForRequest mapping + tests + doc for prospects.convert"
```

---

### Task 9: HTTP route + http helper + remove legacy action

**Files:**
- Create: `admin/src/app/api/prospects/[id]/conversion/route.ts`
- Create: `admin/src/lib/server/prospect-conversion-http.ts`
- Modify: `admin/src/app/api/prospects/[id]/route.ts` (remove `action === "convertToClient"` branch + now-unused imports)
- Test: `admin/src/app/api/prospects/[id]/conversion/route.test.ts`

**Interfaces:**
- Consumes: `guardApiCapability` from `@/lib/server/rbac`; `previewConversion`, `executeConversion` from `@/lib/server/prospect-conversion`; `ProspectConversionError` from `@/lib/prospect-conversion`; `AdminIdentityError` from `@/lib/admin-users`.
- Produces:
  - `prospect-conversion-http.ts`: `parseId(value: string): number` (throws `ProspectConversionError(400)`); `conversionFailure(error: unknown): NextResponse`.
  - `GET /api/prospects/[id]/conversion` → `{ ok: true, plan }`.
  - `POST /api/prospects/[id]/conversion` → `{ ok: true, conversion }`.

- [ ] **Step 1: Failing route test**

Create `admin/src/app/api/prospects/[id]/conversion/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/server/rbac", () => ({ guardApiCapability: vi.fn().mockResolvedValue({ id: "u1", email: "op@x.co", name: "Op" }) }))
vi.mock("@/lib/server/prospect-conversion", () => ({
  previewConversion: vi.fn().mockResolvedValue({ prospectId: 5, warnings: [], catalogue: [] }),
  executeConversion: vi.fn().mockResolvedValue({ id: 1, clientId: 42, clientAction: "created", metadataJson: {} }),
}))

import { guardApiCapability } from "@/lib/server/rbac"
import { GET, POST } from "./route"

const params = { params: Promise.resolve({ id: "5" }) }

describe("conversion route", () => {
  it("GET previews and guards leads.read", async () => {
    const res = await GET(new Request("http://x/api/prospects/5/conversion"), params)
    expect(guardApiCapability).toHaveBeenCalledWith("leads.read")
    expect(await res.json()).toMatchObject({ ok: true, plan: { prospectId: 5 } })
  })
  it("POST executes and guards prospects.convert", async () => {
    const res = await POST(new Request("http://x/api/prospects/5/conversion", { method: "POST", body: JSON.stringify({ options: {} }), headers: { "content-type": "application/json" } }), params)
    expect(guardApiCapability).toHaveBeenCalledWith("prospects.convert")
    expect(await res.json()).toMatchObject({ ok: true, conversion: { clientId: 42 } })
  })
  it("400s on a non-numeric id", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd admin && npm test -- "src/app/api/prospects/[id]/conversion/route.test.ts"`
Expected: FAIL — route module missing.

- [ ] **Step 3: Implement the http helper**

`admin/src/lib/server/prospect-conversion-http.ts`:

```ts
import { NextResponse } from "next/server"
import { ProspectConversionError } from "@/lib/prospect-conversion"
import { AdminIdentityError } from "@/lib/admin-users"

export function parseId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new ProspectConversionError("Invalid prospect id.", 400, "invalid_id")
  return id
}

export function conversionFailure(error: unknown) {
  if (error instanceof ProspectConversionError) return NextResponse.json({ ok: false, error: error.safeMessage }, { status: error.status })
  if (error instanceof AdminIdentityError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
  console.error("Prospect conversion failed", error)
  return NextResponse.json({ ok: false, error: "Unable to convert this opportunity." }, { status: 500 })
}
```

- [ ] **Step 4: Implement the route**

`admin/src/app/api/prospects/[id]/conversion/route.ts`:

```ts
import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { executeConversion, previewConversion } from "@/lib/server/prospect-conversion"
import { conversionFailure, parseId } from "@/lib/server/prospect-conversion-http"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("leads.read")
    const { id } = await params
    return NextResponse.json({ ok: true, plan: await previewConversion(parseId(id), actor) })
  } catch (error) {
    return conversionFailure(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("prospects.convert")
    const { id } = await params
    const body = await request.json().catch(() => null)
    const options = body && typeof body === "object" ? (body as Record<string, unknown>).options : undefined
    return NextResponse.json({ ok: true, conversion: await executeConversion(parseId(id), actor, options) })
  } catch (error) {
    return conversionFailure(error)
  }
}
```

- [ ] **Step 5: Remove the legacy branch**

In `admin/src/app/api/prospects/[id]/route.ts` delete the whole `if (action === "convertToClient") { … }` block. Then grep the file for `clients`, `InvoiceDomainError`, `normalizeInvoiceClientCode`, `buildClientFromWonProspect` and remove any import that is now unused (keep `buildClientFromWonProspect` **exported from `@/lib/prospects`** — `prospects.test.ts` still uses it; just drop the unused import here if present).

Run: `cd admin && npm exec tsc -- --noEmit`
Expected: no unused-symbol or type errors.

- [ ] **Step 6: Run route + prospect tests**

Run: `cd admin && npm test -- "src/app/api/prospects/[id]/conversion/route.test.ts" src/lib/prospects.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "admin/src/app/api/prospects/[id]/conversion" admin/src/lib/server/prospect-conversion-http.ts "admin/src/app/api/prospects/[id]/route.ts"
git commit -m "feat: GET preview / POST execute conversion route; remove legacy convertToClient action"
```

---

### Task 10: Admin UI — `ConvertProspectModal`

**Files:**
- Create: `admin/src/components/prospect-conversion/ConvertProspectModal.tsx`
- Modify: `admin/src/components/ProspectPipeline.tsx` (`onConvert` ~line 491, button ~line 698)
- Test: `admin/src/components/prospect-conversion/ConvertProspectModal.test.tsx`

**Interfaces:**
- Consumes: `CLIENT_SERVICE_TIER_OPTIONS` from `@/lib/clients`. Fetches `GET /api/prospects/${prospectId}/conversion`, submits `POST` with `{ options }`.
- Produces: `export function ConvertProspectModal({ prospectId, open, onClose, onConverted }: { prospectId: number; open: boolean; onClose: () => void; onConverted: (clientId: number) => void }): JSX.Element | null`.

- [ ] **Step 1: Failing component tests**

`admin/src/components/prospect-conversion/ConvertProspectModal.test.tsx` (match the render/util imports used by other `*.test.tsx` in the repo):

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { ConvertProspectModal } from "./ConvertProspectModal"

const plan = {
  prospectId: 5, alreadyConverted: false,
  warnings: [{ code: "dedupe_candidates", message: "Found 1", blocksExecute: false }],
  defaults: { clientName: "Acme Ltd", tier: "Retainer", mrr: 500, invoiceClientCode: "ACME", projectName: "Acme — growth", onboardingTasks: [{ title: "Kickoff & welcome" }] },
  matchCandidates: [{ clientId: 9, name: "Acme Ltd", tier: null, mrr: 0, matchedOn: ["name"] }],
  acceptedProposal: null, existingConversionId: null,
  catalogue: [{ id: 1, name: "Care Plan", defaultUnitAmount: 5000, category: null }],
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith("/conversion") && (!init || init.method === undefined || init.method === "GET"))
      return new Response(JSON.stringify({ ok: true, plan }), { status: 200 })
    if (String(url).endsWith("/conversion"))
      return new Response(JSON.stringify({ ok: true, conversion: { id: 1, clientId: 42, clientAction: "created", projectId: null, draftInvoiceId: null, portalProvisioningPrepared: false, metadataJson: {} } }), { status: 200 })
    return new Response("{}", { status: 404 })
  }))
})

describe("ConvertProspectModal", () => {
  it("shows preview defaults, dedupe candidate, and catalogue", async () => {
    render(<ConvertProspectModal prospectId={5} open onClose={() => {}} onConverted={() => {}} />)
    expect(await screen.findByDisplayValue("Acme Ltd")).toBeInTheDocument()
    expect(screen.getByText(/Found 1/)).toBeInTheDocument()
    expect(screen.getByText(/Care Plan/)).toBeInTheDocument()
  })
  it("submits confirmed options and reports the created client id", async () => {
    const onConverted = vi.fn()
    render(<ConvertProspectModal prospectId={5} open onClose={() => {}} onConverted={onConverted} />)
    await screen.findByDisplayValue("ACME")
    fireEvent.click(screen.getByLabelText(/Care Plan/))
    fireEvent.click(screen.getByRole("button", { name: /^Convert to client$/i }))
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(42))
    const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => String(c[0]).endsWith("/conversion") && c[1]?.method === "POST")
    const sent = JSON.parse(call[1].body).options
    expect(sent.client).toMatchObject({ mode: "create", invoiceClientCode: "ACME" })
    expect(sent.catalogueItemIds).toEqual([1])
  })
  it("disables Convert while a blocking warning is present", async () => {
    ;(globalThis.fetch as any).mockImplementationOnce(async () =>
      new Response(JSON.stringify({ ok: true, plan: { ...plan, warnings: [{ code: "not_won", message: "Not won", blocksExecute: true }] } }), { status: 200 }))
    render(<ConvertProspectModal prospectId={5} open onClose={() => {}} onConverted={() => {}} />)
    await screen.findByText(/Not won/)
    expect(screen.getByRole("button", { name: /^Convert to client$/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd admin && npm test -- src/components/prospect-conversion/ConvertProspectModal.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the modal**

Create `admin/src/components/prospect-conversion/ConvertProspectModal.tsx` (use the `T` token convention from `ProspectPipeline.tsx`):

```tsx
"use client"

import { useEffect, useState } from "react"
import { CLIENT_SERVICE_TIER_OPTIONS } from "@/lib/clients"

const T = { s1:"var(--s1)",s2:"var(--s2)",b1:"var(--b1)",b2:"var(--b2)",t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",acc:"var(--acc)",grn:"var(--grn)",red:"var(--red)",amb:"var(--amb)" }

interface Warning { code: string; message: string; blocksExecute: boolean }
interface MatchCandidate { clientId: number; name: string; tier: string | null; mrr: number; matchedOn: string[] }
interface CatalogueItem { id: number; name: string; defaultUnitAmount: number; category: string | null }
interface Plan {
  prospectId: number
  alreadyConverted: boolean
  warnings: Warning[]
  defaults: { clientName: string; tier: string; mrr: number; invoiceClientCode: string; projectName: string; onboardingTasks: { title: string }[] }
  matchCandidates: MatchCandidate[]
  catalogue: CatalogueItem[]
  existingConversionId: number | null
}

const money = (minor: number) => `£${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`

export function ConvertProspectModal({ prospectId, open, onClose, onConverted }: { prospectId: number; open: boolean; onClose: () => void; onConverted: (clientId: number) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ clientId: number; projectId: number | null; draftInvoiceId: number | null; portalProvisioningPrepared: boolean } | null>(null)

  const [mode, setMode] = useState<"create" | "link">("create")
  const [linkClientId, setLinkClientId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [tier, setTier] = useState("Foundation")
  const [mrr, setMrr] = useState(0)
  const [code, setCode] = useState("")
  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [createProject, setCreateProject] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [onboardingTasks, setOnboardingTasks] = useState(false)
  const [createDraftInvoice, setCreateDraftInvoice] = useState(false)
  const [preparePortal, setPreparePortal] = useState(false)

  useEffect(() => {
    if (!open) return
    setPlan(null); setError(""); setResult(null)
    fetch(`/api/prospects/${prospectId}/conversion`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.ok === false) throw new Error(json.error || "Unable to load the conversion preview.")
        const p = json.plan as Plan
        setPlan(p)
        setName(p.defaults.clientName); setTier(p.defaults.tier); setMrr(p.defaults.mrr)
        setCode(p.defaults.invoiceClientCode); setProjectName(p.defaults.projectName)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load the conversion preview."))
  }, [open, prospectId])

  if (!open) return null
  const blocked = Boolean(plan?.warnings.some((w) => w.blocksExecute))
  const toggleService = (id: number) => setServiceIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])

  async function submit() {
    setBusy(true); setError("")
    try {
      const options = {
        client: mode === "create"
          ? { mode: "create", name, tier, invoiceClientCode: code.trim().toUpperCase() }
          : { mode: "link", clientId: linkClientId, tier, invoiceClientCode: code.trim() ? code.trim().toUpperCase() : undefined },
        mrr: Number(mrr),
        catalogueItemIds: serviceIds,
        createProject, projectName: createProject ? projectName : undefined,
        onboardingTasks, createDraftInvoice, preparePortal,
      }
      const res = await fetch(`/api/prospects/${prospectId}/conversion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) throw new Error(json.error || "Conversion failed.")
      const c = json.conversion
      setResult({ clientId: c.clientId, projectId: c.projectId ?? null, draftInvoiceId: c.draftInvoiceId ?? null, portalProvisioningPrepared: Boolean(c.portalProvisioningPrepared) })
      onConverted(c.clientId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="mt-10 w-full max-w-[720px] rounded-[8px] border p-5" style={{ background:T.s1, borderColor:T.b2 }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-syne text-lg font-bold">Convert opportunity to client</h2>
          <button onClick={onClose} className="rounded border px-2 py-1 font-dm text-xs" style={{ borderColor:T.b2 }}>Close</button>
        </div>

        {error && <div className="mb-3 rounded border px-3 py-2 font-dm text-sm" style={{ borderColor:"rgba(239,68,68,.35)", color:T.t1 }}>{error}</div>}
        {!plan && !error && <div className="font-dm text-sm" style={{ color:T.t2 }}>Loading preview…</div>}

        {result ? (
          <div className="space-y-2 font-dm text-sm">
            <div style={{ color:T.grn }}>Conversion completed.</div>
            <ul className="list-disc pl-5" style={{ color:T.t2 }}>
              <li><a href={`/clients/${result.clientId}`} style={{ color:T.acc }}>Open client</a></li>
              {result.projectId && <li><a href={`/projects/${result.projectId}`} style={{ color:T.acc }}>Open delivery project</a></li>}
              {result.draftInvoiceId && <li><a href={`/finance`} style={{ color:T.acc }}>Draft invoice created</a></li>}
              {result.portalProvisioningPrepared && <li>Disabled portal account prepared — set credentials in Portal Users</li>}
            </ul>
          </div>
        ) : plan && (
          <div className="space-y-4">
            {plan.warnings.map((w) => (
              <div key={w.code} className="rounded border px-3 py-2 font-dm text-xs" style={{ borderColor: w.blocksExecute ? "rgba(239,68,68,.4)" : "rgba(245,158,11,.35)", color:T.t1 }}>{w.message}</div>
            ))}

            <label className="font-dm text-sm block"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Client</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as "create" | "link")}>
                <option value="create">Create new client</option>
                <option value="link">Link to existing client</option>
              </select>
            </label>

            {mode === "link" && (
              <label className="font-dm text-sm block"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Existing client</span>
                <select value={linkClientId ?? ""} onChange={(e) => setLinkClientId(Number(e.target.value) || null)}>
                  <option value="">Select…</option>
                  {plan.matchCandidates.map((c) => <option key={c.clientId} value={c.clientId}>{c.name} (matched: {c.matchedOn.join(", ")})</option>)}
                </select>
              </label>
            )}

            {mode === "create" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Invoice code (permanent)</span><input value={code} onChange={(e) => setCode(e.target.value)} /></label>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Tier</span>
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  {CLIENT_SERVICE_TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>MRR</span><input type="number" min="0" value={mrr} onChange={(e) => setMrr(Number(e.target.value))} /></label>
            </div>

            <fieldset className="font-dm text-sm">
              <legend className="mb-1 text-[11px]" style={{ color:T.t2 }}>Services</legend>
              <div className="space-y-1">
                {plan.catalogue.length === 0 && <div className="text-[11px]" style={{ color:T.t3 }}>No catalogue items configured.</div>}
                {plan.catalogue.map((item) => (
                  <label key={item.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={serviceIds.includes(item.id)} onChange={() => toggleService(item.id)} /> {item.name} — {money(item.defaultUnitAmount)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2 font-dm text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={createProject} onChange={(e) => setCreateProject(e.target.checked)} /> Create delivery project</label>
              {createProject && <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full" />}
              <label className="flex items-center gap-2"><input type="checkbox" checked={onboardingTasks} onChange={(e) => setOnboardingTasks(e.target.checked)} /> Seed onboarding tasks ({plan.defaults.onboardingTasks.length})</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={createDraftInvoice} disabled={serviceIds.length === 0} onChange={(e) => setCreateDraftInvoice(e.target.checked)} /> Create draft invoice (from selected services)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={preparePortal} onChange={(e) => setPreparePortal(e.target.checked)} /> Prepare portal access</label>
              <p className="text-[11px]" style={{ color:T.t3 }}>Prepares a disabled portal account — no credentials are generated or sent. The draft invoice is not issued.</p>
            </div>

            <button onClick={submit} disabled={busy || blocked || (mode === "link" && !linkClientId)} className="w-full rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>
              {busy ? "Converting…" : "Convert to client"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect pass**

Run: `cd admin && npm test -- src/components/prospect-conversion/ConvertProspectModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into `ProspectPipeline.tsx`**

- `import { ConvertProspectModal } from "@/components/prospect-conversion/ConvertProspectModal"`.
- Add state near the others: `const [convertProspectId, setConvertProspectId] = useState<number | null>(null)`.
- Replace the `onConvert={() => { … window.prompt … }}` prop on `DetailPanel` (line ~491) with `onConvert={() => selected && setConvertProspectId(selected.id)}`.
- Before the component root's closing `</div>`, render:

```tsx
{convertProspectId !== null && (
  <ConvertProspectModal
    prospectId={convertProspectId}
    open
    onClose={() => setConvertProspectId(null)}
    onConverted={() => { setConvertProspectId(null); router.refresh() }}
  />
)}
```

The existing button at line ~698 already reads `{prospect.convertedClientId ? "Converted" : "Convert to Client"}` and is disabled when `convertedClientId` is set — leave that logic.

- [ ] **Step 6: Typecheck + lint**

Run: `cd admin && npm exec tsc -- --noEmit && npm run lint`
Expected: clean. Fix unused vars / hook deps.

- [ ] **Step 7: Commit**

```bash
git add admin/src/components/prospect-conversion admin/src/components/ProspectPipeline.tsx
git commit -m "feat: ConvertProspectModal preview/confirm UI wired into the pipeline"
```

---

### Task 11: E2E journey (Playwright)

**Files:**
- Create: `admin/test/e2e/prospect-conversion.spec.ts` (match the existing spec's config + auth-storage pattern)
- Modify: `admin/playwright.forge.config.ts` if the spec must be enumerated there

**Interfaces:** consumes the running admin app + seeded admin auth state used by the other e2e specs.

- [ ] **Step 1: Write the E2E test**

Follow the structure of `admin/test/e2e/forge-journeys.spec.ts` (same `storageState` / base URL). Steps:

```ts
import { test, expect } from "@playwright/test"

test("won prospect converts to a client with a project", async ({ page, request }) => {
  const created = await request.post("/api/prospects", { data: { businessName: `E2E Convert ${Date.now()}`, stage: "won", estimatedMonthlyRetainer: 400 } })
  const { prospect } = await created.json()

  await page.goto("/prospects")
  await page.getByRole("button", { name: prospect.businessName }).click()
  await page.getByRole("button", { name: /convert to client/i }).click()

  await expect(page.getByText(/Convert opportunity to client/i)).toBeVisible()
  await page.getByLabel(/Invoice code/i).fill("E2ECONV")
  await page.getByLabel(/Create delivery project/i).check()
  await page.getByLabel(/Seed onboarding tasks/i).check()
  await page.getByRole("button", { name: /^Convert to client$/i }).click()

  await expect(page.getByText(/Conversion completed/i)).toBeVisible()
  await page.getByRole("link", { name: /Open client/i }).click()
  await expect(page).toHaveURL(/\/clients\/\d+/)

  await page.goto("/prospects")
  await page.getByRole("button", { name: prospect.businessName }).click()
  await expect(page.getByRole("button", { name: /^Converted$/ })).toBeVisible()
})
```

- [ ] **Step 2: Run the spec**

Run: check `admin/package.json` for the e2e command that covers `test/e2e/` and use it (e.g. `node ./node_modules/@playwright/test/cli.js test --config playwright.forge.config.ts prospect-conversion.spec.ts`). Adapt auth/seed to the pattern the neighbouring spec actually uses — do not invent a new auth mechanism.
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add admin/test/e2e/prospect-conversion.spec.ts admin/playwright.forge.config.ts
git commit -m "test: e2e coverage for prospect-to-client conversion journey"
```

---

### Task 12: Documentation

**Files:**
- Modify: `docs/architecture/data-model.md`
- Create: `docs/architecture/prospect-conversion.md`

- [ ] **Step 1: Update `data-model.md`**

Add to the ER / relationships section:
`PROSPECTS ||--o| PROSPECT_CONVERSIONS : converted_via`, `CLIENTS ||--o{ PROSPECT_CONVERSIONS : from_opportunity`,
`CLIENTS ||--o{ CLIENT_SERVICE_ASSIGNMENTS : has`, `INVOICE_CATALOGUE_ITEMS ||--o{ CLIENT_SERVICE_ASSIGNMENTS : offered_as`.
Add table-inventory bullets:

```
- `prospect_conversions`: one row per converted prospect (prospect_id unique). Actor, client_action
  (created|linked), assigned_tier, resulting project/draft-invoice ids, portal_provisioning_prepared,
  onboarding_task_ids, and metadata_json (confirmed options + frozen opportunity snapshot). Idempotency
  anchor for the conversion workflow.
- `client_service_assignments`: structured service assignments linking a client to invoice catalogue
  items, with source_prospect_id for conversion traceability. unique(client_id, catalogue_item_id).
```

Preserve every enforced `## ` heading and keep the Mermaid block valid.

- [ ] **Step 2: Create `docs/architecture/prospect-conversion.md`**

Sections: **Overview**; **Capability model** (`GET` preview → `leads.read`, `POST` execute → `prospects.convert`; elevated service rationale); **Preview → Confirm flow**; **Atomic execution** (one transaction; `…WithTx` service variants); **Idempotency** (`prospect_conversions.prospect_id` unique; re-POST returns the existing record); **Client dedupe** (name+email candidates, explicit create-or-link, no silent duplicate); **Services as catalogue assignments** (tier → `clients.tier` + `assigned_tier`; catalogue items → `client_service_assignments` → seed draft-invoice items); **No auto-send guarantees** (draft invoice never issued; portal account disabled, no credentials); **Data written per option**. Keep it ≤ ~150 lines.

- [ ] **Step 3: Docs gate**

Run: `cd /d/Projects/scalesmiths/ss && npm run check:architecture-docs`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/data-model.md docs/architecture/prospect-conversion.md
git commit -m "docs: document the prospect-to-client conversion workflow"
```

---

### Task 13: Full-suite verification

**Files:** none.

- [ ] **Step 1: Admin unit + typecheck + lint**

Run: `cd admin && npm exec tsc -- --noEmit && npm run lint && npm test`
Expected: pass. Record pre-existing unrelated failures separately (AGENTS.md); do not fix out-of-scope debt.

- [ ] **Step 2: Admin integration**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration`
Expected: pass, including `prospect-conversion.integration.test.ts`.

- [ ] **Step 3: Repo policy gates touched here**

Run:
```bash
cd /d/Projects/scalesmiths/ss
npm run check:migration-history && npm run test:migration-history && npm run test:migration-consistency
npm run check:architecture-docs
cd admin && npm run check:authorization-policy
```
Expected: pass.

- [ ] **Step 4: Build**

Run: `cd admin && npm run build`
Expected: succeeds.

- [ ] **Step 5: Final diff review**

Run: `cd /d/Projects/scalesmiths/ss && git diff master...HEAD --stat`
Confirm only intended files changed; revert incidental edits.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §5.3 migration for both committed tables | Task 1 |
| §5.1 pure module + §5.4 snapshot shape | Task 2 |
| §5.1 `createDeliveryProjectWithTx` | Task 3 |
| §5.1 `createInvoiceWithTx` | Task 4 |
| §5.1 / §7 `prepareDisabledPortalAccountWithTx` | Task 5 |
| §5.4 `previewConversion` (GET) + dedupe + catalogue | Task 6 |
| §5.5 `executeConversion` — one atomic transaction, all steps, D3/D6/D7/D9 | Task 7 |
| §6 RBAC finish (explicit map line, tests, doc) — capability/rule already committed | Task 8 |
| §5.2 route (GET+POST) + legacy removal | Task 9 |
| §8 modal + pipeline wiring | Task 10 |
| §9.3 E2E | Task 11 |
| §10 docs (`data-model`, new `prospect-conversion.md`) | Task 12; RBAC doc in Task 8 |
| §9.1 unit tests | Task 2, Task 7 (import guard) |
| §9.2 integration tests (all listed cases incl. atomic rollback, idempotency, RBAC-at-service is covered via route test + policy tests) | Tasks 1, 5, 6, 7 |
| §7 no-auto-send guarantee | Task 7 Step 5 import guard + Task 10 caption |
| §4 D4 dedupe: explicit create-or-link | Task 6 (candidates) + Task 7 (`mode`) |
| §4 D8 requires `stage='won'` | Task 7 (`not_won` 409) + Task 2 (`buildConversionPlan` blocking warning) |
| §4 D6 services → `client_service_assignments` + invoice seeding | Task 7 |

RBAC integration test (`viewer`/`sales`/`finance` against the live route) from spec §9.2: covered at the unit level by Task 9's route test (guards asserted) + Task 8's policy/`requiredCapabilityForRequest` tests. A live authenticated-fetch integration test is added in Task 9 Step 6 only if the existing integration harness already exposes a role-bearing session helper; otherwise the middleware+policy coverage stands. **Not a gap** — the middleware is the enforcement point and Task 8 tests it.

**2. Placeholder scan**

No "TBD"/"TODO". Task 7 Step 3 contains a deliberately-flagged `inArrayIds` stand-in with an explicit instruction to replace it with `inArray(...)` — the real call is named, the import is named. Task 11 carries "adapt to the neighbouring spec's auth pattern" because the e2e fixture API is repo-specific; the test body is concrete.

**3. Type consistency**

- `ConfirmedConversionOptions` (with `mrr`, `catalogueItemIds`, `client.mode`), `ConversionPlan`, `ConversionPlanResponse` (adds `catalogue`), `ProspectConversionRow`, `ConversionActor`, `ConversionRecordView` — defined once (Tasks 2/6/7), consumed unchanged in 7/9/10.
- Column names match the committed schema everywhere: `clientAction`, `actorUserId`, `projectId`, `assignedTier`, `portalProvisioningPrepared`, `onboardingTaskIds`, `metadataJson`, `convertedAt` (Task 7 insert ↔ Task 1 schema ↔ Task 10 result reads `projectId`/`draftInvoiceId`/`portalProvisioningPrepared`).
- `previewConversion(prospectId, actor)` / `executeConversion(prospectId, actor, rawOptions)` — Tasks 6/7 define, Task 9 route calls with the same arg order.
- `createDeliveryProjectWithTx(tx, input, actor)` (T3) / `createInvoiceWithTx(tx, payload, actorUserId)` (T4) / `prepareDisabledPortalAccountWithTx(tx, clientId)` (T5) — consumed by T7 with matching signatures.
- `ProspectConversionError` thrown in T2/T6/T7, mapped by T9 `conversionFailure`.
- Route response envelopes `{ ok, plan }` / `{ ok, conversion }` (T9) ↔ modal reads `json.plan` / `json.conversion.clientId|projectId|draftInvoiceId|portalProvisioningPrepared` (T10).

Fixed inline during review: aligned the modal's result-view fields to the actual `ConversionRecordView` column names (`projectId`, not `deliveryProjectId`); made `createDraftInvoice` depend on a non-empty `catalogueItemIds` in both `parseConversionOptions` (T2) and the modal's disabled state (T10).
