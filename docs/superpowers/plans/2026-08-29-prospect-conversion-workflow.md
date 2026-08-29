# Prospect → Client Conversion Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single, idempotent, RBAC-protected admin action that converts a won prospect into a client — creating or linking the client, freezing an opportunity snapshot, and optionally creating a delivery project, onboarding tasks, a draft invoice, and a disabled portal account — behind a preview/confirm UI.

**Architecture:** A new orchestration service (`admin/src/lib/server/prospect-conversion.ts`) calls existing client/project/invoice/portal services. Pure helpers live in `admin/src/lib/prospect-conversion.ts`. A new admin-owned `prospect_conversions` table (one row per prospect, `prospect_id` UNIQUE) is the idempotency anchor and holds the immutable snapshot + per-step status. Execution is "core atomic" (client + record + timeline + project + tasks in one transaction) then best-effort post-commit steps (invoice, portal) with per-step resume. A new `leads.convert` capability gates both HTTP routes; the service runs elevated once entered.

**Tech Stack:** Next.js 15.5.22 (App Router, Node runtime), Drizzle ORM + drizzle-kit, PostgreSQL, Vitest (unit + `test:integration`), Playwright (`test/e2e`), bcryptjs.

**Spec:** `docs/superpowers/specs/2026-08-29-prospect-conversion-workflow-design.md`

## Global Constraints

- Node `>=22 <23`, npm `~10.9`. Next.js pinned at **15.5.22** — do not bump governed deps.
- Two npm contexts here: run app commands from `admin/`. Typecheck is `npm exec tsc -- --noEmit` (there is no `npm run typecheck`).
- Migrations: **admin owns** `prospects`, `clients`, `prospect_conversions`. `portal_client_accounts` is **web-owned** — never generate an admin migration touching it; only the admin *runtime* may write it (precedent: `createPortalUser`).
- Never edit a committed migration. New migration files must be registered in `scripts/migration-checksums.json` (`forwardMigrations` + `journals.admin.appendedEntries`) or `check:migration-history` fails.
- RBAC / authorization / financial logic are protected areas: do not convert an auth/authz failure into permissive behaviour. Every RBAC change updates `admin/src/lib/authorization-policy.test.ts`, `admin/src/lib/rbac.test.ts`, `admin/src/lib/rbac-authorization.test.ts`.
- **No auto-send:** the conversion code path must not import or call any email / Resend / invoice-delivery / notification module. Draft invoices stay `status:'draft'`. Portal accounts are created `active=false` with a discarded random hash; no password is returned, no email sent.
- Money values are integer minor units already used by `clients.mrr` / invoice amounts (GBP, no decimals in these tables).
- Follow existing style: no semicolons, 2-space indent, `T` style-token object in components, `db.transaction(async (tx) => …)` pattern, domain error classes with `safeMessage`.

---

### Task 1: `prospect_conversions` table + migration

**Files:**
- Modify: `admin/src/lib/schema.ts` (add table near `prospects`, ~line 684)
- Create: `admin/drizzle/0055_prospect_conversions.sql` (generated, then renamed)
- Modify: `admin/drizzle/meta/_journal.json` (generated)
- Modify: `admin/drizzle/meta/0055_snapshot.json` (generated)
- Modify: `scripts/migration-checksums.json` (repo root)
- Test: `admin/test/integration/prospect-conversion.integration.test.ts` (new — first test only)

**Interfaces:**
- Produces: `prospectConversions` Drizzle table export with columns:
  `id`, `prospectId`, `clientId`, `deliveryProjectId`, `draftInvoiceId`, `portalAccountId`,
  `linkMode` (`'created'|'linked'`), `convertedBy`, `convertedAt`, `optionsJson`,
  `opportunitySnapshotJson`, `stepsJson`, `status` (`'completed'|'partial'`),
  `createdAt`, `updatedAt`.
- Produces: types `ProspectConversionRow = typeof prospectConversions.$inferSelect`.

- [ ] **Step 1: Add the table to `schema.ts`**

Insert after the `prospects` table block (after line 684):

```ts
export const prospectConversions = pgTable("prospect_conversions", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id").references(() => prospects.id, { onDelete: "restrict" }).notNull(),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }).notNull(),
  deliveryProjectId: integer("delivery_project_id").references(() => deliveryProjects.id, { onDelete: "set null" }),
  draftInvoiceId: integer("draft_invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  // Row id in the web-owned portal_client_accounts table. No cross-ownership FK.
  portalAccountId: integer("portal_account_id"),
  linkMode: text("link_mode").notNull(),
  convertedBy: uuid("converted_by").references(() => adminUsers.id, { onDelete: "set null" }),
  convertedAt: timestamp("converted_at", { withTimezone: true }).defaultNow().notNull(),
  optionsJson: jsonb("options_json").$type<Record<string, unknown>>().notNull(),
  opportunitySnapshotJson: jsonb("opportunity_snapshot_json").$type<Record<string, unknown>>().notNull(),
  stepsJson: jsonb("steps_json").$type<Record<string, string>>().default({}).notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("prospect_conversions_prospect_idx").on(table.prospectId),
  index("prospect_conversions_client_idx").on(table.clientId),
  check("prospect_conversions_link_mode_check", sql`${table.linkMode} in ('created','linked')`),
  check("prospect_conversions_status_check", sql`${table.status} in ('completed','partial')`),
])
```

Confirm `uniqueIndex`, `index`, `check`, `sql`, `jsonb`, `uuid` are already imported at the top of `schema.ts` (they are used by neighbouring tables — no new imports expected).

- [ ] **Step 2: Generate the migration**

Run: `cd admin && npm run db:generate`
Expected: creates `admin/drizzle/0055_<random>.sql` + `admin/drizzle/meta/0055_snapshot.json` + appends idx 55 to `admin/drizzle/meta/_journal.json`.

- [ ] **Step 3: Rename the migration file for a stable tag**

```bash
cd admin/drizzle
mv 0055_*.sql 0055_prospect_conversions.sql
```
Then edit `admin/drizzle/meta/_journal.json`: set the `"tag"` of the idx-55 entry to `"0055_prospect_conversions"`. Leave `when`/`version`/`breakpoints` as generated.

- [ ] **Step 4: Inspect the generated SQL**

Open `admin/drizzle/0055_prospect_conversions.sql`. Expected: one `CREATE TABLE "prospect_conversions" (...)` with the four FKs (`ON DELETE restrict` for prospect + client, `ON DELETE set null` for delivery_project + invoice + admin_users), the two check constraints, a unique index on `prospect_id`, and an index on `client_id`. No `ALTER`/`DROP` on any existing table. If anything else appears, stop and reconcile the schema edit.

- [ ] **Step 5: Register the migration in the checksum manifest**

Compute the hash:
```bash
cd /d/Projects/scalesmiths/ss
node -e "const{createHash}=require('crypto');const fs=require('fs');console.log(createHash('sha256').update(fs.readFileSync('admin/drizzle/0055_prospect_conversions.sql')).digest('hex'))"
```
In `scripts/migration-checksums.json`:
1. Append to `forwardMigrations`:
```json
{
  "path": "admin/drizzle/0055_prospect_conversions.sql",
  "sha256": "<hash from above>",
  "lifecycle": "forward",
  "reason": "Adds prospect_conversions: the idempotency anchor and immutable audit record for the controlled prospect-to-client conversion workflow (actor, chosen options, resulting client/project/invoice/portal ids, per-step status, frozen opportunity snapshot)."
}
```
2. Append to `journals.admin.appendedEntries` a copy of the idx-55 entry now in `admin/drizzle/meta/_journal.json` (same `idx`, `version`, `when`, `tag`, `breakpoints`).

- [ ] **Step 6: Run the migration-history gates**

Run: `cd /d/Projects/scalesmiths/ss && npm run check:migration-history && npm run test:migration-history && npm run test:migration-consistency`
Expected: all pass. If "Unregistered migration" or "journal entries do not match the manifest" — fix the manifest entry to match the journal byte-for-byte.

- [ ] **Step 7: Write the first integration test (table exists + shape)**

Create `admin/test/integration/prospect-conversion.integration.test.ts`. Copy the `beforeAll`/`beforeEach`/`afterAll` harness structure from `admin/test/integration/postgres.integration.test.ts` (same role URLs, `provision-postgres-roles.mjs`, web-then-admin `migrate(...)`, table truncation in `beforeEach`). Then:

```ts
import { prospectConversions } from "../../src/lib/schema"

describe("prospect_conversions schema", () => {
  it("accepts a minimal row and rejects a bad link_mode", async () => {
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const [prospect] = await adminDb.insert(currentSchema.prospects).values({ businessName: "Acme", stage: "won" }).returning()
    const [client] = await adminDb.insert(currentSchema.clients).values({ name: "Acme", updatedAt: new Date() }).returning()
    const [row] = await adminDb.insert(prospectConversions).values({
      prospectId: prospect.id, clientId: client.id, linkMode: "created",
      optionsJson: {}, opportunitySnapshotJson: {}, status: "completed",
    }).returning()
    expect(row.stepsJson).toEqual({})
    await expect(adminDb.insert(prospectConversions).values({
      prospectId: prospect.id, clientId: client.id, linkMode: "bogus",
      optionsJson: {}, opportunitySnapshotJson: {}, status: "completed",
    }).returning()).rejects.toThrow()
  })
})
```

- [ ] **Step 8: Run the integration test**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS (Docker Postgres comes up via the harness). If the runner needs the full config, use `cd admin && npm run test:integration -- test/integration/prospect-conversion.integration.test.ts`.

- [ ] **Step 9: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`
Expected: no errors.

```bash
cd /d/Projects/scalesmiths/ss
git add admin/src/lib/schema.ts admin/drizzle/0055_prospect_conversions.sql admin/drizzle/meta/_journal.json admin/drizzle/meta/0055_snapshot.json scripts/migration-checksums.json admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: add prospect_conversions table for controlled conversion workflow"
```

---

### Task 2: Pure conversion module (`prospect-conversion.ts`)

**Files:**
- Create: `admin/src/lib/prospect-conversion.ts`
- Test: `admin/src/lib/prospect-conversion.test.ts`

**Interfaces:**
- Consumes: `ClientServiceTier`, `CLIENT_SERVICE_TIERS`, `isClientServiceTier`, `CLIENT_FORGE_BUILD_TIER`, `CLIENT_RETAINER_TIER` from `@/lib/clients`; `normalizeInvoiceClientCode` from `@/lib/invoices`.
- Produces:
  - `class ProspectConversionError extends Error` with `safeMessage: string`, `status: number`, `code: string`.
  - `interface ClientCreateOption { mode: "create"; name: string; tier: ClientServiceTier; mrr: number; invoiceClientCode: string }`
  - `interface ClientLinkOption { mode: "link"; clientId: number; invoiceClientCode?: string }`
  - `type ClientOption = ClientCreateOption | ClientLinkOption`
  - `interface ConfirmedConversionOptions { client: ClientOption; createProject: boolean; projectName?: string; onboardingTasks: boolean; createDraftInvoice: boolean; preparePortal: boolean }`
  - `type ConversionStepState = "done" | "skipped" | string` (error states are `` `error:${msg}` ``)
  - `interface ConversionSteps { project: ConversionStepState; tasks: ConversionStepState; invoice: ConversionStepState; portal: ConversionStepState }`
  - `interface OpportunitySnapshot { … }` (shape below)
  - `interface ClientMatchCandidate { clientId: number; name: string; tier: string | null; mrr: number; matchedOn: Array<"name" | "email" | "website"> }`
  - `interface AcceptedProposalSummary { source: "proposal_tracking" | "sales_proposal"; packageType: string; selectedServices: string | null; buildPrice: number; retainerPrice: number }`
  - `interface ConversionWarning { code: "not_won" | "already_converted" | "dedupe_candidates" | "no_accepted_proposal"; message: string; blocksExecute: boolean }`
  - `interface ConversionPlan { prospectId: number; alreadyConverted: boolean; warnings: ConversionWarning[]; defaults: { clientName: string; tier: ClientServiceTier; mrr: number; invoiceClientCode: string; projectName: string; onboardingTasks: Array<{ title: string }>; invoiceItems: Array<{ title: string; quantity: number; unitAmount: number }> }; matchCandidates: ClientMatchCandidate[]; acceptedProposal: AcceptedProposalSummary | null; existingConversion: null | { status: string; steps: ConversionSteps; clientId: number; deliveryProjectId: number | null; draftInvoiceId: number | null; portalAccountId: number | null } }`
  - Functions:
    - `parseConversionOptions(input: unknown): ConfirmedConversionOptions`
    - `assertOptionsUnchanged(persisted: unknown, incoming: ConfirmedConversionOptions): void`
    - `defaultOnboardingTasks(): Array<{ title: string }>`
    - `deriveTier(mrr: number): ClientServiceTier`
    - `suggestInvoiceClientCode(name: string): string`
    - `normaliseName(value: string | null | undefined): string`
    - `normaliseHost(url: string | null | undefined): string`
    - `matchExistingClients(prospect: { businessName: string; contactEmail: string | null; websiteUrl: string | null }, clients: Array<{ id: number; name: string; contactEmail: string | null; websiteUrl?: string | null; tier: string | null; mrr: number }>): ClientMatchCandidate[]`
    - `buildOpportunitySnapshot(input: SnapshotInput): OpportunitySnapshot`
    - `buildConversionPlan(input: PlanInput): ConversionPlan`
    - `computeConversionStatus(options: ConfirmedConversionOptions, steps: ConversionSteps): "completed" | "partial"`

- [ ] **Step 1: Write failing tests**

Create `admin/src/lib/prospect-conversion.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  ProspectConversionError,
  parseConversionOptions,
  assertOptionsUnchanged,
  defaultOnboardingTasks,
  deriveTier,
  suggestInvoiceClientCode,
  matchExistingClients,
  buildOpportunitySnapshot,
  buildConversionPlan,
  computeConversionStatus,
} from "./prospect-conversion"

const createOptions = {
  client: { mode: "create", name: "Acme Ltd", tier: "Retainer", mrr: 500, invoiceClientCode: "ACME" },
  createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
} as const

describe("parseConversionOptions", () => {
  it("accepts a valid create payload", () => {
    expect(parseConversionOptions(createOptions).client).toMatchObject({ mode: "create", invoiceClientCode: "ACME" })
  })
  it("rejects createProject without projectName", () => {
    expect(() => parseConversionOptions({ ...createOptions, createProject: true })).toThrow(ProspectConversionError)
  })
  it("rejects an unknown tier", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { ...createOptions.client, tier: "Platinum" } })).toThrow(/tier/i)
  })
  it("rejects a negative mrr", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { ...createOptions.client, mrr: -1 } })).toThrow(ProspectConversionError)
  })
  it("rejects a malformed invoiceClientCode on create", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { ...createOptions.client, invoiceClientCode: "a" } })).toThrow(/code/i)
  })
  it("rejects link mode without clientId", () => {
    expect(() => parseConversionOptions({ ...createOptions, client: { mode: "link" } })).toThrow(ProspectConversionError)
  })
})

describe("assertOptionsUnchanged", () => {
  it("passes for equal options", () => {
    expect(() => assertOptionsUnchanged(createOptions, parseConversionOptions(createOptions))).not.toThrow()
  })
  it("throws 409 when a toggle differs", () => {
    try {
      assertOptionsUnchanged(createOptions, parseConversionOptions({ ...createOptions, preparePortal: true }))
      throw new Error("should have thrown")
    } catch (error) {
      expect(error).toBeInstanceOf(ProspectConversionError)
      expect((error as ProspectConversionError).status).toBe(409)
    }
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
    const titles = defaultOnboardingTasks().map((task) => task.title)
    expect(titles).toEqual([
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
    { id: 1, name: "Acme Ltd", contactEmail: "hi@acme.com", websiteUrl: "https://acme.com", tier: "Retainer", mrr: 500 },
    { id: 2, name: "Globex", contactEmail: null, websiteUrl: "https://globex.io", tier: null, mrr: 0 },
  ]
  it("matches on normalised name", () => {
    const result = matchExistingClients({ businessName: "ACME  ltd.", contactEmail: null, websiteUrl: null }, clients)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ clientId: 1, matchedOn: ["name"] })
  })
  it("matches on email and website host together", () => {
    const result = matchExistingClients({ businessName: "Nope", contactEmail: "HI@ACME.COM", websiteUrl: "http://www.acme.com/x" }, clients)
    expect(result[0]).toMatchObject({ clientId: 1 })
    expect(result[0].matchedOn.sort()).toEqual(["email", "website"])
  })
  it("returns [] on no match", () => {
    expect(matchExistingClients({ businessName: "Zzz", contactEmail: "z@z.z", websiteUrl: "https://z.z" }, clients)).toEqual([])
  })
})

describe("buildOpportunitySnapshot", () => {
  it("caps activities at 50 and resolves the accepted proposal", () => {
    const snapshot = buildOpportunitySnapshot({
      prospect: { id: 7, businessName: "Acme", stage: "won", source: "referral", priority: "high", estimatedProjectValue: 9000, estimatedMonthlyRetainer: 500, revenueScore: 5, trustScore: 5, conversionScore: 5, seoScore: 5, mobileScore: 5, contactName: null, contactEmail: null, contactPhone: null, websiteUrl: null, location: null, industry: null, auditSummary: null, painPoints: null, opportunityNotes: null, objectionNotes: null, wonAt: new Date("2026-08-01"), createdAt: new Date("2026-07-01") },
      activities: Array.from({ length: 60 }, (_, i) => ({ type: "email", direction: "outbound", subject: `s${i}`, outcome: null, createdAt: new Date() })),
      proposalTrackings: [{ packageType: "growth", quotedAmount: 9000, monthlyRetainerAmount: 500, status: "accepted", sentAt: new Date(), acceptedAt: new Date() }],
      salesProposals: [],
      leadScore: { id: 3, score: 82 },
    })
    expect(snapshot.outreach.count).toBe(60)
    expect(snapshot.outreach.lastActivities).toHaveLength(50)
    expect(snapshot.acceptedProposal).toMatchObject({ source: "proposal_tracking", packageType: "growth" })
    expect(snapshot.leadScore).toEqual({ snapshotId: 3, score: 82 })
  })
  it("falls back to an accepted sales_proposal, else null", () => {
    const base = { prospect: { id: 1, businessName: "A", stage: "won", source: "inbound", priority: "low", estimatedProjectValue: 0, estimatedMonthlyRetainer: 0, revenueScore: 0, trustScore: 0, conversionScore: 0, seoScore: 0, mobileScore: 0, contactName: null, contactEmail: null, contactPhone: null, websiteUrl: null, location: null, industry: null, auditSummary: null, painPoints: null, opportunityNotes: null, objectionNotes: null, wonAt: null, createdAt: new Date() }, activities: [], proposalTrackings: [], leadScore: null }
    expect(buildOpportunitySnapshot({ ...base, salesProposals: [{ status: "accepted", selectedServices: "SEO", buildPrice: 4000, retainerPrice: 250, packageType: null }] }).acceptedProposal).toMatchObject({ source: "sales_proposal", selectedServices: "SEO" })
    expect(buildOpportunitySnapshot({ ...base, salesProposals: [] }).acceptedProposal).toBeNull()
  })
})

describe("buildConversionPlan", () => {
  const prospect = { id: 5, businessName: "Acme Ltd", contactName: "Sam", contactEmail: "sam@acme.com", contactPhone: null, websiteUrl: "https://acme.com", location: null, industry: null, stage: "won", source: "referral", priority: "high", estimatedProjectValue: 9000, estimatedMonthlyRetainer: 500, revenueScore: 5, trustScore: 5, conversionScore: 5, seoScore: 5, mobileScore: 5, auditSummary: null, painPoints: null, opportunityNotes: null, objectionNotes: null, wonAt: new Date(), createdAt: new Date() }
  it("computes defaults and no blocking warnings for a won prospect", () => {
    const plan = buildConversionPlan({ prospect, activities: [], proposalTrackings: [{ packageType: "growth", quotedAmount: 9000, monthlyRetainerAmount: 500, status: "accepted", sentAt: new Date(), acceptedAt: new Date() }], salesProposals: [], leadScore: null, matchCandidates: [], existingConversion: null })
    expect(plan.defaults.tier).toBe("Retainer")
    expect(plan.defaults.mrr).toBe(500)
    expect(plan.defaults.invoiceClientCode).toMatch(/^[A-Z0-9]{2,12}$/)
    expect(plan.defaults.onboardingTasks).toHaveLength(5)
    expect(plan.defaults.invoiceItems[0]).toMatchObject({ quantity: 1 })
    expect(plan.warnings.some((w) => w.blocksExecute)).toBe(false)
  })
  it("flags not_won as blocking and dedupe candidates as non-blocking", () => {
    const plan = buildConversionPlan({ prospect: { ...prospect, stage: "proposal_sent" }, activities: [], proposalTrackings: [], salesProposals: [], leadScore: null, matchCandidates: [{ clientId: 9, name: "Acme Ltd", tier: null, mrr: 0, matchedOn: ["name"] }], existingConversion: null })
    expect(plan.warnings.find((w) => w.code === "not_won")?.blocksExecute).toBe(true)
    expect(plan.warnings.find((w) => w.code === "dedupe_candidates")?.blocksExecute).toBe(false)
    expect(plan.warnings.find((w) => w.code === "no_accepted_proposal")).toBeTruthy()
  })
})

describe("computeConversionStatus", () => {
  it("is completed only when every enabled step is done or skipped", () => {
    const opts = { ...createOptions, createDraftInvoice: true }
    expect(computeConversionStatus(opts, { project: "skipped", tasks: "skipped", invoice: "done", portal: "skipped" })).toBe("completed")
    expect(computeConversionStatus(opts, { project: "skipped", tasks: "skipped", invoice: "error:boom", portal: "skipped" })).toBe("partial")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd admin && npm test -- src/lib/prospect-conversion.test.ts`
Expected: FAIL — `Cannot find module './prospect-conversion'`.

- [ ] **Step 3: Implement `admin/src/lib/prospect-conversion.ts`**

```ts
import { CLIENT_FORGE_BUILD_TIER, CLIENT_RETAINER_TIER, CLIENT_SERVICE_TIERS, isClientServiceTier, type ClientServiceTier } from "@/lib/clients"

export class ProspectConversionError extends Error {
  constructor(public safeMessage: string, public status = 400, public code = "prospect_conversion") {
    super(safeMessage)
    this.name = "ProspectConversionError"
  }
}

export interface ClientCreateOption { mode: "create"; name: string; tier: ClientServiceTier; mrr: number; invoiceClientCode: string }
export interface ClientLinkOption { mode: "link"; clientId: number; invoiceClientCode?: string }
export type ClientOption = ClientCreateOption | ClientLinkOption

export interface ConfirmedConversionOptions {
  client: ClientOption
  createProject: boolean
  projectName?: string
  onboardingTasks: boolean
  createDraftInvoice: boolean
  preparePortal: boolean
}

export type ConversionStepState = string // "done" | "skipped" | `error:${string}`
export interface ConversionSteps { project: ConversionStepState; tasks: ConversionStepState; invoice: ConversionStepState; portal: ConversionStepState }

const INVOICE_CODE_RE = /^[A-Z0-9]{2,12}$/

function bool(value: unknown, field: string) {
  if (typeof value !== "boolean") throw new ProspectConversionError(`${field} must be true or false.`)
  return value
}

function nonNegativeInt(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new ProspectConversionError(`${field} must be zero or a positive whole number.`)
  return parsed
}

export function parseConversionOptions(input: unknown): ConfirmedConversionOptions {
  if (!input || typeof input !== "object") throw new ProspectConversionError("A conversion options object is required.")
  const raw = input as Record<string, unknown>
  const clientRaw = raw.client
  if (!clientRaw || typeof clientRaw !== "object") throw new ProspectConversionError("A client option is required.")
  const c = clientRaw as Record<string, unknown>

  let client: ClientOption
  if (c.mode === "create") {
    const name = typeof c.name === "string" ? c.name.trim() : ""
    if (!name) throw new ProspectConversionError("Client name is required.")
    if (!isClientServiceTier(c.tier)) throw new ProspectConversionError("Select a valid client service tier.")
    const invoiceClientCode = typeof c.invoiceClientCode === "string" ? c.invoiceClientCode.trim().toUpperCase() : ""
    if (!INVOICE_CODE_RE.test(invoiceClientCode)) throw new ProspectConversionError("Invoice client code must be 2–12 letters or numbers.")
    client = { mode: "create", name, tier: c.tier, mrr: nonNegativeInt(c.mrr, "MRR"), invoiceClientCode }
  } else if (c.mode === "link") {
    const clientId = typeof c.clientId === "number" ? c.clientId : Number(c.clientId)
    if (!Number.isInteger(clientId) || clientId <= 0) throw new ProspectConversionError("Select an existing client to link.")
    const code = c.invoiceClientCode == null || c.invoiceClientCode === "" ? undefined : String(c.invoiceClientCode).trim().toUpperCase()
    if (code !== undefined && !INVOICE_CODE_RE.test(code)) throw new ProspectConversionError("Invoice client code must be 2–12 letters or numbers.")
    client = { mode: "link", clientId, invoiceClientCode: code }
  } else {
    throw new ProspectConversionError("Client mode must be 'create' or 'link'.")
  }

  const createProject = bool(raw.createProject, "Create project")
  const projectName = typeof raw.projectName === "string" ? raw.projectName.trim() : ""
  if (createProject && !projectName) throw new ProspectConversionError("A project name is required to create a project.")

  return {
    client,
    createProject,
    projectName: createProject ? projectName : undefined,
    onboardingTasks: bool(raw.onboardingTasks, "Onboarding tasks"),
    createDraftInvoice: bool(raw.createDraftInvoice, "Create draft invoice"),
    preparePortal: bool(raw.preparePortal, "Prepare portal"),
  }
}

export function assertOptionsUnchanged(persisted: unknown, incoming: ConfirmedConversionOptions) {
  const normalise = (value: unknown) => JSON.stringify(parseConversionOptions(value))
  let persistedNormal: string
  try { persistedNormal = normalise(persisted) } catch { persistedNormal = JSON.stringify(persisted) }
  if (persistedNormal !== JSON.stringify(incoming)) {
    throw new ProspectConversionError("This conversion was already started with different options. Resume it as-is or contact an administrator.", 409, "options_frozen")
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

export function normaliseName(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

export function normaliseHost(url: string | null | undefined) {
  if (!url) return ""
  try { return new URL(url).host.replace(/^www\./, "").toLowerCase() } catch { return "" }
}

export interface ClientMatchCandidate { clientId: number; name: string; tier: string | null; mrr: number; matchedOn: Array<"name" | "email" | "website"> }

export function matchExistingClients(
  prospect: { businessName: string; contactEmail: string | null; websiteUrl: string | null },
  clients: Array<{ id: number; name: string; contactEmail: string | null; websiteUrl?: string | null; tier: string | null; mrr: number }>,
): ClientMatchCandidate[] {
  const name = normaliseName(prospect.businessName)
  const email = (prospect.contactEmail ?? "").trim().toLowerCase()
  const host = normaliseHost(prospect.websiteUrl)
  const out: ClientMatchCandidate[] = []
  for (const client of clients) {
    const matchedOn: Array<"name" | "email" | "website"> = []
    if (name && normaliseName(client.name) === name) matchedOn.push("name")
    if (email && (client.contactEmail ?? "").trim().toLowerCase() === email) matchedOn.push("email")
    if (host && normaliseHost(client.websiteUrl ?? null) === host) matchedOn.push("website")
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

function resolveAcceptedProposal(input: SnapshotInput): AcceptedProposalSummary | null {
  const tracking = input.proposalTrackings.find((row) => row.status === "accepted")
  if (tracking) return { source: "proposal_tracking", packageType: tracking.packageType, selectedServices: null, buildPrice: tracking.quotedAmount, retainerPrice: tracking.monthlyRetainerAmount }
  const proposal = input.salesProposals.find((row) => row.status === "accepted")
  if (proposal) return { source: "sales_proposal", packageType: proposal.packageType ?? "custom", selectedServices: proposal.selectedServices, buildPrice: proposal.buildPrice, retainerPrice: proposal.retainerPrice }
  return null
}

function iso(value: Date | null | undefined) { return value ? new Date(value).toISOString() : null }

export function buildOpportunitySnapshot(input: SnapshotInput): OpportunitySnapshot {
  return {
    capturedAt: new Date().toISOString(),
    prospect: { ...input.prospect },
    outreach: {
      count: input.activities.length,
      lastActivities: input.activities.slice(0, 50).map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: new Date(a.createdAt).toISOString() })),
    },
    proposalTrackings: input.proposalTrackings.map((row) => ({ packageType: row.packageType, quotedAmount: row.quotedAmount, monthlyRetainerAmount: row.monthlyRetainerAmount, status: row.status, sentAt: iso(row.sentAt), acceptedAt: iso(row.acceptedAt) })),
    acceptedProposal: resolveAcceptedProposal(input),
    leadScore: input.leadScore ? { snapshotId: input.leadScore.id, score: input.leadScore.score } : null,
  }
}

export interface ConversionWarning { code: "not_won" | "already_converted" | "dedupe_candidates" | "no_accepted_proposal"; message: string; blocksExecute: boolean }

interface PlanInput extends SnapshotInput {
  matchCandidates: ClientMatchCandidate[]
  existingConversion: ConversionPlan["existingConversion"]
}

export interface ConversionPlan {
  prospectId: number
  alreadyConverted: boolean
  warnings: ConversionWarning[]
  defaults: {
    clientName: string
    tier: ClientServiceTier
    mrr: number
    invoiceClientCode: string
    projectName: string
    onboardingTasks: Array<{ title: string }>
    invoiceItems: Array<{ title: string; quantity: number; unitAmount: number }>
  }
  matchCandidates: ClientMatchCandidate[]
  acceptedProposal: AcceptedProposalSummary | null
  existingConversion:
    | null
    | { status: string; steps: ConversionSteps; clientId: number; deliveryProjectId: number | null; draftInvoiceId: number | null; portalAccountId: number | null }
}

export function buildConversionPlan(input: PlanInput): ConversionPlan {
  const prospect = input.prospect as Record<string, unknown> & {
    id: number; businessName: string; stage: string; estimatedMonthlyRetainer: number; estimatedProjectValue: number
  }
  const accepted = resolveAcceptedProposal(input)
  const mrr = accepted ? accepted.retainerPrice : prospect.estimatedMonthlyRetainer
  const buildPrice = accepted ? accepted.buildPrice : prospect.estimatedProjectValue
  const packageLabel = accepted ? accepted.packageType : "Engagement"

  const warnings: ConversionWarning[] = []
  if (prospect.stage !== "won") warnings.push({ code: "not_won", message: "This opportunity is not marked Won. Move it to Won before converting.", blocksExecute: true })
  if (input.existingConversion) warnings.push({ code: "already_converted", message: "This opportunity has already been converted. You can resume unfinished steps.", blocksExecute: false })
  if (input.matchCandidates.length) warnings.push({ code: "dedupe_candidates", message: `Found ${input.matchCandidates.length} existing client(s) that may already represent this business.`, blocksExecute: false })
  if (!accepted) warnings.push({ code: "no_accepted_proposal", message: "No accepted proposal found; service/price defaults come from the prospect estimates.", blocksExecute: false })

  return {
    prospectId: prospect.id,
    alreadyConverted: Boolean(input.existingConversion),
    warnings,
    defaults: {
      clientName: prospect.businessName,
      tier: deriveTier(mrr),
      mrr,
      invoiceClientCode: suggestInvoiceClientCode(prospect.businessName),
      projectName: `${prospect.businessName} — ${packageLabel}`,
      onboardingTasks: defaultOnboardingTasks(),
      invoiceItems: buildPrice > 0
        ? [{ title: accepted?.selectedServices?.trim() || `${packageLabel} — initial engagement`, quantity: 1, unitAmount: buildPrice }]
        : [],
    },
    matchCandidates: input.matchCandidates,
    acceptedProposal: accepted,
    existingConversion: input.existingConversion,
  }
}

export function computeConversionStatus(options: ConfirmedConversionOptions, steps: ConversionSteps): "completed" | "partial" {
  const enabled: Array<keyof ConversionSteps> = []
  enabled.push("project", "tasks", "invoice", "portal")
  const ok = (state: ConversionStepState) => state === "done" || state === "skipped"
  return enabled.every((key) => ok(steps[key])) ? "completed" : "partial"
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd admin && npm test -- src/lib/prospect-conversion.test.ts`
Expected: PASS (all cases).

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
- Test: `admin/src/lib/delivery-projects.test.ts` (already exists — must stay green) + `admin/test/integration/*delivery*` if present

**Interfaces:**
- Consumes: `AdminDatabaseTransaction` from `@/lib/db`, `DeliveryActor` (already exported from this file).
- Produces: `export async function createDeliveryProjectWithTx(tx: AdminDatabaseTransaction, input: Record<string, unknown>, actor: DeliveryActor): Promise<typeof deliveryProjects.$inferSelect>` — the current body of `createDeliveryProject` minus the outer `db.transaction`. `createDeliveryProject(input, actor)` becomes `db.transaction((tx) => createDeliveryProjectWithTx(tx, input, actor))`.

- [ ] **Step 1: Confirm current behaviour is covered**

Run: `cd admin && npm test -- src/lib/delivery-projects.test.ts`
Expected: PASS. Note the count — it must not change after the refactor.

- [ ] **Step 2: Refactor**

In `admin/src/lib/server/delivery-project-service.ts`, add `type { AdminDatabaseTransaction } from "@/lib/db"` to the `db` import line. Replace the `createDeliveryProject` function so the validation/normalisation block and the `db.transaction(async (tx) => { … })` body move into a new exported function taking `tx`:

```ts
export async function createDeliveryProject(input: Record<string, unknown>, actor: DeliveryActor) {
  return db.transaction((tx) => createDeliveryProjectWithTx(tx, input, actor))
}

export async function createDeliveryProjectWithTx(tx: AdminDatabaseTransaction, input: Record<string, unknown>, actor: DeliveryActor) {
  const clientId = optionalPositiveId(input.clientId, "Client ID")
  if (!clientId) throw new DeliveryProjectError("Client ID is required.")
  const values = {
    // …unchanged value-building block, verbatim from the current implementation…
  }
  if (values.clientStagingVisible && !values.clientStagingUrl) throw new DeliveryProjectError("A safe staging URL is required before publishing a preview.")
  assertDateOrder(values.targetStartDate, values.targetEndDate)

  await assertClientAndLinkage(tx, values.clientId, values.forgeProjectId, values.deploymentCandidateId)
  await assertOwner(tx, values.ownerUserId)
  const [project] = await tx.insert(deliveryProjects).values(values).returning()
  await syncForgeIntegration(tx, project.id, values.forgeProjectId, values.deploymentCandidateId)
  await tx.insert(deliveryProjectAuditLogs).values({ projectId: project.id, actorUserId: actor.id, action: "project_created", metadataJson: { clientId, phase: project.currentPhase, clientVisible: project.clientVisible } })
  await publishTimeline(tx, project, actor, "project", `project:${project.id}`, "project_created", "Project created", `${project.name} was added to the delivery workspace.`, "internal")
  if (project.clientVisible) await publishTimeline(tx, project, actor, "project", `project:${project.id}:published`, "project_published", project.name, project.summary ?? "A new delivery project has been published.")
  return project
}
```

Keep the exact `values` object from the current code (do not retype it from memory — cut and paste it).

- [ ] **Step 3: Run delivery tests**

Run: `cd admin && npm test -- src/lib/delivery-projects.test.ts`
Expected: PASS, same count as Step 1.

- [ ] **Step 4: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/delivery-project-service.ts
git commit -m "refactor: expose createDeliveryProjectWithTx for shared-transaction callers"
```

---

### Task 4: `prepareDisabledPortalAccount`

**Files:**
- Modify: `admin/src/lib/server/portal-users.ts`
- Test: `admin/test/integration/prospect-conversion.integration.test.ts` (add a focused case)

**Interfaces:**
- Consumes: `db` from `@/lib/db`, `clients` from `@/lib/schema`, the file-local `portalClientAccounts` table projection, `bcrypt`, `randomBytes`, `PASSWORD_ROUNDS`.
- Produces: `export async function prepareDisabledPortalAccount(clientId: number): Promise<{ portalAccountId: number; portalClientId: string }>` — sets `clients.portalClientId` to `portal-client-<id>` if absent, inserts a `portal_client_accounts` row with `active: false`, `email: portal-disabled+<clientId>@scalesmiths.co.uk`, and a bcrypt hash of a discarded 32-byte random value. Throws `PortalUserError` on missing client or duplicate.

- [ ] **Step 1: Write the failing integration case**

In `admin/test/integration/prospect-conversion.integration.test.ts` add:

```ts
import { prepareDisabledPortalAccount } from "../../src/lib/server/portal-users"

it("prepareDisabledPortalAccount creates a disabled account and links portalClientId", async () => {
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

(Ensure `eq`, `sql` are imported in the test file.)

- [ ] **Step 2: Run it — expect failure**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: FAIL — `prepareDisabledPortalAccount is not a function`.

- [ ] **Step 3: Implement**

Append to `admin/src/lib/server/portal-users.ts`:

```ts
export async function prepareDisabledPortalAccount(clientId: number) {
  if (!Number.isInteger(clientId) || clientId <= 0) throw new PortalUserError("A valid client is required.")
  return db.transaction(async (tx) => {
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
  })
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/portal-users.ts admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: prepareDisabledPortalAccount for conversion portal provisioning"
```

---

### Task 5: `previewConversion` server function

**Files:**
- Create: `admin/src/lib/server/prospect-conversion.ts`
- Test: `admin/test/integration/prospect-conversion.integration.test.ts`

**Interfaces:**
- Consumes: pure helpers from `@/lib/prospect-conversion`; `db` from `@/lib/db`; schema tables `prospects`, `clients`, `outreachActivities`, `proposalTrackings`, `salesProposals`, `leadScoreSnapshots`, `prospectConversions`.
- Produces:
  - `interface ConversionActor { id: string; email?: string | null; name?: string | null }`
  - `export async function previewConversion(prospectId: number, actor: ConversionActor): Promise<ConversionPlan>` — throws `ProspectConversionError(404)` if the prospect is missing.
  - `export async function loadConversionRecord(prospectId: number): Promise<ProspectConversionRow | null>` (used by Task 7 too).

- [ ] **Step 1: Write failing integration tests**

Add to `admin/test/integration/prospect-conversion.integration.test.ts`:

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
  it("returns defaults, no blocking warnings, and dedupe candidates", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    await adminDb.insert(currentSchema.clients).values({ name: "Acme Ltd", contactEmail: "x@y.z", updatedAt: new Date() })
    const plan = await previewConversion(prospect.id, actor)
    expect(plan.defaults.tier).toBe("Retainer")
    expect(plan.defaults.mrr).toBe(500)
    expect(plan.matchCandidates[0]).toMatchObject({ matchedOn: ["name"] })
    expect(plan.warnings.some((w) => w.blocksExecute)).toBe(false)
    expect(plan.existingConversion).toBeNull()
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

import { and, desc, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  clients,
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

function planInputs(data: Awaited<ReturnType<typeof loadOpportunity>>) {
  return {
    prospect: data.prospect as Record<string, unknown> & { id: number },
    activities: data.activities.map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: a.createdAt })),
    proposalTrackings: data.trackings.map((t) => ({ packageType: t.packageType, quotedAmount: t.quotedAmount, monthlyRetainerAmount: t.monthlyRetainerAmount, status: t.status, sentAt: t.sentAt, acceptedAt: t.acceptedAt })),
    salesProposals: data.proposals.map((p) => ({ status: p.status, selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice, packageType: null })),
    leadScore: data.leadScore ? { id: data.leadScore.id, score: data.leadScore.score } : null,
  }
}

function existingConversionView(row: ProspectConversionRow | null): ConversionPlan["existingConversion"] {
  if (!row) return null
  const steps = row.stepsJson as Record<string, string>
  return {
    status: row.status,
    steps: { project: steps.project ?? "skipped", tasks: steps.tasks ?? "skipped", invoice: steps.invoice ?? "skipped", portal: steps.portal ?? "skipped" },
    clientId: row.clientId,
    deliveryProjectId: row.deliveryProjectId,
    draftInvoiceId: row.draftInvoiceId,
    portalAccountId: row.portalAccountId,
  }
}

export async function previewConversion(prospectId: number, _actor: ConversionActor): Promise<ConversionPlan> {
  const data = await loadOpportunity(prospectId)
  const existing = await loadConversionRecord(prospectId)
  const allClients = await db.select({ id: clients.id, name: clients.name, contactEmail: clients.contactEmail, tier: clients.tier, mrr: clients.mrr }).from(clients)
  const matchCandidates = matchExistingClients(
    { businessName: data.prospect.businessName, contactEmail: data.prospect.contactEmail, websiteUrl: data.prospect.websiteUrl },
    allClients.map((c) => ({ ...c, websiteUrl: null })),
  )
  return buildConversionPlan({ ...planInputs(data), matchCandidates, existingConversion: existingConversionView(existing) })
}

export { and, eq, inArray } // re-exported for Task 7 helpers if needed
```

(Remove the trailing re-export line if lint flags it; it is only a convenience.)

- [ ] **Step 4: Run — expect pass**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/prospect-conversion.ts admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: previewConversion computes the conversion plan"
```

---

### Task 6: `executeConversion` Phase A (core atomic)

**Files:**
- Modify: `admin/src/lib/server/prospect-conversion.ts`
- Test: `admin/test/integration/prospect-conversion.integration.test.ts`

**Interfaces:**
- Consumes: `parseConversionOptions`, `assertOptionsUnchanged`, `buildOpportunitySnapshot`, `computeConversionStatus`, `defaultOnboardingTasks` from `@/lib/prospect-conversion`; `createDeliveryProjectWithTx` from `@/lib/server/delivery-project-service`; `recordClientActivity` from `@/lib/server/client-activity`; schema `clients`, `kanbanCards`, `deliveryMilestones`, `prospects`, `prospectConversions`; `assignClientInvoiceCode` from `@/lib/server/invoices`.
- Produces:
  - `interface ConversionRecordView extends ProspectConversionRow { deliveryProject: { id: number; name: string } | null; draftInvoice: { id: number; status: string } | null }`
  - `export async function executeConversion(prospectId: number, actor: ConversionActor, rawOptions: unknown): Promise<ConversionRecordView>` — Phase A only in this task (invoice/portal steps recorded as `"skipped"` unless enabled, in which case left as `"error:pending"` and finished in Task 7).

For this task, if `createDraftInvoice`/`preparePortal` are enabled, set their step to the literal `"pending"` and `status` via `computeConversionStatus` (which will yield `partial`). Task 7 replaces `"pending"` handling with real work.

- [ ] **Step 1: Write failing integration tests**

```ts
import { executeConversion } from "../../src/lib/server/prospect-conversion"

describe("executeConversion — Phase A", () => {
  const baseOptions = {
    client: { mode: "create", name: "Acme Ltd", tier: "Retainer", mrr: 500, invoiceClientCode: "ACME1" },
    createProject: true, projectName: "Acme — growth", onboardingTasks: true,
    createDraftInvoice: false, preparePortal: false,
  }

  it("creates client + record + project + milestones + timeline atomically", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const record = await executeConversion(prospect.id, actor, baseOptions)
    expect(record.linkMode).toBe("created")
    expect(record.status).toBe("completed")
    const [client] = await adminDb.select().from(currentSchema.clients).where(eq(currentSchema.clients.id, record.clientId))
    expect(client.tier).toBe("Retainer")
    expect(client.invoiceClientCode).toBe("ACME1")
    const [updatedProspect] = await adminDb.select().from(currentSchema.prospects).where(eq(currentSchema.prospects.id, prospect.id))
    expect(updatedProspect.convertedClientId).toBe(record.clientId)
    expect(updatedProspect.stage).toBe("won")
    expect(record.deliveryProjectId).not.toBeNull()
    const milestones = await adminDb.select().from(currentSchema.deliveryMilestones).where(eq(currentSchema.deliveryMilestones.projectId, record.deliveryProjectId!))
    expect(milestones).toHaveLength(5)
    const events = await adminDb.select().from(currentSchema.clientTimelineEvents).where(eq(currentSchema.clientTimelineEvents.clientRecordId, record.clientId))
    expect(events.some((e) => e.type === "prospect_converted")).toBe(true)
  })

  it("is idempotent: a second call with equal options is a no-op", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const first = await executeConversion(prospect.id, actor, baseOptions)
    const second = await executeConversion(prospect.id, actor, baseOptions)
    expect(second.id).toBe(first.id)
    const clientRows = await adminDb.select().from(currentSchema.clients)
    expect(clientRows).toHaveLength(1)
    const milestones = await adminDb.select().from(currentSchema.deliveryMilestones)
    expect(milestones).toHaveLength(5)
  })

  it("links an existing client without creating a new one", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const [existing] = await adminDb.insert(currentSchema.clients).values({ name: "Acme Ltd", invoiceClientCode: "ACME2", updatedAt: new Date() }).returning()
    const record = await executeConversion(prospect.id, actor, { ...baseOptions, client: { mode: "link", clientId: existing.id }, createProject: false, onboardingTasks: false })
    expect(record.linkMode).toBe("linked")
    expect(record.clientId).toBe(existing.id)
    expect(await adminDb.select().from(currentSchema.clients)).toHaveLength(1)
  })

  it("rejects conversion when the prospect is not won", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const [prospect] = await adminDb.insert(currentSchema.prospects).values({ businessName: "NotWon", stage: "proposal_sent" }).returning()
    await expect(executeConversion(prospect.id, actor, { ...baseOptions, createProject: false, onboardingTasks: false })).rejects.toMatchObject({ status: 409 })
    expect(await adminDb.select().from(currentSchema.clients)).toHaveLength(0)
  })

  it("rejects a resume whose options changed", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    await executeConversion(prospect.id, actor, baseOptions)
    await expect(executeConversion(prospect.id, actor, { ...baseOptions, preparePortal: true })).rejects.toMatchObject({ status: 409 })
  })

  it("minimal options: client only, nothing else", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const record = await executeConversion(prospect.id, actor, { client: { mode: "create", name: "Acme", tier: "Forge Build", mrr: 0, invoiceClientCode: "ACME3" }, createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false })
    expect(record.deliveryProjectId).toBeNull()
    expect(record.draftInvoiceId).toBeNull()
    expect(record.portalAccountId).toBeNull()
    expect(await adminDb.select().from(currentSchema.kanbanCards)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: FAIL — `executeConversion is not a function`.

- [ ] **Step 3: Implement Phase A**

Add to `admin/src/lib/server/prospect-conversion.ts`:

```ts
import { createDeliveryProjectWithTx, type DeliveryActor } from "@/lib/server/delivery-project-service"
import { assignClientInvoiceCode } from "@/lib/server/invoices"
import { recordClientActivity } from "@/lib/server/client-activity"
import { kanbanCards, deliveryMilestones } from "@/lib/schema"
import {
  assertOptionsUnchanged,
  buildOpportunitySnapshot,
  computeConversionStatus,
  defaultOnboardingTasks,
  parseConversionOptions,
  type ConfirmedConversionOptions,
  type ConversionSteps,
} from "@/lib/prospect-conversion"

export interface ConversionRecordView extends ProspectConversionRow {
  deliveryProject: { id: number; name: string } | null
  draftInvoice: { id: number; status: string } | null
}

function initialSteps(options: ConfirmedConversionOptions): ConversionSteps {
  return {
    project: options.createProject ? "done" : "skipped",
    tasks: options.onboardingTasks ? "done" : "skipped",
    invoice: options.createDraftInvoice ? "pending" : "skipped",
    portal: options.preparePortal ? "pending" : "skipped",
  }
}

async function view(row: ProspectConversionRow): Promise<ConversionRecordView> {
  const deliveryProject = row.deliveryProjectId
    ? (await db.select({ id: deliveryProjects.id, name: deliveryProjects.name }).from(deliveryProjects).where(eq(deliveryProjects.id, row.deliveryProjectId)).limit(1))[0] ?? null
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
    if (existing) {
      assertOptionsUnchanged(existing.optionsJson, options)
      return existing // Phase A already done; Task 7 handles resuming Phase B
    }

    if (prospect.stage !== "won") throw new ProspectConversionError("Only won opportunities can be converted.", 409, "not_won")

    // Resolve client (create or link)
    let clientId: number
    let linkMode: "created" | "linked"
    if (options.client.mode === "link") {
      const [linked] = await tx.select({ id: clients.id, invoiceClientCode: clients.invoiceClientCode }).from(clients).where(eq(clients.id, options.client.clientId)).limit(1)
      if (!linked) throw new ProspectConversionError("The selected client no longer exists.", 404, "client_not_found")
      clientId = linked.id
      linkMode = "linked"
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
          mrr: options.client.mrr,
          status: "active",
          progress: 0,
          invoiceClientCode: options.client.invoiceClientCode,
          updatedAt: new Date(),
        }).returning({ id: clients.id })
        clientId = created.id
        linkMode = "created"
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
          throw new ProspectConversionError("That invoice client code is already in use.", 409, "duplicate_client_code")
        }
        throw error
      }
    }

    // Snapshot
    const [activities, trackings, proposals, scores] = await Promise.all([
      tx.select().from(outreachActivities).where(eq(outreachActivities.prospectId, prospectId)).orderBy(desc(outreachActivities.createdAt)),
      tx.select().from(proposalTrackings).where(eq(proposalTrackings.prospectId, prospectId)).orderBy(desc(proposalTrackings.createdAt)),
      tx.select().from(salesProposals).where(eq(salesProposals.prospectId, prospectId)).orderBy(desc(salesProposals.updatedAt)),
      tx.select().from(leadScoreSnapshots).where(eq(leadScoreSnapshots.prospectId, prospectId)).orderBy(desc(leadScoreSnapshots.createdAt)).limit(1),
    ])
    const snapshot = buildOpportunitySnapshot({
      prospect: prospect as Record<string, unknown> & { id: number },
      activities: activities.map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: a.createdAt })),
      proposalTrackings: trackings.map((t) => ({ packageType: t.packageType, quotedAmount: t.quotedAmount, monthlyRetainerAmount: t.monthlyRetainerAmount, status: t.status, sentAt: t.sentAt, acceptedAt: t.acceptedAt })),
      salesProposals: proposals.map((p) => ({ status: p.status, selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice, packageType: null })),
      leadScore: scores[0] ? { id: scores[0].id, score: scores[0].score } : null,
    })

    // Optional: project
    let deliveryProjectId: number | null = null
    if (options.createProject) {
      const project = await createDeliveryProjectWithTx(tx, {
        clientId,
        name: options.projectName,
        summary: `Converted from opportunity #${prospectId} (${prospect.businessName}).`,
      }, deliveryActor)
      deliveryProjectId = project.id
    }

    // Optional: onboarding tasks
    if (options.onboardingTasks) {
      const tasks = defaultOnboardingTasks()
      if (deliveryProjectId) {
        await tx.insert(deliveryMilestones).values(tasks.map((task, index) => ({
          projectId: deliveryProjectId!, title: task.title, status: "planned" as const,
          clientVisible: false, weight: 1, position: index,
        })))
      } else {
        await tx.insert(kanbanCards).values(tasks.map((task, index) => ({
          title: task.title, clientId, column: "backlog" as const, priority: "med", tag: "onboarding", position: index,
        })))
      }
    }

    const steps = initialSteps(options)
    const status = computeConversionStatus(options, steps)

    const [conversion] = await tx.insert(prospectConversions).values({
      prospectId,
      clientId,
      deliveryProjectId,
      draftInvoiceId: null,
      portalAccountId: null,
      linkMode,
      convertedBy: actor.id,
      optionsJson: options as unknown as Record<string, unknown>,
      opportunitySnapshotJson: snapshot as unknown as Record<string, unknown>,
      stepsJson: steps as unknown as Record<string, string>,
      status,
      updatedAt: new Date(),
    }).returning()

    await tx.update(prospects).set({
      convertedClientId: clientId,
      wonAt: prospect.wonAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(prospects.id, prospectId))

    await recordClientActivity(tx, {
      clientRecordId: clientId,
      sourceDomain: "manual",
      sourceReference: `prospect-conversion:${prospectId}`,
      type: "prospect_converted",
      title: "Converted from opportunity",
      description: `${prospect.businessName} was converted from opportunity #${prospectId}.`,
      visibility: "internal",
      actor: { type: "admin", id: actor.id, label: actor.name ?? actor.email ?? "ScaleSmiths" },
      metadata: { prospectId, linkMode },
      idempotencyKey: `prospect-conversion:${prospectId}`,
    })

    return conversion
  })

  return view(record)
}
```

Add `deliveryProjects`, `invoices` to the schema import at the top of the file.

Note on `assignClientInvoiceCode`: it opens its own `db.transaction`. For the `link` + code path this runs before the outer transaction commits; acceptable because it targets a different client row and is guarded (`where invoiceClientCode is null`). If integration testing shows a deadlock, move the code assignment to Phase B instead — but the common path (`create` mode) sets the code inline on insert and does not call it.

- [ ] **Step 4: Run — expect pass**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS (all Phase A cases). The `createDraftInvoice`/`preparePortal` cases are not exercised yet.

- [ ] **Step 5: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/prospect-conversion.ts admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: executeConversion Phase A — atomic client/record/project/tasks/timeline"
```

---

### Task 7: `executeConversion` Phase B (invoice, portal, resume)

**Files:**
- Modify: `admin/src/lib/server/prospect-conversion.ts`
- Test: `admin/test/integration/prospect-conversion.integration.test.ts`

**Interfaces:**
- Consumes: `createInvoice` from `@/lib/server/invoices`; `prepareDisabledPortalAccount` from `@/lib/server/portal-users`; `InvoiceDomainError` from `@/lib/invoices`; pure `computeConversionStatus`.
- Produces: `executeConversion` now performs post-commit steps for `createDraftInvoice` and `preparePortal`, writing `done` / `error:<msg>` into `stepsJson`, setting `draftInvoiceId` / `portalAccountId`, recomputing `status`, and — when called again on a `partial` record — retrying only steps not `done`/`skipped`. No new exported symbol.

- [ ] **Step 1: Write failing integration tests**

```ts
describe("executeConversion — Phase B + resume", () => {
  const withInvoice = {
    client: { mode: "create", name: "Acme Ltd", tier: "Retainer", mrr: 500, invoiceClientCode: "ACMEB" },
    createProject: false, onboardingTasks: false, createDraftInvoice: true, preparePortal: true,
  }

  it("creates a DRAFT invoice and a disabled portal account, status completed", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    const record = await executeConversion(prospect.id, actor, withInvoice)
    expect(record.status).toBe("completed")
    expect(record.draftInvoice?.status).toBe("draft")
    const [invoice] = await adminDb.select().from(currentSchema.invoices).where(eq(currentSchema.invoices.id, record.draftInvoiceId!))
    expect(invoice.status).toBe("draft")
    expect(invoice.invoiceNumber).toBeNull()
    const rows = await adminDb.execute(sql`select active from portal_client_accounts where id = ${record.portalAccountId}`)
    expect(rows.rows[0].active).toBe(false)
  })

  it("records a partial status when the invoice step fails, then resumes to completed", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    // Force invoice failure: no accepted proposal / zero build price => empty invoiceItems => createInvoice throws "Invoice items are required."
    await adminDb.update(currentSchema.proposalTrackings).set({ status: "rejected" }).where(eq(currentSchema.proposalTrackings.prospectId, prospect.id))
    await adminDb.update(currentSchema.prospects).set({ estimatedProjectValue: 0 }).where(eq(currentSchema.prospects.id, prospect.id))
    const partial = await executeConversion(prospect.id, actor, withInvoice)
    expect(partial.status).toBe("partial")
    expect(String((partial.stepsJson as Record<string, string>).invoice)).toMatch(/^error:/)
    expect((partial.stepsJson as Record<string, string>).portal).toBe("done")
    // Fix the cause, resume with identical options
    await adminDb.update(currentSchema.prospects).set({ estimatedProjectValue: 4000 }).where(eq(currentSchema.prospects.id, prospect.id))
    const resumed = await executeConversion(prospect.id, actor, withInvoice)
    expect(resumed.status).toBe("completed")
    expect(resumed.draftInvoice?.status).toBe("draft")
    // portal not duplicated
    const all = await adminDb.execute(sql`select count(*)::int as n from portal_client_accounts`)
    expect(all.rows[0].n).toBe(1)
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: FAIL — invoice/portal steps still `"pending"`, status assertions fail.

- [ ] **Step 3: Implement Phase B**

In `admin/src/lib/server/prospect-conversion.ts`, add imports:

```ts
import { createInvoice } from "@/lib/server/invoices"
import { prepareDisabledPortalAccount } from "@/lib/server/portal-users"
import { InvoiceDomainError } from "@/lib/invoices"
import { buildConversionPlan } from "@/lib/prospect-conversion"
```

Add a helper and extend `executeConversion` to run Phase B after the transaction returns `record` (covers both the freshly-created and the resumed cases):

```ts
function stepPending(state: string | undefined) {
  return !(state === "done" || state === "skipped")
}

async function runPhaseB(record: ProspectConversionRow, options: ConfirmedConversionOptions, actor: ConversionActor): Promise<ProspectConversionRow> {
  const steps: ConversionSteps = {
    project: (record.stepsJson as Record<string, string>).project ?? "skipped",
    tasks: (record.stepsJson as Record<string, string>).tasks ?? "skipped",
    invoice: (record.stepsJson as Record<string, string>).invoice ?? "skipped",
    portal: (record.stepsJson as Record<string, string>).portal ?? "skipped",
  }
  let draftInvoiceId = record.draftInvoiceId
  let portalAccountId = record.portalAccountId

  if (options.createDraftInvoice && stepPending(steps.invoice)) {
    try {
      const snapshot = record.opportunitySnapshotJson as { prospect?: Record<string, unknown>; acceptedProposal?: { buildPrice?: number; selectedServices?: string | null; packageType?: string } | null }
      const plan = buildConversionPlan({
        prospect: { ...(snapshot.prospect ?? {}), id: record.prospectId } as Record<string, unknown> & { id: number },
        activities: [], proposalTrackings: [], salesProposals: [],
        leadScore: null, matchCandidates: [], existingConversion: null,
      })
      const items = plan.defaults.invoiceItems
      const invoice = await createInvoice({ clientId: record.clientId, items }, actor.id)
      draftInvoiceId = invoice.id
      steps.invoice = "done"
    } catch (error) {
      steps.invoice = `error:${error instanceof InvoiceDomainError ? error.safeMessage : "Unable to create the draft invoice."}`
    }
  }

  if (options.preparePortal && stepPending(steps.portal)) {
    try {
      const prepared = await prepareDisabledPortalAccount(record.clientId)
      portalAccountId = prepared.portalAccountId
      steps.portal = "done"
    } catch (error) {
      steps.portal = `error:${error instanceof Error ? error.message : "Unable to prepare portal access."}`
    }
  }

  const status = computeConversionStatus(options, steps)
  const [updated] = await db.update(prospectConversions).set({
    draftInvoiceId, portalAccountId, stepsJson: steps as unknown as Record<string, string>, status, updatedAt: new Date(),
  }).where(eq(prospectConversions.id, record.id)).returning()
  return updated
}
```

Then change the tail of `executeConversion`:

```ts
  // was: return view(record)
  const needsPhaseB = options.createDraftInvoice || options.preparePortal
  const finalRecord = needsPhaseB ? await runPhaseB(record, options, actor) : record
  return view(finalRecord)
```

And in `initialSteps`, change `"pending"` to `"pending"` staying as-is is fine — `stepPending("pending")` is true so Phase B will pick it up. (Keep the literal `"pending"`; `computeConversionStatus` already treats it as not-ok → `partial` until Phase B resolves it.)

The `buildConversionPlan` reuse here is only to recompute `invoiceItems` from the frozen snapshot without re-querying; if the snapshot's `acceptedProposal` should drive items, prefer reading `record.opportunitySnapshotJson.acceptedProposal` directly. Implement it that way:

```ts
const accepted = (record.opportunitySnapshotJson as { acceptedProposal?: { buildPrice: number; selectedServices: string | null; packageType: string } | null }).acceptedProposal
const prospectEstimate = Number((record.opportunitySnapshotJson as { prospect?: { estimatedProjectValue?: number } }).prospect?.estimatedProjectValue ?? 0)
const buildPrice = accepted?.buildPrice ?? prospectEstimate
const items = buildPrice > 0 ? [{ title: (accepted?.selectedServices?.trim() || `${accepted?.packageType ?? "Engagement"} — initial engagement`), quantity: 1, unitAmount: buildPrice }] : []
```

Use this block instead of the `buildConversionPlan` call above (drop the extra import if unused).

- [ ] **Step 4: Run — expect pass**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration -- prospect-conversion`
Expected: PASS — all Phase A + Phase B + resume cases.

- [ ] **Step 5: Add the no-auto-send import guard test**

In `admin/src/lib/prospect-conversion.test.ts` add:

```ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

it("the conversion service does not import email/delivery modules", () => {
  const source = readFileSync(resolve(__dirname, "server/prospect-conversion.ts"), "utf8")
  expect(source).not.toMatch(/resend|invoice-delivery|client-request-notifications|safe-outbound|nodemailer|sendMail/i)
})
```

Run: `cd admin && npm test -- src/lib/prospect-conversion.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/server/prospect-conversion.ts admin/src/lib/prospect-conversion.test.ts admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: executeConversion Phase B — draft invoice, disabled portal, resume"
```

---

### Task 8: RBAC — `leads.convert` capability + policy rule

**Files:**
- Modify: `admin/src/lib/rbac.ts`
- Modify: `admin/src/lib/authorization-policy.ts`
- Modify: `admin/src/lib/rbac.test.ts`
- Modify: `admin/src/lib/authorization-policy.test.ts`
- Modify: `admin/src/lib/rbac-authorization.test.ts`
- Modify: `docs/architecture/rbac-policy.md`

**Interfaces:**
- Produces: `"leads.convert"` added to `CAPABILITIES`; granted to `owner`, `administrator`, `sales`, `project_manager` in `ROLE_CAPABILITIES`. `requiredCapabilityForRequest` returns `"leads.convert"` for `POST /api/prospects/:id/conversion` and `.../conversion/preview`. `AUTHORIZATION_POLICY` gains a rule (id `prospects.conversion`) ordered **before** `id: "prospects"`.

- [ ] **Step 1: Update the capability tests first (red)**

In `admin/src/lib/rbac.test.ts`, add assertions:

```ts
it("grants leads.convert to sales and project_manager but not viewer/finance/developer", () => {
  expect(hasCapability("sales", "leads.convert")).toBe(true)
  expect(hasCapability("project_manager", "leads.convert")).toBe(true)
  expect(hasCapability("administrator", "leads.convert")).toBe(true)
  expect(hasCapability("owner", "leads.convert")).toBe(true)
  expect(hasCapability("viewer", "leads.convert")).toBe(false)
  expect(hasCapability("finance", "leads.convert")).toBe(false)
  expect(hasCapability("developer", "leads.convert")).toBe(false)
})

it("requires leads.convert for the conversion routes", () => {
  expect(requiredCapabilityForRequest({ pathname: "/api/prospects/5/conversion", method: "POST" })).toBe("leads.convert")
  expect(requiredCapabilityForRequest({ pathname: "/api/prospects/5/conversion/preview", method: "POST" })).toBe("leads.convert")
})
```

Ensure `requiredCapabilityForRequest` is imported in that test file (add to the existing import if missing).

In `admin/src/lib/authorization-policy.test.ts`, add:

```ts
it("maps the prospect conversion routes to leads.convert before the generic prospects rule", () => {
  expect(authorizationExpectation("/api/prospects/5/conversion", "POST")?.capability).toBe("leads.convert")
  expect(authorizationExpectation("/api/prospects/5/conversion/preview", "POST")?.capability).toBe("leads.convert")
  expect(authorizationExpectation("/api/prospects/5", "PATCH")?.capability).toBe("leads.write")
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd admin && npm test -- src/lib/rbac.test.ts src/lib/authorization-policy.test.ts`
Expected: FAIL — `leads.convert` not a member of the capability union / rule missing.

- [ ] **Step 3: Implement the RBAC changes**

`admin/src/lib/rbac.ts`:
- Add `"leads.convert"` to the `CAPABILITIES` array (next to `"leads.write"`).
- `ROLE_CAPABILITIES`: add `"leads.convert"` to the arrays for `sales` and `project_manager`. `owner` and `administrator` use `CAPABILITIES` / a filter, so they gain it automatically — verify `administrator`'s filter doesn't exclude it (it only excludes `admin_users.credentials.reset` and `admin_users.owner.assign`).
- In `requiredCapabilityForRequest`, **above** the existing `if (pathname === "/prospects" || pathname.startsWith("/prospects/") || pathname.startsWith("/api/prospects")) …` line, add:

```ts
if (/^\/api\/prospects\/[^/]+\/conversion(?:\/preview)?$/.test(pathname)) return "leads.convert"
```

`admin/src/lib/authorization-policy.ts`: insert **before** the `rule({ id: "prospects", … })` entry:

```ts
rule({ id: "prospects.conversion", route: /^\/api\/prospects\/[^/]+\/conversion(?:\/preview)?$/, methods: ["POST"], domain: "sales", capability: "leads.convert", scope: "global", scopeRule: "Conversion is bound to the selected prospect id; the service performs the downstream client/project/invoice/portal writes as an audited elevated operation.", authenticated: true, allow: "leads.convert succeeds.", deny: "401 unauthenticated; 403 without leads.convert." }),
```

- [ ] **Step 4: Run — expect pass, then run the whole RBAC gate**

Run: `cd admin && npm test -- src/lib/rbac.test.ts src/lib/authorization-policy.test.ts src/lib/rbac-authorization.test.ts`
Expected: PASS. If `rbac-authorization.test.ts` enumerates capabilities or role matrices, update its expected sets to include `leads.convert` for the four roles.

Run: `cd admin && npm run check:authorization-policy`
Expected: PASS.

- [ ] **Step 5: Update the RBAC doc**

In `docs/architecture/rbac-policy.md`: add `leads.convert` to the capability list/table and mark it granted for `owner`, `administrator`, `sales`, `project_manager` in the role matrix. Preserve the file's existing `## ` headings and any Mermaid block.

Run: `cd /d/Projects/scalesmiths/ss && npm run check:architecture-docs`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

Run: `cd admin && npm exec tsc -- --noEmit`

```bash
git add admin/src/lib/rbac.ts admin/src/lib/authorization-policy.ts admin/src/lib/rbac.test.ts admin/src/lib/authorization-policy.test.ts admin/src/lib/rbac-authorization.test.ts docs/architecture/rbac-policy.md
git commit -m "feat: add leads.convert capability and conversion route authorization rule"
```

---

### Task 9: HTTP routes + remove legacy action

**Files:**
- Create: `admin/src/app/api/prospects/[id]/conversion/preview/route.ts`
- Create: `admin/src/app/api/prospects/[id]/conversion/route.ts`
- Create: `admin/src/lib/server/prospect-conversion-http.ts`
- Modify: `admin/src/app/api/prospects/[id]/route.ts` (remove the `action === "convertToClient"` branch, ~lines 159-194, and its now-unused imports)
- Test: `admin/test/integration/prospect-conversion.integration.test.ts` (route-level RBAC + happy path)

**Interfaces:**
- Consumes: `guardApiCapability` from `@/lib/server/rbac`; `previewConversion`, `executeConversion` from `@/lib/server/prospect-conversion`; `ProspectConversionError` from `@/lib/prospect-conversion`; `AdminIdentityError` from `@/lib/admin-users`.
- Produces:
  - `admin/src/lib/server/prospect-conversion-http.ts`: `parseId(value: string): number` (throws `ProspectConversionError(400)`), `conversionFailure(error: unknown): NextResponse` (maps `ProspectConversionError` + `AdminIdentityError` to `{ ok: false, error }` with status; else 500 + `console.error`).
  - `POST /api/prospects/[id]/conversion/preview` → `{ ok: true, plan }`.
  - `POST /api/prospects/[id]/conversion` → `{ ok: true, conversion }`.

- [ ] **Step 1: Write failing route/RBAC integration tests**

These need an authenticated request context. Follow whatever pattern the other route-level integration tests use (`durable-operational-controls.integration.test.ts` sets up sessions). If route-level auth is impractical in the integration harness, assert instead at the service boundary that `guardApiCapability` is invoked by importing the route module with a mocked `@/lib/server/rbac`. Concretely, add a Vitest unit test `admin/src/app/api/prospects/[id]/conversion/route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/server/rbac", () => ({ guardApiCapability: vi.fn().mockResolvedValue({ id: "u1", email: "op@x.co", name: "Op" }) }))
vi.mock("@/lib/server/prospect-conversion", () => ({
  previewConversion: vi.fn().mockResolvedValue({ prospectId: 5, warnings: [] }),
  executeConversion: vi.fn().mockResolvedValue({ id: 1, status: "completed" }),
}))

import { guardApiCapability } from "@/lib/server/rbac"
import { POST as previewPOST } from "./preview/route"
import { POST as executePOST } from "./route"

function req(body: unknown) {
  return new Request("http://x/api/prospects/5/conversion", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
}

describe("conversion routes", () => {
  it("preview guards leads.convert and returns the plan", async () => {
    const res = await previewPOST(req({}), { params: Promise.resolve({ id: "5" }) })
    expect(guardApiCapability).toHaveBeenCalledWith("leads.convert")
    expect(await res.json()).toMatchObject({ ok: true, plan: { prospectId: 5 } })
  })
  it("execute guards leads.convert and returns the conversion", async () => {
    const res = await executePOST(req({ options: {} }), { params: Promise.resolve({ id: "5" }) })
    expect(guardApiCapability).toHaveBeenCalledWith("leads.convert")
    expect(await res.json()).toMatchObject({ ok: true, conversion: { status: "completed" } })
  })
  it("400s on a non-numeric id", async () => {
    const res = await executePOST(req({ options: {} }), { params: Promise.resolve({ id: "abc" }) })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd admin && npm test -- "src/app/api/prospects/[id]/conversion/route.test.ts"`
Expected: FAIL — route modules do not exist.

- [ ] **Step 3: Implement the HTTP helper**

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

- [ ] **Step 4: Implement the routes**

`admin/src/app/api/prospects/[id]/conversion/preview/route.ts`:

```ts
import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { previewConversion } from "@/lib/server/prospect-conversion"
import { conversionFailure, parseId } from "@/lib/server/prospect-conversion-http"

export const dynamic = "force-dynamic"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("leads.convert")
    const { id } = await params
    const plan = await previewConversion(parseId(id), actor)
    return NextResponse.json({ ok: true, plan })
  } catch (error) {
    return conversionFailure(error)
  }
}
```

`admin/src/app/api/prospects/[id]/conversion/route.ts`:

```ts
import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { executeConversion } from "@/lib/server/prospect-conversion"
import { conversionFailure, parseId } from "@/lib/server/prospect-conversion-http"

export const dynamic = "force-dynamic"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("leads.convert")
    const { id } = await params
    const body = await request.json().catch(() => null)
    const conversion = await executeConversion(parseId(id), actor, body && typeof body === "object" ? (body as Record<string, unknown>).options : undefined)
    return NextResponse.json({ ok: true, conversion })
  } catch (error) {
    return conversionFailure(error)
  }
}
```

- [ ] **Step 5: Remove the legacy `convertToClient` branch**

In `admin/src/app/api/prospects/[id]/route.ts`, delete the entire `if (action === "convertToClient") { … }` block (lines ~159-194). Then remove imports that become unused: `clients` from `@/lib/schema` (keep `proposalTrackings`, `prospects`), and `InvoiceDomainError, normalizeInvoiceClientCode` from `@/lib/invoices`, and `buildClientFromWonProspect` from `@/lib/prospects` — **only if** no other branch references them (grep the file after deleting). Leave `stageDateUpdates`, `parseProspectPayload`, etc.

Run: `cd admin && npm exec tsc -- --noEmit`
Expected: no "unused import" or type errors. Fix imports as flagged.

- [ ] **Step 6: Run route tests + the prospect route's existing tests**

Run: `cd admin && npm test -- "src/app/api/prospects/[id]/conversion/route.test.ts" src/lib/prospects.test.ts`
Expected: PASS. `prospects.test.ts` still references `buildClientFromWonProspect` (that helper stays in `prospects.ts`; only the route branch is gone) — leave `buildClientFromWonProspect` exported.

- [ ] **Step 7: Add a route-level RBAC integration check (best effort)**

If `durable-operational-controls.integration.test.ts` demonstrates an authenticated `fetch` against a running route with a role-bearing session, mirror it: a `viewer` session → `POST /api/prospects/:id/conversion` returns 403; a `sales` session → 200. If that infra is not readily reusable, note in the test file with a `// RBAC for these routes is covered by authorization-policy.test.ts + middleware` comment and rely on Task 8's coverage.

- [ ] **Step 8: Commit**

```bash
git add "admin/src/app/api/prospects/[id]/conversion" admin/src/lib/server/prospect-conversion-http.ts "admin/src/app/api/prospects/[id]/route.ts" admin/test/integration/prospect-conversion.integration.test.ts
git commit -m "feat: conversion HTTP routes; remove legacy convertToClient action"
```

---

### Task 10: Admin UI — `ConvertProspectModal`

**Files:**
- Create: `admin/src/components/prospect-conversion/ConvertProspectModal.tsx`
- Modify: `admin/src/components/ProspectPipeline.tsx` (the `onConvert` handler ~line 491, and the button ~line 698)
- Test: `admin/src/components/prospect-conversion/ConvertProspectModal.test.tsx`

**Interfaces:**
- Consumes: `ConversionPlan` / `ConfirmedConversionOptions` shapes from `@/lib/prospect-conversion` (import types only); `CLIENT_SERVICE_TIER_OPTIONS` from `@/lib/clients`.
- Produces: `export function ConvertProspectModal({ prospectId, open, onClose, onConverted }: { prospectId: number; open: boolean; onClose: () => void; onConverted: (clientId: number) => void }): JSX.Element | null`. Fetches `POST /api/prospects/${prospectId}/conversion/preview` on open; submits `POST /api/prospects/${prospectId}/conversion` with `{ options }`.

- [ ] **Step 1: Write failing component tests**

`admin/src/components/prospect-conversion/ConvertProspectModal.test.tsx` (Vitest + Testing Library — match the setup used by other `*.test.tsx` in the repo; check an existing one for the render/util imports):

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { ConvertProspectModal } from "./ConvertProspectModal"

const plan = {
  prospectId: 5, alreadyConverted: false,
  warnings: [{ code: "dedupe_candidates", message: "Found 1", blocksExecute: false }],
  defaults: { clientName: "Acme Ltd", tier: "Retainer", mrr: 500, invoiceClientCode: "ACME", projectName: "Acme — growth", onboardingTasks: [{ title: "Kickoff & welcome" }], invoiceItems: [{ title: "Growth", quantity: 1, unitAmount: 9000 }] },
  matchCandidates: [{ clientId: 9, name: "Acme Ltd", tier: null, mrr: 0, matchedOn: ["name"] }],
  acceptedProposal: null, existingConversion: null,
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith("/conversion/preview")) return new Response(JSON.stringify({ ok: true, plan }), { status: 200 })
    if (String(url).endsWith("/conversion")) return new Response(JSON.stringify({ ok: true, conversion: { clientId: 42, status: "completed", deliveryProject: null, draftInvoice: null, portalAccountId: null, stepsJson: {} } }), { status: 200 })
    return new Response("{}", { status: 404 })
  }))
})

describe("ConvertProspectModal", () => {
  it("shows the preview defaults and dedupe candidate", async () => {
    render(<ConvertProspectModal prospectId={5} open onClose={() => {}} onConverted={() => {}} />)
    expect(await screen.findByDisplayValue("Acme Ltd")).toBeInTheDocument()
    expect(screen.getByText(/Acme Ltd/)).toBeInTheDocument()
    expect(screen.getByText(/Found 1/)).toBeInTheDocument()
  })

  it("submits confirmed options and reports the created client", async () => {
    const onConverted = vi.fn()
    render(<ConvertProspectModal prospectId={5} open onClose={() => {}} onConverted={onConverted} />)
    await screen.findByDisplayValue("ACME")
    fireEvent.click(screen.getByRole("button", { name: /convert/i }))
    await waitFor(() => expect(onConverted).toHaveBeenCalledWith(42))
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => String(c[0]).endsWith("/conversion"))
    expect(JSON.parse(call![1].body).options.client).toMatchObject({ mode: "create", invoiceClientCode: "ACME" })
  })

  it("disables Convert when a blocking warning is present", async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(async () =>
      new Response(JSON.stringify({ ok: true, plan: { ...plan, warnings: [{ code: "not_won", message: "Not won", blocksExecute: true }] } }), { status: 200 }))
    render(<ConvertProspectModal prospectId={5} open onClose={() => {}} onConverted={() => {}} />)
    await screen.findByText(/Not won/)
    expect(screen.getByRole("button", { name: /convert/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run — expect failure**

Run: `cd admin && npm test -- src/components/prospect-conversion/ConvertProspectModal.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the modal**

Create `admin/src/components/prospect-conversion/ConvertProspectModal.tsx`. Use the same `T` token object convention as `ProspectPipeline.tsx`. Minimum behaviour to satisfy tests + spec:

```tsx
"use client"

import { useEffect, useState } from "react"
import { CLIENT_SERVICE_TIER_OPTIONS } from "@/lib/clients"

const T = { s1:"var(--s1)",s2:"var(--s2)",b1:"var(--b1)",b2:"var(--b2)",t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",acc:"var(--acc)",grn:"var(--grn)",red:"var(--red)",amb:"var(--amb)" }

interface Warning { code: string; message: string; blocksExecute: boolean }
interface MatchCandidate { clientId: number; name: string; tier: string | null; mrr: number; matchedOn: string[] }
interface Plan {
  prospectId: number
  alreadyConverted: boolean
  warnings: Warning[]
  defaults: { clientName: string; tier: string; mrr: number; invoiceClientCode: string; projectName: string; onboardingTasks: { title: string }[]; invoiceItems: { title: string; quantity: number; unitAmount: number }[] }
  matchCandidates: MatchCandidate[]
  existingConversion: null | { status: string; steps: Record<string, string>; clientId: number; deliveryProjectId: number | null; draftInvoiceId: number | null; portalAccountId: number | null }
}

export function ConvertProspectModal({ prospectId, open, onClose, onConverted }: { prospectId: number; open: boolean; onClose: () => void; onConverted: (clientId: number) => void }) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ status: string; steps: Record<string, string>; clientId: number } | null>(null)

  const [mode, setMode] = useState<"create" | "link">("create")
  const [linkClientId, setLinkClientId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [tier, setTier] = useState("Foundation")
  const [mrr, setMrr] = useState(0)
  const [code, setCode] = useState("")
  const [createProject, setCreateProject] = useState(false)
  const [projectName, setProjectName] = useState("")
  const [onboardingTasks, setOnboardingTasks] = useState(false)
  const [createDraftInvoice, setCreateDraftInvoice] = useState(false)
  const [preparePortal, setPreparePortal] = useState(false)

  useEffect(() => {
    if (!open) return
    setPlan(null); setError(""); setResult(null)
    fetch(`/api/prospects/${prospectId}/conversion/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.ok === false) throw new Error(json.error || "Unable to load the conversion preview.")
        const p = json.plan as Plan
        setPlan(p)
        setName(p.defaults.clientName); setTier(p.defaults.tier); setMrr(p.defaults.mrr); setCode(p.defaults.invoiceClientCode)
        setProjectName(p.defaults.projectName)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load the conversion preview."))
  }, [open, prospectId])

  if (!open) return null

  const blocked = Boolean(plan?.warnings.some((w) => w.blocksExecute))

  async function submit() {
    setBusy(true); setError("")
    try {
      const options = {
        client: mode === "create"
          ? { mode: "create", name, tier, mrr: Number(mrr), invoiceClientCode: code.trim().toUpperCase() }
          : { mode: "link", clientId: linkClientId, invoiceClientCode: code.trim() ? code.trim().toUpperCase() : undefined },
        createProject, projectName: createProject ? projectName : undefined,
        onboardingTasks, createDraftInvoice, preparePortal,
      }
      const res = await fetch(`/api/prospects/${prospectId}/conversion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ options }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) throw new Error(json.error || "Conversion failed.")
      setResult({ status: json.conversion.status, steps: json.conversion.stepsJson ?? {}, clientId: json.conversion.clientId })
      onConverted(json.conversion.clientId)
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
            <div style={{ color: result.status === "completed" ? T.grn : T.amb }}>Conversion {result.status}.</div>
            <ul className="list-disc pl-5" style={{ color:T.t2 }}>
              <li><a href={`/clients/${result.clientId}`} style={{ color:T.acc }}>Open client</a></li>
              {Object.entries(result.steps).map(([step, state]) => <li key={step}>{step}: {state}</li>)}
            </ul>
            {result.status === "partial" && <button onClick={submit} disabled={busy} className="rounded-lg px-3 py-2 font-dm text-sm text-white" style={{ background:T.acc }}>Resume</button>}
          </div>
        ) : plan && (
          <div className="space-y-4">
            {plan.warnings.map((w) => (
              <div key={w.code} className="rounded border px-3 py-2 font-dm text-xs" style={{ borderColor: w.blocksExecute ? "rgba(239,68,68,.4)" : "rgba(245,158,11,.35)", color:T.t1 }}>{w.message}</div>
            ))}

            <div className="grid grid-cols-2 gap-2">
              <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Client</span>
                <select value={mode} onChange={(e) => setMode(e.target.value as "create" | "link")}>
                  <option value="create">Create new client</option>
                  <option value="link">Link to existing client</option>
                </select>
              </label>
              {mode === "link" && (
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Existing client</span>
                  <select value={linkClientId ?? ""} onChange={(e) => setLinkClientId(Number(e.target.value) || null)}>
                    <option value="">Select…</option>
                    {plan.matchCandidates.map((c) => <option key={c.clientId} value={c.clientId}>{c.name} (matched: {c.matchedOn.join(", ")})</option>)}
                  </select>
                </label>
              )}
            </div>

            {mode === "create" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Tier</span>
                  <select value={tier} onChange={(e) => setTier(e.target.value)}>
                    {CLIENT_SERVICE_TIER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>MRR</span><input type="number" min="0" value={mrr} onChange={(e) => setMrr(Number(e.target.value))} /></label>
                <label className="font-dm text-sm"><span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Invoice code (permanent)</span><input value={code} onChange={(e) => setCode(e.target.value)} /></label>
              </div>
            )}

            <div className="space-y-2 font-dm text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={createProject} onChange={(e) => setCreateProject(e.target.checked)} /> Create delivery project</label>
              {createProject && <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full" />}
              <label className="flex items-center gap-2"><input type="checkbox" checked={onboardingTasks} onChange={(e) => setOnboardingTasks(e.target.checked)} /> Seed onboarding tasks ({plan.defaults.onboardingTasks.length})</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={createDraftInvoice} onChange={(e) => setCreateDraftInvoice(e.target.checked)} /> Create draft invoice{plan.defaults.invoiceItems[0] ? ` (${plan.defaults.invoiceItems[0].title})` : ""}</label>
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

- Add `import { ConvertProspectModal } from "@/components/prospect-conversion/ConvertProspectModal"`.
- Add state near the other `useState`s: `const [convertProspectId, setConvertProspectId] = useState<number | null>(null)`.
- Replace the `onConvert` prop passed to `DetailPanel` (line ~491) with: `onConvert={() => selected && setConvertProspectId(selected.id)}`.
- Before the closing `</div>` of the component's returned root, render:

```tsx
{convertProspectId !== null && (
  <ConvertProspectModal
    prospectId={convertProspectId}
    open
    onClose={() => setConvertProspectId(null)}
    onConverted={(clientId) => { setConvertProspectId(null); void patchProspect(convertProspectId, {}, "noop"); router.refresh() }}
  />
)}
```

Simplify the `onConverted` callback to just `() => { setConvertProspectId(null); router.refresh() }` if `patchProspect` with an empty body would 400 — it would, so use the simple version:

```tsx
onConverted={() => { setConvertProspectId(null); router.refresh() }}
```

- [ ] **Step 6: Typecheck, lint, focused component + pipeline build check**

Run: `cd admin && npm exec tsc -- --noEmit && npm run lint`
Expected: clean. Fix any unused-var / hook-dep warnings.

- [ ] **Step 7: Commit**

```bash
git add admin/src/components/prospect-conversion admin/src/components/ProspectPipeline.tsx
git commit -m "feat: ConvertProspectModal preview/confirm UI wired into the pipeline"
```

---

### Task 11: E2E journey (Playwright)

**Files:**
- Modify: an existing spec under `admin/test/e2e/` (extend `forge-journeys.spec.ts` or add `prospect-conversion.spec.ts` alongside it, matching the existing Playwright config + auth-storage-state pattern)

**Interfaces:**
- Consumes: the running admin app + seeded admin auth state used by the other e2e specs.

- [ ] **Step 1: Write the E2E test**

Add `admin/test/e2e/prospect-conversion.spec.ts` following the structure of `admin/test/e2e/forge-journeys.spec.ts` (same `test.use({ storageState })` / base URL setup). Steps:

```ts
import { test, expect } from "@playwright/test"

test("won prospect converts to a client with a project", async ({ page, request }) => {
  // Seed a won prospect via the API (reuse whatever authenticated request helper the other specs use).
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

  // Reopen the prospect: button now reads "Converted"
  await page.goto("/prospects")
  await page.getByRole("button", { name: prospect.businessName }).click()
  await expect(page.getByRole("button", { name: /^Converted$/ })).toBeVisible()
})
```

If the pipeline button label logic still shows "Convert to Client" for a converted prospect, adjust `ProspectPipeline.tsx` so the button reads `Converted` when `prospect.convertedClientId` is set (it already does — line ~698-700) and `Resume conversion` when a partial record exists (optional; only if the pipeline is given that data — otherwise leave the two-state label).

- [ ] **Step 2: Run the E2E spec**

Run: `cd admin && npm run test:e2e:forge-journeys` (or the project's e2e command that includes the new spec; check `admin/package.json` — if a general `test:e2e` doesn't exist, add the spec to `playwright.forge.config.ts`'s test list or run `node ./node_modules/@playwright/test/cli.js test --config playwright.forge.config.ts prospect-conversion.spec.ts`).
Expected: PASS. If auth/seed helpers differ, adapt to the pattern actually used by the neighbouring spec — do not invent a new auth mechanism.

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
- (RBAC doc already updated in Task 8)

**Interfaces:** none (docs only).

- [ ] **Step 1: Update `data-model.md`**

In the ER / relationships section add `prospect_conversions` and its links:
`PROSPECTS ||--o| PROSPECT_CONVERSIONS : converted_via`, `CLIENTS ||--o{ PROSPECT_CONVERSIONS : from_opportunity`, plus optional links to `DELIVERY_PROJECTS` and `INVOICES`. Add a bullet to the table inventory:

```
- `prospect_conversions`: one row per converted prospect (prospect_id unique). Actor,
  chosen options, resulting client/project/draft-invoice/portal-account ids, per-step
  status, and an immutable opportunity snapshot. Idempotency anchor for the conversion
  workflow.
```

Keep every enforced `## ` heading and the existing Mermaid block valid.

- [ ] **Step 2: Create `docs/architecture/prospect-conversion.md`**

Write sections: **Overview**, **Capability (`leads.convert`) and the elevated service**, **Preview → Confirm flow**, **Execution model (Phase A atomic / Phase B best-effort + resume)**, **Idempotency (`prospect_conversions.prospect_id` unique, frozen options + snapshot)**, **Client dedupe (no silent duplicate, no silent link)**, **No auto-send guarantees (draft invoice never issued; portal account disabled, no credentials)**, **Data written per option**. Keep it ≤ ~150 lines, consistent with the other architecture docs' tone.

- [ ] **Step 3: Run the docs gate**

Run: `cd /d/Projects/scalesmiths/ss && npm run check:architecture-docs`
Expected: PASS. (`check:architecture-docs` enforces the six named files' structure; a new extra file is allowed but must not break the enforced ones.)

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/data-model.md docs/architecture/prospect-conversion.md
git commit -m "docs: document the prospect-to-client conversion workflow"
```

---

### Task 13: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Admin unit + typecheck + lint**

Run: `cd admin && npm exec tsc -- --noEmit && npm run lint && npm test`
Expected: all pass. Record any pre-existing unrelated failures separately (per AGENTS.md); do not fix out-of-scope debt.

- [ ] **Step 2: Admin integration**

Run: `cd /d/Projects/scalesmiths/ss && npm run test:integration`
Expected: pass, including `prospect-conversion.integration.test.ts`.

- [ ] **Step 3: Repo policy gates touched by this change**

Run:
```bash
cd /d/Projects/scalesmiths/ss
npm run check:migration-history && npm run test:migration-history && npm run test:migration-consistency
npm run check:architecture-docs
cd admin && npm run check:authorization-policy
```
Expected: all pass.

- [ ] **Step 4: Build**

Run: `cd admin && npm run build`
Expected: succeeds.

- [ ] **Step 5: Final diff review + commit any fixups**

Run: `cd /d/Projects/scalesmiths/ss && git diff master...HEAD --stat`
Confirm only intended files changed. Revert incidental edits. Commit fixups with `fix:` messages as needed.

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §5.3 `prospect_conversions` table | Task 1 |
| §5.1 pure module | Task 2 |
| §5.3 snapshot shape | Task 2 (`buildOpportunitySnapshot`) |
| §5.1 `createDeliveryProjectWithTx` | Task 3 |
| §5.1 / §7 `prepareDisabledPortalAccount` | Task 4 |
| §5.4 `previewConversion` + dedupe | Task 5 |
| §5.5 Phase A (client create/link, snapshot, prospect update, project, tasks, timeline) | Task 6 |
| §5.5 Phase B (invoice, portal, status, resume) + §4 D9 options frozen | Task 7 |
| §6 RBAC (`leads.convert`, policy rule, test + doc updates) | Task 8 |
| §5.2 routes + legacy removal | Task 9 |
| §8 admin modal + pipeline wiring | Task 10 |
| §9.3 E2E | Task 11 |
| §10 docs (`data-model`, new `prospect-conversion.md`) | Task 12; RBAC doc in Task 8 |
| §9.1 unit tests | Task 2, Task 7 (import guard) |
| §9.2 integration tests (all listed cases) | Tasks 1, 4, 5, 6, 7, 9 |
| §7 no-auto-send guarantee | Task 7 Step 5 import-guard test + Task 10 UI captions |
| §4 D4 dedupe: no silent duplicate/link | Task 5 (candidates) + Task 6 (explicit `mode`) |
| §4 D8 requires `stage='won'` | Task 6 (`not_won` 409) + Task 2 (`buildConversionPlan` blocking warning) |

No gaps identified.

**2. Placeholder scan**

No "TBD"/"TODO"/"implement later". Task 11 contains conditional guidance ("if the neighbouring spec uses a different auth helper, adapt") because the exact e2e auth-fixture API is repo-specific and must be read at implementation time — the test body itself is concrete.

**3. Type consistency**

- `ConfirmedConversionOptions`, `ClientOption` (`mode: "create" | "link"`), `ConversionSteps` (`project|tasks|invoice|portal`), `ConversionPlan`, `ProspectConversionRow`, `ConversionActor`, `ConversionRecordView` are defined once (Tasks 2/5/6) and referenced with the same shape in Tasks 7, 9, 10.
- `previewConversion(prospectId, actor)` / `executeConversion(prospectId, actor, rawOptions)` signatures match between Task 5/6/7 (definition) and Task 9 (route callers).
- `createDeliveryProjectWithTx(tx, input, actor)` — Task 3 defines, Task 6 consumes with `{ clientId, name, summary }`.
- `prepareDisabledPortalAccount(clientId) → { portalAccountId, portalClientId }` — Task 4 defines, Task 7 consumes `.portalAccountId`.
- `parseConversionOptions` throws `ProspectConversionError` (Task 2) which routes map in `conversionFailure` (Task 9).
- Step-state literals: `"done"`, `"skipped"`, `"pending"`, `` `error:${msg}` `` used consistently; `computeConversionStatus` treats anything other than `done`/`skipped` as not-complete, so `"pending"` → `partial` until Phase B resolves it.

Fixed inline during review: Task 7's first draft reused `buildConversionPlan` to recompute invoice items; replaced with a direct read of `record.opportunitySnapshotJson.acceptedProposal` / `.prospect.estimatedProjectValue` so Phase B does not depend on plan-builder internals or a second DB read.
