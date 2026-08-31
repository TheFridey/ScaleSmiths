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

describe("real PostgreSQL integration", () => {
  it("applies web then admin migration histories as the migration owner", async () => {
    const result = await pool.query(
      "SELECT c.relname,r.rolname owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname IN ('public','drizzle') AND c.relname IN ('quote_requests','admin_users','__drizzle_web_migrations','__drizzle_migrations')",
    );
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((row) => row.owner === "ss_test_migration")).toBe(
      true,
    );
  });

  it("prevents web credentials reading admin data or modifying schema", async () => {
    const webPool = new Pool({ connectionString: webUrl });
    try {
      await expect(
        webPool.query("SELECT * FROM admin_users"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        webPool.query("CREATE TABLE web_escape(id integer)"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        webPool.query(
          "INSERT INTO quote_requests(name,email,brief) VALUES('Web','web@example.test','Allowed public insert')",
        ),
      ).resolves.toMatchObject({ rowCount: 1 });
    } finally {
      await webPool.end();
    }
  });

  it("exposes only evidenced, verified and in-date claims through the web role", async () => {
    await pool.query(
      "INSERT INTO public_claims(id,approved_wording,claim_type,source_name,permitted_routes,permitted_components) VALUES('fixture.testimonial','A draft attributed quote','testimonial','Fixture Client',ARRAY['/'],ARRAY['testimonials'])",
    );
    const webPool = new Pool({ connectionString: webUrl });
    try {
      await expect(
        webPool.query("SELECT * FROM public_claims"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        webPool.query("SELECT * FROM public_claim_evidence"),
      ).rejects.toMatchObject({ code: "42501" });
      expect(
        (await webPool.query("SELECT * FROM public_verified_claims")).rowCount,
      ).toBe(0);
      await pool.query(
        "UPDATE public_claims SET status='verified',client_approval_status='approved',verified_by='raw-update',verified_at=now(),review_expires_at=now()+interval '1 day' WHERE id='fixture.testimonial'",
      );
      expect(
        (await webPool.query("SELECT * FROM public_verified_claims")).rowCount,
      ).toBe(0);
      await pool.query(
        "UPDATE public_claims SET status='draft',client_approval_status='pending',verified_by=NULL,verified_at=NULL,review_expires_at=NULL WHERE id='fixture.testimonial'",
      );
      const { updatePublicClaim } =
        await import("../../src/lib/server/public-claims");
      await updatePublicClaim(
        "fixture.testimonial",
        {
          approvedWording: "An approved attributed quote",
          claimType: "testimonial",
          sourceName: "Fixture Client",
          attributionName: "Fixture Person",
          attributionBusiness: "Fixture Client",
          clientApprovalStatus: "approved",
          status: "verified",
          reviewExpiresAt: new Date(Date.now() + 86_400_000),
          permittedRoutes: ["/"],
          permittedComponents: ["testimonials"],
          evidenceDescription: "Signed approval held by operations",
          evidenceReference: "private://claims/fixture",
          reason: "Evidence and client wording checked",
        },
        "integration-owner",
      );
      const visible = await webPool.query(
        "SELECT * FROM public_verified_claims",
      );
      expect(visible.rows).toHaveLength(1);
      expect(visible.rows[0]).toMatchObject({
        id: "fixture.testimonial",
        approved_wording: "An approved attributed quote",
        attribution_name: "Fixture Person",
      });
      expect(Object.keys(visible.rows[0])).not.toContain("evidence_reference");
      expect(Object.keys(visible.rows[0])).not.toContain("verified_by");
      expect(
        (
          await pool.query(
            "SELECT action,previous_status,new_status FROM public_claim_audit_logs WHERE claim_id='fixture.testimonial'",
          )
        ).rows,
      ).toEqual([
        {
          action: "claim_status_changed",
          previous_status: "draft",
          new_status: "verified",
        },
      ]);
    } finally {
      await webPool.end();
    }
  });

  it("prevents admin runtime credentials applying migrations or owning schema", async () => {
    const adminPool = new Pool({ connectionString: adminUrl });
    try {
      await expect(
        adminPool.query("CREATE TABLE admin_escape(id integer)"),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        adminPool.query(
          "INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES('forged',0)",
        ),
      ).rejects.toMatchObject({ code: "42501" });
      const owner = await pool.query(
        "SELECT r.rolname FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname='public'",
      );
      expect(owner.rows[0].rolname).toBe("ss_test_migration");
    } finally {
      await adminPool.end();
    }
  });

  it("enforces client analytics tenant isolation with RLS", async () => {
    const protectedTables = [
      "client_analytics_configs",
      "client_analytics_daily_metrics",
      "client_analytics_audit_logs",
      "client_optimisation_proposals",
    ];
    const rls = await pool.query(
      "SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,count(p.policyname)::int policies FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname WHERE n.nspname='public' AND c.relname=ANY($1::text[]) GROUP BY c.relname,c.relrowsecurity,c.relforcerowsecurity",
      [protectedTables],
    );
    expect(rls.rows).toHaveLength(protectedTables.length);
    expect(
      rls.rows.every(
        (row) =>
          row.relrowsecurity && row.relforcerowsecurity && row.policies === 1,
      ),
    ).toBe(true);
    const first = (
      await pool.query(
        "INSERT INTO clients(name) VALUES('Tenant A') RETURNING id",
      )
    ).rows[0].id;
    const second = (
      await pool.query(
        "INSERT INTO clients(name) VALUES('Tenant B') RETURNING id",
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO client_analytics_configs(client_id,provider,display_name,source_attribution,created_by) VALUES($1,'manual','A','fixture','test'),($2,'manual','B','fixture','test')",
      [first, second],
    );
    const adminPool = new Pool({ connectionString: adminUrl });
    try {
      expect(
        (await adminPool.query("SELECT * FROM client_analytics_configs"))
          .rowCount,
      ).toBe(0);
      const client = await adminPool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          "SELECT set_config('app.current_client_id',$1,true)",
          [String(first)],
        );
        const visible = await client.query(
          "SELECT client_id FROM client_analytics_configs ORDER BY client_id",
        );
        expect(visible.rows).toEqual([{ client_id: first }]);
        await expect(
          client.query(
            "INSERT INTO client_analytics_configs(client_id,provider,display_name,source_attribution,created_by) VALUES($1,'manual','Cross tenant','fixture','test')",
            [second],
          ),
        ).rejects.toMatchObject({ code: "42501" });
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    } finally {
      await adminPool.end();
    }
  });

  it("migrates an empty database and matches the current Drizzle table surface", async () => {
    const migrations = await pool.query(
      "SELECT count(*)::int count FROM drizzle.__drizzle_migrations",
    );
    expect(migrations.rows[0].count).toBeGreaterThan(20);
    const actualTables = new Set(
      (
        await pool.query<{ tablename: string }>(
          "SELECT tablename FROM pg_tables WHERE schemaname='public'",
        )
      ).rows.map((r) => r.tablename),
    );
    const expectedTables = Object.values(currentSchema)
      .filter((value): value is PgTable => is(value, PgTable))
      .map(getTableName);
    expect(
      [...expectedTables].filter((name) => !actualTables.has(name)),
    ).toEqual([]);
    const columns = await pool.query<{
      table_name: string;
      column_name: string;
    }>(
      "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
    );
    const names = new Set(
      columns.rows.map((r) => `${r.table_name}.${r.column_name}`),
    );
    for (const expected of [
      "admin_users.session_version",
      "forge_tasks.result_quality",
      "forge_artifacts.output_hash",
      "forge_ai_budget_reservations.idempotency_key",
      "forge_activity_logs.metadata_json",
      "forge_runs.policy_json",
      "forge_run_steps.output_artifact_ids",
      "forge_run_events.event_type",
      "forge_worker_heartbeats.last_heartbeat_at",
    ])
      expect(names.has(expected)).toBe(true);
  });

  it("bootstraps one persistent owner idempotently and authenticates it", async () => {
    const env = {
      ...process.env,
      ADMIN_DATABASE_URL: adminUrl,
      ADMIN_EMAIL: "integration-owner@example.test",
      ADMIN_PASSWORD: "integration-password-123",
      ADMIN_DISPLAY_NAME: "Integration Owner",
    };
    await run(process.execPath, [path.resolve("scripts/bootstrap-admin.mjs")], {
      env,
    });
    await run(process.execPath, [path.resolve("scripts/bootstrap-admin.mjs")], {
      env,
    });
    const rows = await pool.query("SELECT * FROM admin_users");
    expect(rows.rowCount).toBe(1);
    const { authenticateAdminUser } =
      await import("../../src/lib/server/admin-users");
    const user = await authenticateAdminUser(
      "integration-owner@example.test",
      "integration-password-123",
    );
    expect(user).toMatchObject({ role: "owner", active: true });
    expect(
      await bcrypt.compare(
        "integration-password-123",
        rows.rows[0].password_hash,
      ),
    ).toBe(true);
  });

  it("persists RBAC roles and enforces direct-request capabilities", async () => {
    const hash = await bcrypt.hash("password-password", 4);
    await pool.query(
      "INSERT INTO admin_users(email,display_name,password_hash,role) VALUES('viewer@example.test','Viewer',$1,'viewer')",
      [hash],
    );
    const { authorizeRequest } = await import("../../src/lib/rbac");
    const persisted = await pool.query(
      "SELECT role FROM admin_users WHERE email='viewer@example.test'",
    );
    expect(
      authorizeRequest(persisted.rows[0].role, {
        pathname: "/api/forge/projects/1/deploy",
        method: "POST",
      }),
    ).toMatchObject({ allowed: false, capability: "deployments.execute" });
  });

  it("creates Forge projects and keeps execution status separate from result quality", async () => {
    const project = await createProject();
    const task = await pool.query(
      "INSERT INTO forge_tasks(project_id,title,agent_type,status,result_quality,downstream_allowed,publication_blocked) VALUES($1,'Generate','frontend','completed','fallback',true,true) RETURNING *",
      [project],
    );
    expect(task.rows[0]).toMatchObject({
      status: "completed",
      result_quality: "fallback",
      publication_blocked: true,
    });
    await pool.query(
      "INSERT INTO forge_activity_logs(project_id,actor,action,message,metadata_json) VALUES($1,'tester','task_completed','Completed with fallback',$2)",
      [project, { taskId: task.rows[0].id }],
    );
    expect(
      (await pool.query("SELECT metadata_json FROM forge_activity_logs"))
        .rows[0].metadata_json.taskId,
    ).toBe(task.rows[0].id);
  });

  it("creates immutable artifact lineage and approval transitions", async () => {
    const project = await createProject();
    const task = (
      await pool.query(
        "INSERT INTO forge_tasks(project_id,title,agent_type,status) VALUES($1,'Copy','copy','completed') RETURNING id",
        [project],
      )
    ).rows[0].id;
    const { saveVersionedForgeArtifact } =
      await import("../../src/lib/server/forge-artifacts");
    const base = {
      projectId: project,
      type: "copy_doc" as const,
      title: "Copy",
      actor: "reviewer",
      provenance: {
        sourceTaskId: task,
        promptVersion: "1.0.0",
        schemaVersion: "1.0.0",
        inputContext: { brief: "a" },
        qualityState: "requires_review" as const,
      },
    };
    const first = await saveVersionedForgeArtifact({
      ...base,
      content: "v1",
      metadataJson: { status: "draft" },
    });
    const second = await saveVersionedForgeArtifact({
      ...base,
      content: "v2",
      metadataJson: { status: "draft" },
    });
    expect(second).toMatchObject({ version: 2, parentArtifactId: first.id });
    expect(
      (
        await pool.query(
          "SELECT superseded_at FROM forge_artifacts WHERE id=$1",
          [first.id],
        )
      ).rows[0].superseded_at,
    ).not.toBeNull();
    await pool.query(
      "UPDATE forge_artifacts SET approval_state='approved',approval_history=$2::jsonb WHERE id=$1",
      [
        second.id,
        JSON.stringify([
          { actor: "reviewer", reason: "Compared with approved brief" },
        ]),
      ],
    );
    expect(
      (
        await pool.query(
          "SELECT approval_state,approval_history FROM forge_artifacts WHERE id=$1",
          [second.id],
        )
      ).rows[0],
    ).toMatchObject({
      approval_state: "approved",
      approval_history: [
        { actor: "reviewer", reason: "Compared with approved brief" },
      ],
    });
  });

  it("atomically reserves budget under concurrent writes and reconciles usage", async () => {
    const project = await createProject();
    const tasks = await Promise.all(
      ["A", "B"].map(
        async (title) =>
          (
            await pool.query(
              "INSERT INTO forge_tasks(project_id,title,agent_type) VALUES($1,$2,'copy') RETURNING id",
              [project, title],
            )
          ).rows[0].id,
      ),
    );
    const { reserveForgeAiBudget, reconcileForgeAiBudget } =
      await import("../../src/lib/server/forge-budget-reservations");
    const env = {
      FORGE_AI_DAILY_USD_BUDGET: "1",
      FORGE_MAX_PROJECT_AI_COST: "1",
    };
    const settled = await Promise.allSettled(
      tasks.map((task, index) =>
        reserveForgeAiBudget({
          projectId: project,
          taskId: task,
          provider: "openai",
          model: "test",
          estimatedMaxCost: 0.6,
          idempotencyKey: `concurrent-${index}`,
          env,
        }),
      ),
    );
    expect(settled.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const reservation = (
      settled.find((x) => x.status === "fulfilled") as PromiseFulfilledResult<
        Awaited<ReturnType<typeof reserveForgeAiBudget>>
      >
    ).value;
    await reconcileForgeAiBudget({
      reservationId: reservation.id,
      actualCost: 0.2,
      usageKnown: true,
    });
    const row = (
      await pool.query(
        "SELECT status,reserved_cost,actual_cost FROM forge_ai_budget_reservations WHERE id=$1",
        [reservation.id],
      )
    ).rows[0];
    expect(row).toMatchObject({
      status: "reconciled",
      reserved_cost: "0.600000",
      actual_cost: "0.200000",
    });
  });

  it("adopts an existing project into one idempotent run and pauses at its human brief gate", async () => {
    const project = await createProject();
    await insertArtifact(project, "handover_doc", "brief-v1");
    const orchestration =
      await import("../../src/lib/server/forge-run-orchestrator");
    const first = await orchestration.createForgeRun({
      projectId: project,
      actor: "integration-owner",
    });
    const adopted = await orchestration.createForgeRun({
      projectId: project,
      actor: "integration-owner",
    });
    expect(adopted?.id).toBe(first?.id);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int count FROM forge_runs WHERE project_id=$1",
          [project],
        )
      ).rows[0].count,
    ).toBe(1);
    const started = await orchestration.startForgeRun(
      first!.id,
      "integration-owner",
    );
    expect(started?.status).toBe("paused");
    expect(started?.currentStage).toBe("brief");
    expect(started?.steps.find((step) => step.stage === "brief")?.status).toBe(
      "awaiting_approval",
    );
  });

  it("continues after approval, recovers idempotently, and propagates terminal job failure", async () => {
    const project = await createProject();
    await insertArtifact(project, "handover_doc", "brief-v1");
    const orchestration =
      await import("../../src/lib/server/forge-run-orchestrator");
    const run = await orchestration.createForgeRun({
      projectId: project,
      actor: "integration-owner",
    });
    await orchestration.startForgeRun(run!.id, "integration-owner");
    const approved = await orchestration.approveForgeRunStep(
      run!.id,
      "brief",
      "integration-owner",
      "Approved against the signed client brief.",
    );
    const research = approved?.steps.find((step) => step.stage === "research");
    expect(research?.status).toBe("queued");
    expect(research?.attemptCount).toBe(1);
    await orchestration.recoverForgeRuns();
    await orchestration.recoverForgeRuns();
    expect(
      (
        await pool.query(
          "SELECT count(*)::int count FROM forge_jobs WHERE idempotency_key LIKE $1",
          [`forge-run:${run!.id}:%`],
        )
      ).rows[0].count,
    ).toBe(1);
    await pool.query(
      "UPDATE forge_jobs SET status='failed',failure_reason='Provider terminal failure',attempts=max_attempts WHERE id=$1",
      [research!.jobId],
    );
    await orchestration.handleForgeRunJobOutcome(
      research!.jobId!,
      "failed",
      "Provider terminal failure",
    );
    const failed = await orchestration.loadForgeRun(run!.id);
    expect(failed?.status).toBe("failed");
    expect(
      failed?.steps.find((step) => step.stage === "research"),
    ).toMatchObject({ status: "failed", failureCategory: "provider" });
    await orchestration.retryForgeRunStep(
      run!.id,
      "research",
      "integration-owner",
    );
    const retried = await orchestration.loadForgeRun(run!.id);
    expect(retried?.status).toBe("running");
    expect(
      retried?.steps.find((step) => step.stage === "research")?.attemptCount,
    ).toBe(2);
  });

  it("invalidates only recorded downstream outputs when an approved upstream artifact changes", async () => {
    const project = await createProject();
    const brief = await insertArtifact(project, "handover_doc", "brief-v1");
    const research = await insertArtifact(
      project,
      "research_report",
      "research-v1",
    );
    await insertArtifact(project, "sitemap", "sitemap-v1");
    const orchestration =
      await import("../../src/lib/server/forge-run-orchestrator");
    const run = await orchestration.createForgeRun({
      projectId: project,
      actor: "integration-owner",
    });
    await orchestration.startForgeRun(run!.id, "integration-owner");
    await insertArtifact(project, "handover_doc", "brief-v2");
    await orchestration.approveForgeRunStep(
      run!.id,
      "brief",
      "integration-owner",
      "Approved the revised client brief.",
    );
    const stale = (
      await pool.query(
        "SELECT id,superseded_at FROM forge_artifacts WHERE id=ANY($1::int[]) ORDER BY id",
        [[brief, research]],
      )
    ).rows;
    expect(stale.find((row) => row.id === brief)?.superseded_at).toBeNull();
    expect(
      stale.find((row) => row.id === research)?.superseded_at,
    ).not.toBeNull();
    const refreshed = await orchestration.loadForgeRun(run!.id);
    expect(
      refreshed?.steps.find((step) => step.stage === "research")?.status,
    ).toBe("queued");
  });

  it("pauses rather than fails when the next automatic stage exceeds budget", async () => {
    const previous = process.env.FORGE_MAX_PROJECT_AI_COST;
    process.env.FORGE_MAX_PROJECT_AI_COST = "0.01";
    try {
      const project = await createProject();
      await insertArtifact(project, "handover_doc", "brief-v1");
      const orchestration =
        await import("../../src/lib/server/forge-run-orchestrator");
      const run = await orchestration.createForgeRun({
        projectId: project,
        actor: "integration-owner",
      });
      await orchestration.startForgeRun(run!.id, "integration-owner");
      const paused = await orchestration.approveForgeRunStep(
        run!.id,
        "brief",
        "integration-owner",
        "Approved against the signed client brief.",
      );
      expect(paused?.status).toBe("paused");
      expect(paused?.pauseReason).toContain("budget is exhausted");
      expect(
        paused?.steps.find((step) => step.stage === "research"),
      ).toMatchObject({
        status: "blocked",
        failureCategory: "budget_exceeded",
      });
    } finally {
      if (previous === undefined) delete process.env.FORGE_MAX_PROJECT_AI_COST;
      else process.env.FORGE_MAX_PROJECT_AI_COST = previous;
    }
  });

  it("approves unified intake, creates and starts one run, and deduplicates repeat submissions", async () => {
    const { interpretForgeProjectIntake } =
      await import("../../src/lib/forge-project-intake");
    const { approveUnifiedForgeIntake } =
      await import("../../src/lib/server/forge-unified-intake");
    const interpretation = interpretForgeProjectIntake({
      request:
        "Build a premium lead-generation website for Acme Commercial Roofing in Nottingham with email and WhatsApp enquiries.",
      advanced: { businessName: "Acme Commercial Roofing" },
    });
    const payload = {
      interpretation,
      summary: interpretation.summary,
      submissionKey: "integration-unified-intake-0001",
    };
    const first = await approveUnifiedForgeIntake(payload, "integration-owner");
    expect(first.status).toBe(201);
    const firstJson = await first.json();
    expect(firstJson.run.status).toBe("running");
    expect(
      firstJson.run.steps.find(
        (step: { stage: string }) => step.stage === "brief",
      ).status,
    ).toBe("completed");
    expect(firstJson.redirectTo).toContain(`forge/${firstJson.project.id}`);
    const second = await approveUnifiedForgeIntake(
      payload,
      "integration-owner",
    );
    expect(second.status).toBe(201);
    const secondJson = await second.json();
    expect(secondJson.project.id).toBe(firstJson.project.id);
    expect(
      (await pool.query("SELECT count(*)::int count FROM forge_projects"))
        .rows[0].count,
    ).toBe(1);
    expect(
      (await pool.query("SELECT count(*)::int count FROM forge_runs")).rows[0]
        .count,
    ).toBe(1);
  });

  it("allocates permanent invoice numbers only on atomic issuance and preserves snapshots", async () => {
    const actor = (
      await pool.query(
        "INSERT INTO admin_users(email,display_name,password_hash,role) VALUES('invoice@example.test','Invoice Tester','hash','finance') RETURNING id",
      )
    ).rows[0].id;
    const cak = (
      await pool.query(
        "INSERT INTO clients(name,contact_name,contact_email,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) VALUES('Confirm-a-Kill','Casey','billing@cak.test','CAK','1 Original Road','Nottingham','NG1 1AA','United Kingdom') RETURNING id",
      )
    ).rows[0].id;
    const concurrentClient = (
      await pool.query(
        "INSERT INTO clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) VALUES('Concurrent Client','CON','1 Road','Leeds','LS1 1AA','United Kingdom') RETURNING id",
      )
    ).rows[0].id;
    const noCode = (
      await pool.query(
        "INSERT INTO clients(name,billing_address_line_1,billing_city,billing_postcode,billing_country) VALUES('Needs Code','1 Road','Leeds','LS1 1AA','United Kingdom') RETURNING id",
      )
    ).rows[0].id;
    const conflictClient = (
      await pool.query(
        "INSERT INTO clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) VALUES('Conflict Client','FAIL','1 Road','Leeds','LS1 1AA','United Kingdom') RETURNING id",
      )
    ).rows[0].id;
    const catalogue = (
      await pool.query(
        "INSERT INTO invoice_catalogue_items(name,description,default_unit_amount) VALUES('Monthly Growth Retainer','Original',35000) RETURNING id",
      )
    ).rows[0].id;
    const service = await import("../../src/lib/server/invoices");
    const abandoned = await service.createInvoice(
      {
        clientId: cak,
        items: [{ title: "Abandoned", quantity: 1, unitAmount: 100 }],
      },
      actor,
    );
    expect(abandoned).toMatchObject({
      invoiceNumber: null,
      sequenceNumber: null,
      status: "draft",
    });
    const revised = await service.updateDraftInvoice(
      abandoned.id,
      { items: [{ title: "Revised draft", quantity: 2, unitAmount: 150 }] },
      actor,
    );
    expect(revised).toMatchObject({ status: "draft", total: 300 });
    expect(
      (
        await pool.query(
          "SELECT next_invoice_sequence FROM clients WHERE id=$1",
          [cak],
        )
      ).rows[0].next_invoice_sequence,
    ).toBe(1);
    await service.deleteDraftInvoice(abandoned.id);
    const firstDraft = await service.createInvoice(
      { clientId: cak, items: [{ catalogueItemId: catalogue, quantity: 1 }] },
      actor,
    );
    await pool.query(
      "UPDATE invoice_catalogue_items SET name='Changed',description='Changed',default_unit_amount=39500 WHERE id=$1",
      [catalogue],
    );
    await pool.query(
      "UPDATE clients SET name='Confirm-a-Kill Updated',billing_address_line_1='2 Issue Street',billing_postcode='NG2 2BB' WHERE id=$1",
      [cak],
    );
    const first = await service.transitionInvoice(
      firstDraft.id,
      "issue",
      actor,
    );
    expect(first).toMatchObject({
      invoiceNumber: "SS-CAK-0001",
      sequenceNumber: 1,
      status: "issued",
      clientNameSnapshot: "Confirm-a-Kill Updated",
      billingAddressLine1Snapshot: "2 Issue Street",
      billingPostcodeSnapshot: "NG2 2BB",
      documentTemplateVersion: "scalesmiths-v1",
    });
    expect(first.items[0]).toMatchObject({
      title: "Monthly Growth Retainer",
      description: "Original",
      unitAmount: 35000,
    });
    expect(Buffer.isBuffer(first.documentPdf)).toBe(true);
    expect(createHash("sha256").update(first.documentPdf!).digest("hex")).toBe(
      first.documentPdfSha256,
    );
    const documents = await import("../../src/lib/server/invoice-documents");
    expect((await documents.loadIssuedInvoicePdf(first.id))?.equals(first.documentPdf!)).toBe(true);
    await expect(service.deleteDraftInvoice(first.id)).rejects.toMatchObject({
      code: "invoice_locked",
    });
    await service.transitionInvoice(first.id, "void", actor);
    const voided = (
      await pool.query(
        "SELECT invoice_number,sequence_number,status FROM invoices WHERE id=$1",
        [first.id],
      )
    ).rows[0];
    expect(voided).toMatchObject({
      invoice_number: "SS-CAK-0001",
      sequence_number: 1,
      status: "void",
    });
    await expect(
      service.updateDraftInvoice(
        first.id,
        { items: [{ title: "Forbidden void edit", quantity: 1, unitAmount: 1 }] },
        actor,
      ),
    ).rejects.toMatchObject({ code: "invoice_locked" });
    const secondDraft = await service.createInvoice(
      {
        clientId: cak,
        items: [{ title: "Custom item", quantity: 2, unitAmount: 1250 }],
      },
      actor,
    );
    const second = await service.transitionInvoice(
      secondDraft.id,
      "issue",
      actor,
    );
    expect(second).toMatchObject({
      invoiceNumber: "SS-CAK-0002",
      sequenceNumber: 2,
    });
    expect(second.items[0]).toMatchObject({
      catalogueItemId: null,
      lineAmount: 2500,
    });
    await pool.query(
      "UPDATE clients SET name='Later Rename',billing_address_line_1='Later Address' WHERE id=$1",
      [cak],
    );
    expect(
      (
        await pool.query(
          "SELECT client_name_snapshot,billing_address_line_1_snapshot FROM invoices WHERE id=$1",
          [second.id],
        )
      ).rows[0],
    ).toMatchObject({
      client_name_snapshot: "Confirm-a-Kill Updated",
      billing_address_line_1_snapshot: "2 Issue Street",
    });
    await expect(
      service.updateDraftInvoice(
        second.id,
        {
          items: [{ title: "Forbidden", quantity: 1, unitAmount: 1 }],
          invoiceNumber: "SS-CAK-9999",
        } as never,
        actor,
      ),
    ).rejects.toMatchObject({ code: "invoice_locked" });
    const drafts = await Promise.all([
      service.createInvoice(
        {
          clientId: concurrentClient,
          items: [{ title: "One", quantity: 1, unitAmount: 1 }],
        },
        actor,
      ),
      service.createInvoice(
        {
          clientId: concurrentClient,
          items: [{ title: "Two", quantity: 1, unitAmount: 1 }],
        },
        actor,
      ),
    ]);
    const issued = await Promise.all(
      drafts.map((draft) =>
        service.transitionInvoice(draft.id, "issue", actor),
      ),
    );
    expect(issued.map((row) => row.invoiceNumber).sort()).toEqual([
      "SS-CON-0001",
      "SS-CON-0002",
    ]);
    const failed = await service.createInvoice(
      {
        clientId: noCode,
        items: [{ title: "Cannot issue", quantity: 1, unitAmount: 1 }],
      },
      actor,
    );
    await expect(
      service.transitionInvoice(failed.id, "issue", actor),
    ).rejects.toMatchObject({ code: "client_code_required" });
    expect(
      (
        await pool.query(
          "SELECT next_invoice_sequence FROM clients WHERE id=$1",
          [noCode],
        )
      ).rows[0].next_invoice_sequence,
    ).toBe(1);
    expect(
      (
        await pool.query(
          "SELECT count(*)::int count FROM invoice_audit_logs WHERE invoice_id=$1 AND action='invoice_issued'",
          [failed.id],
        )
      ).rows[0].count,
    ).toBe(0);
    const conflictDraft = await service.createInvoice(
      {
        clientId: conflictClient,
        items: [{ title: "Conflict", quantity: 1, unitAmount: 1 }],
      },
      actor,
    );
    await pool.query(
      "INSERT INTO invoices(invoice_number,client_id,sequence_number,client_code_snapshot,client_name_snapshot,currency,invoice_date,due_date,status,subtotal,total,issued_at,document_template_version,supplier_snapshot,payment_snapshot,document_pdf,document_pdf_sha256) VALUES('SS-FAIL-0001',$1,99,'FAIL','Existing','GBP',now(),now(),'issued',0,0,now(),'scalesmiths-v1','{}'::jsonb,'{}'::jsonb,$2,'fixture-sha')",
      [cak, Buffer.from("%PDF-")],
    );
    await expect(
      service.transitionInvoice(conflictDraft.id, "issue", actor),
    ).rejects.toMatchObject({ cause: { code: "23505" } });
    expect(
      (
        await pool.query(
          "SELECT next_invoice_sequence FROM clients WHERE id=$1",
          [conflictClient],
        )
      ).rows[0].next_invoice_sequence,
    ).toBe(1);
    expect(
      (
        await pool.query(
          "SELECT status,invoice_number,sequence_number,issued_at,document_template_version,supplier_snapshot,payment_snapshot,document_pdf,document_pdf_sha256 FROM invoices WHERE id=$1",
          [conflictDraft.id],
        )
      ).rows[0],
    ).toMatchObject({
      status: "draft",
      invoice_number: null,
      sequence_number: null,
      issued_at: null,
      document_template_version: null,
      supplier_snapshot: null,
      payment_snapshot: null,
      document_pdf: null,
      document_pdf_sha256: null,
    });
    expect(
      (
        await pool.query(
          "SELECT count(*)::int count FROM invoice_audit_logs WHERE invoice_id=$1 AND action='invoice_issued'",
          [conflictDraft.id],
        )
      ).rows[0].count,
    ).toBe(0);
  });

  it("links project service drafts without coupling invoice, project, or payment lifecycles", async () => {
    const actor = (await pool.query("INSERT INTO admin_users(email,display_name,password_hash,role) VALUES('project-finance@example.test','Project Finance','hash','finance') RETURNING id")).rows[0].id;
    const clientA = (await pool.query("INSERT INTO clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) VALUES('Linked Client','LINK','1 Link Road','Leeds','LS1 1AA','United Kingdom') RETURNING id")).rows[0].id;
    const clientB = (await pool.query("INSERT INTO clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) VALUES('Other Client','OTHER','2 Other Road','York','YO1 1AA','United Kingdom') RETURNING id")).rows[0].id;
    const projectA = (await pool.query("INSERT INTO delivery_projects(client_id,name) VALUES($1,'Accepted Website Build') RETURNING id", [clientA])).rows[0].id;
    const projectB = (await pool.query("INSERT INTO delivery_projects(client_id,name) VALUES($1,'Other Project') RETURNING id", [clientB])).rows[0].id;
    const catalogue = (await pool.query("INSERT INTO invoice_catalogue_items(name,description,default_unit_amount) VALUES('Website build deposit','Accepted project deposit',125000) RETURNING id")).rows[0].id;
    const assignmentA = (await pool.query("INSERT INTO client_service_assignments(client_id,catalogue_item_id,assigned_by) VALUES($1,$2,$3) RETURNING id", [clientA, catalogue, actor])).rows[0].id;
    const assignmentB = (await pool.query("INSERT INTO client_service_assignments(client_id,catalogue_item_id,assigned_by) VALUES($1,$2,$3) RETURNING id", [clientB, catalogue, actor])).rows[0].id;
    const service = await import("../../src/lib/server/invoices");

    const draft = await service.createProjectInvoiceDraft(projectA, assignmentA, actor);
    expect(draft).toMatchObject({ status: "draft", invoiceNumber: null, sequenceNumber: null, clientId: clientA, projectId: projectA, serviceAssignmentId: assignmentA, total: 125000 });
    expect(draft.items[0]).toMatchObject({ catalogueItemId: catalogue, title: "Website build deposit", unitAmount: 125000 });
    expect((await pool.query("SELECT next_invoice_sequence FROM clients WHERE id=$1", [clientA])).rows[0].next_invoice_sequence).toBe(1);

    await expect(service.createProjectInvoiceDraft(projectA, assignmentB, actor)).rejects.toMatchObject({ code: "invoice_service_client_mismatch" });
    await expect(pool.query("UPDATE invoices SET project_id=$1 WHERE id=$2", [projectB, draft.id])).rejects.toMatchObject({ code: "23503" });

    await pool.query("UPDATE clients SET name='Client Renamed Later' WHERE id=$1", [clientA]);
    await pool.query("UPDATE delivery_projects SET name='Project Renamed Later' WHERE id=$1", [projectA]);
    await pool.query("UPDATE invoice_catalogue_items SET name='Changed catalogue label',default_unit_amount=999999 WHERE id=$1", [catalogue]);
    const issued = await service.transitionInvoice(draft.id, "issue", actor);
    expect(issued).toMatchObject({ status: "issued", invoiceNumber: "SS-LINK-0001", clientNameSnapshot: "Client Renamed Later", projectId: projectA, serviceAssignmentId: assignmentA, total: 125000 });
    expect(issued.items[0]).toMatchObject({ title: "Website build deposit", unitAmount: 125000 });
    await pool.query("UPDATE clients SET name='Post-issue client rename' WHERE id=$1", [clientA]);
    await pool.query("UPDATE delivery_projects SET name='Post-issue project rename' WHERE id=$1", [projectA]);
    expect((await pool.query("SELECT client_name_snapshot,total FROM invoices WHERE id=$1", [issued.id])).rows[0]).toMatchObject({ client_name_snapshot: "Client Renamed Later", total: 125000 });
    await expect(service.updateDraftInvoice(issued.id, { projectId: projectB, items: [{ title: "Forbidden", quantity: 1, unitAmount: 1 }] }, actor)).rejects.toMatchObject({ code: "invoice_locked" });

    await pool.query("UPDATE delivery_projects SET status='paused' WHERE id=$1", [projectA]);
    expect((await pool.query("SELECT status,paid_at FROM invoices WHERE id=$1", [issued.id])).rows[0]).toMatchObject({ status: "issued", paid_at: null });
    await service.transitionInvoice(issued.id, "mark_paid", actor);
    expect((await pool.query("SELECT project_id,type,visibility FROM client_timeline_events WHERE source_reference=$1", [`invoice:${issued.id}:paid`])).rows[0]).toMatchObject({ project_id: projectA, type: "invoice_paid", visibility: "internal" });

    await pool.query("UPDATE delivery_projects SET status='cancelled' WHERE id=$1", [projectA]);
    await expect(service.createProjectInvoiceDraft(projectA, assignmentA, actor)).rejects.toMatchObject({ code: "project_not_billable" });
  });

  it("enforces portal ownership and records idempotent invoice delivery attempts", async () => {
    const previousFrom = process.env.RESEND_FROM;
    process.env.RESEND_FROM = "billing@scalesmiths.example";
    try {
      const actor = (
        await pool.query(
          "INSERT INTO admin_users(email,display_name,password_hash,role) VALUES('delivery@example.test','Delivery Tester','hash','finance') RETURNING id",
        )
      ).rows[0].id;
      await pool.query(
        "INSERT INTO portal_client_accounts(client_id,email,password_hash) VALUES('portal-a','a@example.test','hash'),('portal-b','b@example.test','hash')",
      );
      const clientA = (
        await pool.query(
          "INSERT INTO clients(name,contact_email,invoice_client_code,portal_client_id,billing_address_line_1,billing_city,billing_postcode,billing_country) VALUES('Client A','accounts-a@example.test','CLA','portal-a','1 A Road','Leeds','LS1 1AA','United Kingdom') RETURNING id",
        )
      ).rows[0].id;
      const clientB = (
        await pool.query(
          "INSERT INTO clients(name,contact_email,invoice_client_code,portal_client_id,billing_address_line_1,billing_city,billing_postcode,billing_country) VALUES('Client B','accounts-b@example.test','CLB','portal-b','1 B Road','York','YO1 1AA','United Kingdom') RETURNING id",
        )
      ).rows[0].id;
      const invoicesService = await import("../../src/lib/server/invoices");
      const delivery = await import("../../src/lib/server/invoice-delivery");
      const draftA = await invoicesService.createInvoice(
        {
          clientId: clientA,
          internalNotes: "never expose",
          items: [{ title: "Retainer", quantity: 1, unitAmount: 35000 }],
        },
        actor,
      );
      const unpublished = await invoicesService.transitionInvoice(
        draftA.id,
        "issue",
        actor,
      );
      expect(
        (await pool.query(
          "SELECT invoice_number FROM invoices i JOIN clients c ON c.id=i.client_id WHERE c.portal_client_id=$1 AND i.portal_published_at IS NOT NULL AND i.status <> 'draft'",
          ["portal-a"],
        )).rows,
      ).toEqual([]);
      await delivery.publishInvoiceToPortal(unpublished.id, actor);
      expect(
        (await pool.query(
          "SELECT i.invoice_number FROM invoices i JOIN clients c ON c.id=i.client_id WHERE c.portal_client_id=$1 AND i.portal_published_at IS NOT NULL AND i.status <> 'draft' ORDER BY i.invoice_date DESC",
          ["portal-a"],
        )).rows.map((row) => row.invoice_number),
      ).toEqual(["SS-CLA-0001"]);
      expect(
        (await pool.query(
          "SELECT i.id, i.document_pdf FROM invoices i JOIN clients c ON c.id=i.client_id WHERE c.portal_client_id=$1 AND i.invoice_number=$2 AND i.portal_published_at IS NOT NULL AND i.status <> 'draft'",
          ["portal-b", "SS-CLA-0001"],
        )).rows,
      ).toEqual([]);
      const ownInvoice = (await pool.query<{ id: number; document_pdf: Buffer }>(
        "SELECT i.id, i.document_pdf FROM invoices i JOIN clients c ON c.id=i.client_id WHERE c.portal_client_id=$1 AND i.invoice_number=$2 AND i.portal_published_at IS NOT NULL AND i.status <> 'draft'",
        ["portal-a", "SS-CLA-0001"],
      )).rows[0];
      expect(ownInvoice.document_pdf.equals(Buffer.from(unpublished.documentPdf!))).toBe(true);
      await pool.query(
        "INSERT INTO invoice_portal_access_events(invoice_id,portal_client_id,access_type) VALUES($1,$2,$3)",
        [ownInvoice.id, "portal-a", "download"],
      );
      const sentInputs: Array<{
        to: string;
        filename: string;
        content: Buffer;
      }> = [];
      const fake = {
        send: async (input: {
          to: string;
          attachment: { filename: string; content: Buffer };
        }) => {
          sentInputs.push({
            to: input.to,
            filename: input.attachment.filename,
            content: input.attachment.content,
          });
          return { id: "provider-1" };
        },
      };
      const first = await delivery.sendInvoiceDelivery(
        {
          invoiceId: unpublished.id,
          kind: "invoice",
          operationKey: "same-operation",
          actorUserId: actor,
        },
        fake as never,
      );
      const duplicate = await delivery.sendInvoiceDelivery(
        {
          invoiceId: unpublished.id,
          kind: "invoice",
          operationKey: "same-operation",
          actorUserId: actor,
        },
        fake as never,
      );
      expect(first).toMatchObject({
        state: "sent",
        recipient: "accounts-a@example.test",
      });
      expect(duplicate.id).toBe(first.id);
      expect(sentInputs).toHaveLength(1);
      expect(sentInputs[0]).toMatchObject({
        to: "accounts-a@example.test",
        filename: "SS-CLA-0001.pdf",
      });
      expect(sentInputs[0].content.equals(ownInvoice.document_pdf)).toBe(true);
      const reminder = await delivery.sendInvoiceDelivery(
        {
          invoiceId: unpublished.id,
          kind: "reminder",
          operationKey: "eligible-reminder",
          actorUserId: actor,
        },
        fake as never,
      );
      expect(reminder).toMatchObject({ state: "sent" });
      expect(sentInputs[1].content.equals(ownInvoice.document_pdf)).toBe(true);
      const failed = await delivery.sendInvoiceDelivery(
        {
          invoiceId: unpublished.id,
          kind: "invoice",
          recipient: "override@example.test",
          operationKey: "failed-operation",
          actorUserId: actor,
        },
        {
          send: async () => {
            throw new Error("secret provider response");
          },
        },
      );
      expect(failed).toMatchObject({
        state: "failed",
        recipient: "override@example.test",
        failureCategory: "provider_delivery",
      });
      expect(failed.failureMessage).not.toContain("secret provider response");
      expect(
        (
          await pool.query(
            "SELECT status,billing_email_snapshot FROM invoices WHERE id=$1",
            [unpublished.id],
          )
        ).rows[0],
      ).toMatchObject({
        status: "issued",
        billing_email_snapshot: "accounts-a@example.test",
      });
      const bDraft = await invoicesService.createInvoice(
        {
          clientId: clientB,
          items: [{ title: "Draft", quantity: 1, unitAmount: 100 }],
        },
        actor,
      );
      expect(
        await delivery
          .publishInvoiceToPortal(bDraft.id, actor)
          .catch((error) => error.code),
      ).toBe("invoice_not_issued");
      await invoicesService.transitionInvoice(
        unpublished.id,
        "mark_paid",
        actor,
      );
      expect(
        (
          await pool.query(
            "SELECT i.status FROM invoices i JOIN clients c ON c.id=i.client_id WHERE c.portal_client_id=$1 AND i.invoice_number=$2 AND i.portal_published_at IS NOT NULL AND i.status <> 'draft'",
            ["portal-a", "SS-CLA-0001"],
          )
        ).rows[0],
      ).toMatchObject({ status: "paid" });
      await expect(
        delivery.sendInvoiceDelivery(
          { invoiceId: unpublished.id, kind: "reminder", actorUserId: actor },
          fake as never,
        ),
      ).rejects.toMatchObject({ code: "reminder_not_allowed" });
      const bIssued = await invoicesService.transitionInvoice(bDraft.id, "issue", actor);
      await delivery.publishInvoiceToPortal(bIssued.id, actor);
      await invoicesService.transitionInvoice(bIssued.id, "void", actor);
      expect(
        (
          await pool.query(
            "SELECT i.status FROM invoices i JOIN clients c ON c.id=i.client_id WHERE c.portal_client_id=$1 AND i.invoice_number=$2 AND i.portal_published_at IS NOT NULL AND i.status <> 'draft'",
            ["portal-b", "SS-CLB-0001"],
          )
        ).rows[0],
      ).toMatchObject({ status: "void" });
      await expect(
        delivery.sendInvoiceDelivery(
          { invoiceId: bIssued.id, kind: "reminder", actorUserId: actor },
          fake as never,
        ),
      ).rejects.toMatchObject({ code: "reminder_not_allowed" });
    } finally {
      if (previousFrom === undefined) delete process.env.RESEND_FROM;
      else process.env.RESEND_FROM = previousFrom;
    }
  });

  it("rolls back all writes when a transaction fails", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO forge_projects(name,business_name) VALUES('Rollback','Rollback Ltd')",
      );
      await client.query(
        "INSERT INTO forge_tasks(project_id,title,agent_type) VALUES(999999,'Invalid','copy')",
      );
      await client.query("COMMIT");
    } catch {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    expect(
      (
        await pool.query(
          "SELECT count(*)::int count FROM forge_projects WHERE name='Rollback'",
        )
      ).rows[0].count,
    ).toBe(0);
  });

  it("enforces delivery ownership, derives progress, and audits lifecycle changes", async () => {
    const actor = (await pool.query(
      "INSERT INTO admin_users(email,display_name,password_hash,role) VALUES('delivery@example.test','Delivery Manager','test-hash','project_manager') RETURNING id",
    )).rows[0].id as string;
    const clientId = (await pool.query(
      "INSERT INTO clients(name,portal_client_id) VALUES('Delivery Client','delivery-client') RETURNING id",
    )).rows[0].id as number;
    const otherClientId = (await pool.query("INSERT INTO clients(name) VALUES('Other Client') RETURNING id")).rows[0].id as number;
    const forgeProjectId = (await pool.query(
      "INSERT INTO forge_projects(name,business_name,client_id) VALUES('Delivery Build','Delivery Client',$1) RETURNING id",
      [clientId],
    )).rows[0].id as number;
    const foreignForgeId = (await pool.query(
      "INSERT INTO forge_projects(name,business_name,client_id) VALUES('Foreign Build','Other Client',$1) RETURNING id",
      [otherClientId],
    )).rows[0].id as number;
    const service = await import("../../src/lib/server/delivery-project-service");
    const deliveryActor = { id: actor, email: "delivery@example.test" };

    await expect(service.createDeliveryProject({ clientId, name: "Invalid link", forgeProjectId: foreignForgeId }, deliveryActor))
      .rejects.toMatchObject({ status: 409 });

    const project = await service.createDeliveryProject({ clientId, name: "Website launch", summary: "A client-visible delivery plan.", clientVisible: true, forgeProjectId }, deliveryActor);
    const discovery = await service.createDeliveryMilestone(project.id, { title: "Discovery", weight: 2, clientVisible: true }, deliveryActor);
    await service.updateDeliveryMilestone(project.id, discovery.id, { status: "completed" }, deliveryActor);
    const build = await service.createDeliveryMilestone(project.id, { title: "Build", status: "active", weight: 3, clientVisible: true }, deliveryActor);
    expect((await service.getDeliveryProjectForAdmin(project.id)).progress).toBe(40);

    await service.updateDeliveryMilestone(project.id, build.id, { status: "completed" }, deliveryActor);
    await service.updateDeliveryProject(project.id, { status: "completed", currentPhase: "launch" }, deliveryActor);
    const detail = await service.getDeliveryProjectForAdmin(project.id);
    expect(detail.progress).toBe(100);
    expect(detail.project).toMatchObject({ status: "completed", forgeProjectId });
    expect(detail.audit.map((entry) => entry.action)).toEqual(expect.arrayContaining(["project_created", "milestone_created", "milestone_updated", "project_updated"]));
    expect((await pool.query("SELECT count(*)::int count FROM client_timeline_events WHERE client_id='delivery-client' AND project_id=$1", [project.id])).rows[0].count).toBeGreaterThanOrEqual(3);

    const webPool = new Pool({ connectionString: webUrl });
    try {
      const portalRows = await webPool.query(
        "SELECT p.id, progress.progress FROM delivery_projects p JOIN clients c ON c.id=p.client_id JOIN delivery_project_progress progress ON progress.project_id=p.id WHERE c.portal_client_id=$1 AND p.client_visible=true",
        ["delivery-client"],
      );
      expect(portalRows.rows).toEqual([{ id: project.id, progress: 100 }]);
      await expect(webPool.query("SELECT * FROM delivery_project_audit_logs")).rejects.toMatchObject({ code: "42501" });
    } finally { await webPool.end(); }
  });
  it("preserves published monthly report snapshots and their publication audit", async () => {
    const report = (await pool.query(
      "INSERT INTO monthly_reports(client_id,month,year,title,summary,html_content,status,generated_by,version,source_snapshot,reviewed_at,reviewed_by) VALUES('report-client',8,2026,'August report','Evidence summary','<p>Evidence</p>','draft','manual',1,$1,now(),'Reviewer') RETURNING id",
      [{ schemaVersion: 1, requestsResolved: [{ id: 9, title: "Client-visible request" }] }],
    )).rows[0];
    await pool.query("UPDATE monthly_reports SET status='published',published_at=now(),published_by='Publisher' WHERE id=$1", [report.id]);
    await pool.query("INSERT INTO monthly_report_audit_logs(report_id,client_id,action,actor,metadata_json) VALUES($1,'report-client','published','Publisher',$2)", [report.id, { version: 1 }]);

    await expect(pool.query("UPDATE monthly_reports SET summary='Changed history' WHERE id=$1", [report.id])).rejects.toMatchObject({ message: expect.stringContaining("published monthly reports are immutable") });
    await expect(pool.query("DELETE FROM monthly_reports WHERE id=$1", [report.id])).rejects.toMatchObject({ message: expect.stringContaining("published monthly reports are immutable") });
    expect((await pool.query("SELECT action,actor FROM monthly_report_audit_logs WHERE report_id=$1", [report.id])).rows).toEqual([{ action: "published", actor: "Publisher" }]);
  });

  it("offboards without deleting financial or production-history records and supports controlled reactivation", async () => {
    const actor = (await pool.query("INSERT INTO admin_users(email,display_name,password_hash,role) VALUES('offboarding@example.test','Offboarding Owner','hash','owner') RETURNING id")).rows[0].id as string;
    const clientId = (await pool.query("INSERT INTO clients(name,portal_client_id,mrr) VALUES('Archive Me','archive-me',25000) RETURNING id")).rows[0].id as number;
    await pool.query("INSERT INTO portal_client_accounts(client_id,email,password_hash,active,status) VALUES('archive-me','client@example.test','hash',true,'active')");
    const catalogueId = (await pool.query("INSERT INTO invoice_catalogue_items(name,default_unit_amount) VALUES('Retainer',25000) RETURNING id")).rows[0].id as number;
    await pool.query("INSERT INTO client_service_assignments(client_id,catalogue_item_id,active) VALUES($1,$2,true)", [clientId, catalogueId]);
    await pool.query("INSERT INTO client_analytics_configs(client_id,provider,display_name,consent_granted,retention_days,enabled,credentials_encrypted,source_attribution,created_by) VALUES($1,'google_analytics','GA4',true,30,true,'encrypted-secret','GA4','operator')", [clientId]);
    const projectId = (await pool.query("INSERT INTO delivery_projects(client_id,name,status,client_visible) VALUES($1,'Production website','active',true) RETURNING id", [clientId])).rows[0].id as number;
    await pool.query("INSERT INTO client_requests(client_id,title,description,status) VALUES('archive-me','Final request','Close this request','in_progress')");
    const invoiceId = (await pool.query("INSERT INTO invoices(client_id,client_name_snapshot,invoice_date,due_date,status,subtotal,total) VALUES($1,'Archive Me',now(),now() + interval '14 days','draft',25000,25000) RETURNING id", [clientId])).rows[0].id as number;
    const service = await import("../../src/lib/server/client-offboarding");
    const admin = { id: actor, email: "offboarding@example.test", displayName: "Offboarding Owner" };
    const offboarding = await service.startClientOffboarding(clientId, { retentionReviewAt: "2032-01-01", retentionNotes: "Review by category.", productionHandoffNotes: "Client owns production; leave untouched." }, admin);
    const detail = await service.getClientOffboarding(clientId);
    for (const item of detail.items) await service.updateOffboardingItem(clientId, offboarding.id, item.id, { status: "completed", evidence: "Operator evidence recorded.", confirmation: item.destructive ? `CONFIRM ${item.itemKey}` : undefined }, admin);
    await service.completeClientOffboarding(clientId, offboarding.id, { confirmation: "OFFBOARD Archive Me", productionAction: "leave_untouched" }, admin);

    expect((await pool.query("SELECT status,mrr FROM clients WHERE id=$1", [clientId])).rows[0]).toEqual({ status: "archived", mrr: 0 });
    expect((await pool.query("SELECT active,status FROM portal_client_accounts WHERE client_id='archive-me'")).rows[0]).toEqual({ active: false, status: "disabled" });
    expect((await pool.query("SELECT status,client_visible FROM delivery_projects WHERE id=$1", [projectId])).rows[0]).toEqual({ status: "cancelled", client_visible: false });
    expect((await pool.query("SELECT count(*)::int count FROM invoices WHERE id=$1", [invoiceId])).rows[0].count).toBe(1);
    expect((await pool.query("SELECT enabled,credentials_encrypted FROM client_analytics_configs WHERE client_id=$1", [clientId])).rows[0]).toEqual({ enabled: false, credentials_encrypted: null });
    expect((await pool.query("SELECT action FROM client_offboarding_audit_logs WHERE case_id=$1 ORDER BY id DESC LIMIT 1", [offboarding.id])).rows[0].action).toBe("offboarding_completed");

    await service.reactivateClient(clientId, offboarding.id, { confirmation: "REACTIVATE Archive Me" }, admin);
    expect((await pool.query("SELECT status FROM clients WHERE id=$1", [clientId])).rows[0].status).toBe("active");
    expect((await pool.query("SELECT active FROM portal_client_accounts WHERE client_id='archive-me'")).rows[0].active).toBe(false);
    expect((await pool.query("SELECT active FROM client_service_assignments WHERE client_id=$1", [clientId])).rows[0].active).toBe(false);
  });
});
async function createProject() {
  return (
    await pool.query(
      "INSERT INTO forge_projects(name,business_name,status) VALUES('Integration Site','Integration Ltd','intake') RETURNING id",
    )
  ).rows[0].id as number;
}
async function insertArtifact(projectId: number, type: string, hash: string) {
  return (
    await pool.query(
      "INSERT INTO forge_artifacts(project_id,type,title,content,output_hash,quality_state,approval_state) VALUES($1,$2,'Integration artifact','{}',$3,'validated','approved') RETURNING id",
      [projectId, type, hash],
    )
  ).rows[0].id as number;
}
function roleUrl(base: string, username: string, password: string) {
  const value = new URL(base);
  value.username = username;
  value.password = password;
  return value.toString();
}
