import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import * as currentSchema from "../../src/lib/schema";
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety";
import { eq, sql } from "drizzle-orm";
import { prospectConversions, clientServiceAssignments } from "../../src/lib/schema";
import { prepareDisabledPortalAccount } from "../../src/lib/server/portal-users";
import { executeConversion, previewConversion } from "../../src/lib/server/prospect-conversion"

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

const run = promisify(execFile);
let pool: Pool;
let url: string;
let webUrl: string;
let adminUrl: string;
let migrationUrl: string;
beforeAll(async () => {
  url = assertSafeIntegrationDatabaseUrl(process.env.TEST_DATABASE_URL);
  webUrl = roleUrl(url, "ss_test_web", "web-password");
  adminUrl = roleUrl(url, "ss_test_admin", "admin-password");
  migrationUrl = roleUrl(url, "ss_test_migration", "migration-password");
  process.env.DATABASE_URL = url;
  process.env.ADMIN_DATABASE_URL = adminUrl;
  process.env.MIGRATION_DATABASE_URL = migrationUrl;
  pool = new Pool({ connectionString: url, max: 8 });
  await pool.query(
    "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public",
  );
  const provisionEnv = {
    ...process.env,
    POSTGRES_PROVISIONING_DATABASE_URL: url,
    WEB_DATABASE_URL: webUrl,
    ADMIN_DATABASE_URL: adminUrl,
    MIGRATION_DATABASE_URL: migrationUrl,
    READONLY_DATABASE_URL: roleUrl(
      url,
      "ss_test_readonly",
      "readonly-password",
    ),
  };
  await run(
    process.execPath,
    [
      path.resolve("scripts/provision-postgres-roles.mjs"),
      "--confirm-provision",
    ],
    { env: provisionEnv },
  );
  const migrationPool = new Pool({ connectionString: migrationUrl, max: 2 });
  try {
    const database = drizzle(migrationPool);
    await migrate(database, {
      migrationsFolder: path.resolve("../web/drizzle"),
      migrationsTable: "__drizzle_web_migrations",
      migrationsSchema: "drizzle",
    });
    await migrate(database, { migrationsFolder: path.resolve("drizzle") });
  } finally {
    await migrationPool.end();
  }
  await run(
    process.execPath,
    [
      path.resolve("scripts/provision-postgres-roles.mjs"),
      "--confirm-provision",
    ],
    { env: provisionEnv },
  );
});
beforeEach(async () => {
  const tables = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '__drizzle_migrations'",
  );
  if (tables.rows.length)
    await pool.query(
      `TRUNCATE ${tables.rows.map((r) => `"public"."${r.tablename.replaceAll('"', '""')}"`).join(",")} RESTART IDENTITY CASCADE`,
    );
});
beforeEach(async () => {
  await pool.query(
    "INSERT INTO invoice_supplier_settings(id,legal_name,address_line_1,city,postcode,country,payment_instructions) VALUES(1,'ScaleSmiths','1 Supplier Street','Leeds','LS1 1AA','United Kingdom','Pay by bank transfer')",
  );
});
afterAll(async () => {
  await pool?.end();
});

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
})

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
    const metadata = record.metadataJson as {
      opportunitySnapshot: { acceptedProposal: { packageType: string } }
    }
    expect(metadata.opportunitySnapshot.acceptedProposal.packageType).toBe("growth")
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

  it("link mode: applies the guarded client patch, preserves an existing tier, and rejects a duplicate invoice code", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const item = await seedCatalogue(adminDb)

    // 1. fresh client (no tier, no invoiceClientCode) -> the guarded tx.update(clients) writes all three fields
    const prospectA = await seedWonProspect(adminDb)
    const [freshClient] = await adminDb.insert(currentSchema.clients).values({ name: "Fresh Co", updatedAt: new Date() }).returning()
    const recordA = await executeConversion(prospectA.id, actor, {
      client: { mode: "link", clientId: freshClient.id, tier: "Retainer", invoiceClientCode: "LINKA" },
      mrr: 750, catalogueItemIds: [item.id],
      createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
    })
    const [patchedClient] = await adminDb.select().from(currentSchema.clients).where(eq(currentSchema.clients.id, freshClient.id))
    expect(patchedClient.mrr).toBe(750)
    expect(patchedClient.tier).toBe("Retainer")
    expect(patchedClient.invoiceClientCode).toBe("LINKA")
    expect(recordA.assignedTier).toBe("Retainer")

    // 2. client already has a tier -> the guarded patch must NOT overwrite it, and assigned_tier must record what was kept
    const prospectB = await seedWonProspect(adminDb)
    const [tieredClient] = await adminDb.insert(currentSchema.clients).values({ name: "Tiered Co", tier: "Forge Build", updatedAt: new Date() }).returning()
    const recordB = await executeConversion(prospectB.id, actor, {
      client: { mode: "link", clientId: tieredClient.id, tier: "Retainer", invoiceClientCode: "LINKB" },
      mrr: 400, catalogueItemIds: [item.id],
      createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
    })
    const [preservedClient] = await adminDb.select().from(currentSchema.clients).where(eq(currentSchema.clients.id, tieredClient.id))
    expect(preservedClient.tier).toBe("Forge Build")
    expect(recordB.assignedTier).toBe("Forge Build")

    // 3. invoice code already held by a DIFFERENT client -> unique violation surfaces as a 409
    const prospectC = await seedWonProspect(adminDb)
    await adminDb.insert(currentSchema.clients).values({ name: "Code Holder", invoiceClientCode: "TAKEN", updatedAt: new Date() })
    const [targetClient] = await adminDb.insert(currentSchema.clients).values({ name: "Wants Code", updatedAt: new Date() }).returning()
    await expect(executeConversion(prospectC.id, actor, {
      client: { mode: "link", clientId: targetClient.id, tier: "Retainer", invoiceClientCode: "TAKEN" },
      mrr: 0, catalogueItemIds: [item.id],
      createProject: false, onboardingTasks: false, createDraftInvoice: false, preparePortal: false,
    })).rejects.toMatchObject({ status: 409 })
  })

  it("rolls back everything when a step fails", async () => {
    process.env.ADMIN_DATABASE_URL = adminUrl
    const adminDb = drizzle(new Pool({ connectionString: adminUrl }))
    const prospect = await seedWonProspect(adminDb)
    // catalogue id that does not exist -> the up-front active-catalogue check throws 409 before any write
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

function roleUrl(base: string, username: string, password: string) {
  const value = new URL(base);
  value.username = username;
  value.password = password;
  return value.toString();
}
