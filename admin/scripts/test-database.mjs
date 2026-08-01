import process from "node:process"
import bcrypt from "bcryptjs"
import { Client } from "pg"
import { assertIsolatedAdminTestDatabase } from "./test-database-guard.mjs"

const REQUIRED_MARKER = "scalesmiths-forge-v2-admin-isolated-test-v1"
const FIXTURE_OWNER_EMAIL = "forge-owner@example.test"
const command = process.argv[2]
const databaseUrl = process.env.ADMIN_DATABASE_URL ?? process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL

if (!["prepare", "assert", "seed", "reset", "cleanup"].includes(command ?? "")) {
  throw new Error("Usage: node scripts/test-database.mjs prepare|assert|seed|reset|cleanup")
}

const { databaseName, host } = assertIsolatedAdminTestDatabase(databaseUrl, process.env.SCALESMITHS_TEST_ENVIRONMENT)
const client = new Client({ connectionString: databaseUrl })
await client.connect()

try {
  const connected = await client.query("select current_database() as database")
  if (connected.rows[0]?.database !== databaseName) throw new Error("Connected database differs from the guarded target.")
  if (command !== "prepare") await assertMarker(client)

  if (command === "prepare" || command === "reset" || command === "cleanup") {
    await client.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public")
    if (command !== "cleanup") await createMarker(client)
  }
  if (command === "seed") await seed(client)
  if (command === "assert") await assertFixture(client)
  console.log(`Admin test database ${command} passed for ${host}/${databaseName}.`)
} finally {
  await client.end()
}

async function createMarker(db) {
  await db.query(`
    create table public.scalesmiths_test_environment (
      marker text primary key,
      created_at timestamptz not null default now()
    )
  `)
  await db.query("insert into public.scalesmiths_test_environment(marker) values ($1)", [REQUIRED_MARKER])
}

async function assertMarker(db) {
  const marker = await db.query(
    "select marker from public.scalesmiths_test_environment where marker = $1",
    [REQUIRED_MARKER],
  ).catch(() => ({ rowCount: 0 }))
  if (marker.rowCount !== 1) throw new Error("Isolated admin test database marker is missing.")
}

async function seed(db) {
  const password = process.env.ADMIN_E2E_PASSWORD
  if (!password || password.length < 12) throw new Error("ADMIN_E2E_PASSWORD must contain at least 12 characters.")
  const passwordHash = await bcrypt.hash(password, 12)

  await db.query("begin")
  try {
    await db.query("delete from login_rate_limits; delete from rate_limit_counters")
    await db.query(`
      insert into admin_users (email, display_name, password_hash, role, active, mfa_enabled)
      values ($1, 'Forge Release Owner', $2, 'owner', true, false)
      on conflict ((lower(email))) do update set
        display_name = excluded.display_name,
        password_hash = excluded.password_hash,
        role = 'owner',
        active = true,
        mfa_enabled = false,
        mfa_state = null,
        session_version = admin_users.session_version + 1,
        updated_at = now()
    `, [FIXTURE_OWNER_EMAIL, passwordHash])

    await db.query(`
      insert into admin_users (email, display_name, password_hash, role, active, mfa_enabled)
      values ('forge-logout@example.test', 'Forge Logout Fixture', $1, 'developer', true, false)
      on conflict ((lower(email))) do update set
        display_name = excluded.display_name,
        password_hash = excluded.password_hash,
        role = 'developer',
        active = true,
        mfa_enabled = false,
        mfa_state = null,
        session_version = admin_users.session_version + 1,
        updated_at = now()
    `, [passwordHash])

    await db.query("delete from forge_projects where owner_actor = $1", [FIXTURE_OWNER_EMAIL])
    for (const fixture of fixtures()) await seedProject(db, fixture)

    await db.query(`
      insert into forge_worker_heartbeats
        (worker_id, process_id, hostname, last_heartbeat_at, active_job_count, metadata_json)
      values ('forge-e2e-worker', 4242, 'forge-e2e-host', now(), 1, '{"fixture":true}'::jsonb)
      on conflict (worker_id) do update set
        last_heartbeat_at = excluded.last_heartbeat_at,
        active_job_count = excluded.active_job_count,
        metadata_json = excluded.metadata_json
    `)
    await db.query("commit")
  } catch (error) {
    await db.query("rollback")
    throw error
  }
}

function fixtures() {
  return [
    { key: "prompt", name: "E2E Prompt Project", status: "intake", run: "draft", stage: "intake", step: "pending" },
    { key: "url", name: "E2E URL Project", status: "research", run: "running", stage: "research", step: "running" },
    { key: "active", name: "E2E Active Run", status: "build", run: "running", stage: "code_generation", step: "running" },
    { key: "paused", name: "E2E Paused Run", status: "copy", run: "paused", stage: "copy", step: "awaiting_approval", pause: "Operator requested pause." },
    { key: "provider", name: "E2E Provider Failure", status: "copy", run: "paused", stage: "copy", step: "failed", failure: "provider_unavailable" },
    { key: "qa", name: "E2E QA Failure", status: "qa", run: "paused", stage: "functional_qa", step: "failed", failure: "quality_failure" },
    { key: "preview", name: "E2E Preview Ready", status: "preview", run: "paused", stage: "preview", step: "awaiting_approval", pause: "Preview approval required." },
    { key: "feedback", name: "E2E Feedback Ready", status: "preview", run: "paused", stage: "preview", step: "awaiting_approval", pause: "Preview feedback ready." },
    { key: "deploy", name: "E2E Deployment Blocked", status: "ready_to_deploy", run: "paused", stage: "deploy_readiness", step: "awaiting_approval", pause: "Deployment approval required." },
  ]
}

async function seedProject(db, fixture) {
  const hasGeneratedBuild = fixture.key === "preview" || fixture.key === "feedback" || fixture.key === "deploy"
  const primaryArtifactTitle = hasGeneratedBuild ? "Generated Site Code Summary" : `${fixture.name} artifact`
  const primaryArtifactMetadata = hasGeneratedBuild ? {
    fixture: true,
    kind: "forge_generated_site_code",
    summary: {
      kind: "forge_generated_site_code",
      workspacePath: `generated-sites/e2e-${fixture.key}`,
      fileCount: 3,
      routeCount: 1,
      routes: ["/"],
      components: ["Header", "Main", "Footer"],
      generatedAt: new Date().toISOString(),
    },
  } : { fixture: true }
  const project = await db.query(`
    insert into forge_projects
      (name, business_name, industry, website_url, status, priority, owner_actor, target_audience, primary_goal, budget_range, deadline)
    values ($1, $2, 'Professional services', $3, $4, 'high', $5, 'Local commercial buyers', 'Generate qualified enquiries', 'GBP 8,000-15,000', now() + interval '30 days')
    returning id
  `, [fixture.name, `${fixture.name} Ltd`, fixture.key === "url" ? "https://example.test" : null, fixture.status, FIXTURE_OWNER_EMAIL])
  const projectId = project.rows[0].id

  const task = await db.query(`
    insert into forge_tasks
      (project_id, title, description, agent_type, status, result_quality, downstream_allowed,
       human_approval_required, publication_blocked, input_json, output_json, started_at, completed_at)
    values ($1, $2, 'Deterministic Forge V2 release fixture.', $3, $4, $5, $6, $7, $8,
            '{"fixture":true}'::jsonb, '{"fixture":true}'::jsonb,
            case when $4::forge_task_status <> 'queued' then now() - interval '5 minutes' end,
            case when $4::forge_task_status = 'completed' then now() end)
    returning id
  `, [
    projectId,
    `${fixture.stage} fixture`,
    fixture.stage === "functional_qa" ? "qa" : fixture.stage === "copy" ? "copy" : "strategy",
    fixture.step === "failed" ? "failed" : fixture.step === "running" ? "running" : "completed",
    fixture.step === "failed" ? "failed" : fixture.step === "awaiting_approval" ? "requires_review" : "validated",
    fixture.step !== "failed",
    fixture.step === "awaiting_approval",
    fixture.step !== "complete",
  ])

  const artifact = await db.query(`
    insert into forge_artifacts
      (project_id, type, title, content, metadata_json, quality_state, approval_state, actor, content_bytes)
    values ($1, $2, $3, 'Deterministic release fixture content.', $4::jsonb,
            $5, $6, $7, 38)
    returning id
  `, [
    projectId,
    fixture.key === "qa" ? "qa_report" : fixture.key === "preview" || fixture.key === "feedback" || fixture.key === "deploy" ? "generated_code" : "handover_doc",
    primaryArtifactTitle,
    JSON.stringify(primaryArtifactMetadata),
    fixture.step === "failed" ? "failed" : "validated",
    fixture.step === "awaiting_approval" ? "unapproved" : "approved",
    FIXTURE_OWNER_EMAIL,
  ])

  const run = await db.query(`
    insert into forge_runs
      (project_id, mode, status, current_stage, policy_json, started_by, started_at, paused_at,
       pause_reason, estimated_cost_usd, actual_cost_usd)
    values ($1, 'standard', $2, $3, '{"fixture":true,"budgetUsd":25}'::jsonb, $4,
            case when $2 <> 'draft' then now() - interval '10 minutes' end,
            case when $2 = 'paused' then now() - interval '2 minutes' end,
            $5, 12.50, 2.25)
    returning id
  `, [projectId, fixture.run, fixture.stage, FIXTURE_OWNER_EMAIL, fixture.pause ?? (fixture.failure ? `${fixture.failure} requires attention.` : null)])
  const runId = run.rows[0].id

  if (hasGeneratedBuild) {
    const now = new Date().toISOString()
    await db.query(`
      insert into forge_memories (project_id, key, value, source)
      values ($1, 'generated_site_workspace', $2, 'forge-e2e-fixture')
    `, [projectId, JSON.stringify({
      projectId,
      slug: `e2e-${fixture.key}`,
      relativePath: `generated-sites/e2e-${fixture.key}`,
      template: "next-ts-tailwind",
      fileCount: 3,
      createdAt: now,
      updatedAt: now,
    })])
  }

  const operatorError = fixture.failure ? {
    stage: fixture.stage,
    category: fixture.failure,
    summary: fixture.failure === "provider_unavailable" ? "Anthropic is unavailable; OpenAI fallback is healthy." : "Functional QA failed.",
    technicalReference: `fixture-${fixture.key}`,
    retryable: true,
    recommendedAction: "Retry with the deterministic fallback.",
    affectedArtifactIds: [artifact.rows[0].id],
    runId,
    timestamp: new Date().toISOString(),
    metadata: { fixture: true },
  } : null
  await db.query(`
    insert into forge_run_steps
      (run_id, project_id, stage, status, sequence, required, output_artifact_ids, task_id,
       attempt_count, max_attempts, approval_required, failure_category, failure_message,
       operator_error_json, estimated_cost_usd, remaining_estimated_cost_usd, started_at)
    values ($1, $2, $3, $4, 1, true, $5, $6, $7, 3, $8, $9, $10, $11, 2.00, 8.00,
            case when $4 <> 'pending' then now() - interval '5 minutes' end)
  `, [
    runId, projectId, fixture.stage, fixture.step, JSON.stringify([artifact.rows[0].id]), task.rows[0].id,
    fixture.step === "failed" ? 2 : 1, fixture.step === "awaiting_approval", fixture.failure ?? null,
    operatorError?.summary ?? null, operatorError,
  ])
  if (fixture.key === "preview" || fixture.key === "feedback") {
    const sitemapStrategy = {
      strategySummary: "Deterministic approved sitemap fixture.",
      selectedStrategyPack: "professional_services",
      strategyPackRationale: "Matches the isolated professional-services fixture.",
      sitemap: [{
        title: "Home",
        path: "/",
        pagePurpose: "Generate qualified enquiries.",
        targetKeyword: "professional services",
        searchIntent: "commercial",
        primaryCta: "Request a quote",
        trustElements: ["Verified fixture"],
        schemaRecommendation: "Organization",
        conversionNotes: "Keep the primary CTA visible.",
        priority: "primary",
      }],
      conversionNotes: ["Preserve the approved commercial route."],
      internalLinkingPlan: ["Home links to contact."],
      priorityBuildOrder: ["/"],
    }
    const sitemapMetadata = JSON.stringify({
      fixture: true,
      kind: "forge_sitemap_strategy",
      status: "approved",
      strategy: sitemapStrategy,
      approvedStrategy: sitemapStrategy,
      approvedAt: new Date().toISOString(),
      approvedBy: FIXTURE_OWNER_EMAIL,
    })
    const scopedArtifacts = await db.query(`
      insert into forge_artifacts
        (project_id, type, title, content, metadata_json, quality_state, approval_state, actor, content_bytes)
      values
        ($1, 'research_report', 'E2E unaffected research', 'Approved research remains valid.',
         '{"fixture":true,"scope":"unaffected"}'::jsonb, 'validated', 'approved', $2, 32),
        ($1, 'copy_doc', 'E2E approved copy', 'Approved copy remains current.',
         '{"fixture":true,"scope":"unaffected"}'::jsonb, 'validated', 'approved', $2, 30),
        ($1, 'design_direction', 'E2E affected design', 'Approved design before feedback.',
         '{"fixture":true,"scope":"affected"}'::jsonb, 'validated', 'approved', $2, 32),
        ($1, 'sitemap', 'Sitemap & Strategy', 'Approved sitemap fixture.',
         $3::jsonb, 'validated', 'approved', $2, 26)
      returning id, type
    `, [projectId, FIXTURE_OWNER_EMAIL, sitemapMetadata])
    const artifactByType = new Map(scopedArtifacts.rows.map((row) => [row.type, row.id]))
    await db.query(`
      insert into forge_run_steps
        (run_id, project_id, stage, status, sequence, required, output_artifact_ids, attempt_count,
         max_attempts, approval_required, estimated_cost_usd, remaining_estimated_cost_usd,
         started_at, completed_at)
      values
        ($1, $2, 'research', 'completed', 2, true, $3, 1, 3, false, 1.00, 0, now() - interval '9 minutes', now() - interval '8 minutes'),
        ($1, $2, 'copy', 'completed', 3, true, $4, 1, 3, false, 1.00, 0, now() - interval '8 minutes', now() - interval '7 minutes'),
        ($1, $2, 'design_direction', 'completed', 4, true, $5, 1, 3, false, 1.00, 0, now() - interval '7 minutes', now() - interval '6 minutes')
    `, [
      runId,
      projectId,
      JSON.stringify([artifactByType.get("research_report")]),
      JSON.stringify([artifactByType.get("copy_doc")]),
      JSON.stringify([artifactByType.get("design_direction")]),
    ])
  }
  await db.query(`
    insert into forge_run_events (run_id, event_type, actor, message, metadata_json)
    values ($1, 'fixture_seeded', $2, $3, '{"fixture":true}'::jsonb)
  `, [runId, FIXTURE_OWNER_EMAIL, `${fixture.name} seeded for release validation.`])
  await db.query(`
    insert into forge_activity_logs (project_id, actor, action, message, metadata_json)
    values ($1, $2, 'fixture_seeded', $3, '{"fixture":true}'::jsonb)
  `, [projectId, FIXTURE_OWNER_EMAIL, `${fixture.name} activity fixture.`])
}

async function assertFixture(db) {
  const migration = await db.query(`
    select to_regclass('drizzle.__drizzle_migrations')::text as journal,
           (select count(*)::int from drizzle.__drizzle_migrations) as migration_count
  `)
  if (!migration.rows[0]?.journal || migration.rows[0].migration_count < 1) {
    throw new Error("Admin migration journal is missing or empty.")
  }
  const fixture = await db.query(`
    select
      (select count(*)::int from admin_users where lower(email) = $1 and role = 'owner' and active) as owners,
      (select count(*)::int from forge_projects where owner_actor = $1) as projects,
      (select count(*)::int from forge_runs r join forge_projects p on p.id = r.project_id where p.owner_actor = $1) as runs,
      (select count(*)::int from forge_worker_heartbeats where worker_id = 'forge-e2e-worker') as workers
  `, [FIXTURE_OWNER_EMAIL])
  const row = fixture.rows[0]
  if (row.owners !== 1 || row.projects !== 9 || row.runs !== 9 || row.workers !== 1) {
    throw new Error(`Admin fixture is incomplete: ${JSON.stringify(row)}.`)
  }
}
