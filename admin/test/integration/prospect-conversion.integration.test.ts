import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as currentSchema from "../../src/lib/schema";
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety";
import { and, eq, sql } from "drizzle-orm";
import { prospectConversions, clientServiceAssignments } from "../../src/lib/schema";
import { prepareDisabledPortalAccount } from "../../src/lib/server/portal-users";
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
  process.env.NODE_ENV = "test";
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
function roleUrl(base: string, username: string, password: string) {
  const value = new URL(base);
  value.username = username;
  value.password = password;
  return value.toString();
}
