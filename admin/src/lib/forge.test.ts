import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import {
  FORGE_AI_MODEL_ROUTES,
  FORGE_AI_TEST_SCHEMA,
  assertForgeAiBudgetAllowsRequest,
  buildForgeTaskOutputMetadata,
  createMockStructuredResponse,
  estimateForgeAiCostUsd,
  getForgeAiBudgetDate,
  parseAndValidateStructuredJson,
  resolveForgeAiBudgetConfig,
  resolveForgeAiModel,
  resolveForgeAiProvider,
  supportsOpenAiTemperature,
  validateJsonSchemaValue,
} from "./forge-ai"
import {
  buildForgeAiBudgetStatus,
  formatForgeAiCost,
  parseForgeAiCostLimit,
  resolveForgeAiCostBudgetConfig,
} from "./forge-ai-usage"
import {
  FORGE_ARTIFACT_TYPES,
  FORGE_DASHBOARD_CARDS,
  FORGE_INTEGRATION_PROVIDERS,
  FORGE_INTAKE_ARTIFACT_KIND,
  FORGE_PROJECT_STATUSES,
  FORGE_ROUTE,
  FORGE_TASK_AGENT_TYPES,
  FORGE_TASK_STATUSES,
  FORGE_WORKFLOW_STAGES,
  buildForgeIntakeSummary,
  emptyForgeIntakeData,
  getForgeDashboardCard,
  getForgeIntakeMissingFields,
  parseForgeActivityLogPayload,
  parseForgeArtifactPayload,
  parseForgeIntegrationConfigPayload,
  parseForgeIntakePayload,
  parseForgeMemoryPayload,
  parseForgeProjectPayload,
  parseForgeTaskPayload,
  readForgeIntakeArtifact,
  redactIntegrationConfig,
} from "./forge"
import {
  applyForgeBuildBriefAnswer,
  createForgeBuildBriefFromPrompt,
  fallbackForgeBuildBriefQuestion,
  finalizeForgeBuildBriefIntake,
} from "./forge-intake-brief"
import { selectForgeStrategyPack } from "./forge-strategy-packs"
import {
  FORGE_GENERATED_SITES_DIR,
  FORGE_WORKSPACE_MEMORY_KEY,
  FORGE_WORKSPACE_TEMPLATE,
  assertForgeWorkspaceContentSafe,
  assertForgeWorkspaceFileAllowed,
  assertForgeWorkspaceFilenameSafe,
  assertForgeWorkspacePathAllowlisted,
  buildForgeWorkspaceRelativePath,
  buildForgeWorkspaceSlug,
  canDeleteForgeWorkspace,
  normalizeForgeWorkspacePath,
  readForgeWorkspaceMemory,
} from "./forge-workspace"
import {
  buildForgeRateLimitKey,
  checkForgeRateLimit,
  isForgeMutatingMethod,
  isForgeTaskEndpoint,
  redactForgeSecrets,
  resolveForgeRateLimitConfig,
  type ForgeRateLimitStore,
} from "./forge-security"
import { buildForgeGeneratedProcessEnv } from "./forge-process-env"
import { isBuildPhaseWithoutDatabase } from "./build-env"
import {
  buildForgeArtifactVersionMetadata,
  compactForgeLargeLog,
  resolveForgeArtifactRetentionConfig,
} from "./forge-artifacts"
import {
  buildForgeDockerRunArgs,
  resolveForgeSandboxConfig,
} from "./forge-sandbox"
import {
  FORGE_GENERATED_CODE_ARTIFACT_KIND,
  buildForgeGeneratedCodeArtifactContent,
  buildForgeGeneratedCodeSummary,
  createForgeFrontendCodeFiles,
  readForgeGeneratedCodeArtifact,
  routePathToFilePath,
  validateForgeGeneratedFileSet,
} from "./forge-frontend-code"
import {
  FORGE_PREVIEW_MEMORY_KEY,
  FORGE_PREVIEW_METHOD,
  FORGE_PREVIEW_VIEWPORTS,
  buildForgePreviewUrl,
  canExposeForgePreviewHost,
  defaultForgePreviewState,
  readForgePreviewMemory,
  resolveForgePreviewHost,
  resolveForgePreviewPortBase,
} from "./forge-preview"
import {
  FORGE_QA_ARTIFACT_KIND,
  FORGE_QA_ARTIFACT_TITLE,
  FORGE_MANDATORY_QA_CHECKS,
  buildContentDepthQaResult,
  buildCopyQualityQaResult,
  buildCtaRelevanceQaResult,
  buildForbiddenGenericContentQaResult,
  buildForgeQaArtifactContent,
  computeForgeReadiness,
  buildDesignAlignmentQaResult,
  buildMobileResponsiveQaResult,
  buildPlaceholderScanQaResult,
  buildReducedMotionQaResult,
  buildResendFormQaResult,
  buildSchemaAppropriatenessQaResult,
  buildWhatsAppLinkQaResult,
  buildDeterministicForgeRepairPatchResponse,
  buildQaReport,
  canAttemptForgeRepair,
  getForgeQaCommands,
  readForgeQaArtifact,
  resolveForgeMaxRepairAttempts,
  truncateForgeQaLog,
  validateForgeRepairPatches,
  type ForgeQaCommandResult,
} from "./forge-qa"
import {
  buildResendIntegrationPlaceholder,
  defaultForgeResendConfig,
  parseForgeResendConfigPayload,
  readForgeResendConfig,
  redactForgeResendConfig,
} from "./forge-resend"
import {
  buildWhatsAppIntegrationPlaceholder,
  buildWhatsAppUrl,
  defaultForgeWhatsAppConfig,
  parseForgeWhatsAppConfigPayload,
  readForgeWhatsAppConfig,
  redactForgeWhatsAppConfig,
} from "./forge-whatsapp"
import {
  FORGE_ANIMATION_PACKS,
  buildForgeAnimationConfigForSite,
  buildForgeAnimationWarning,
  chooseForgeAnimationPack,
  getForgeAnimationPack,
  isForgeAnimationPack,
} from "./forge-animation"
import {
  FORGE_COMMAND_CHAT_MEMORY_KEY,
  appendForgeCommandMessages,
  classifyForgeCommandHeuristic,
  emptyForgeCommandChatState,
  forgeCommandRequiresConfirmation,
  readForgeCommandChatMemory,
} from "./forge-command-chat"
import {
  FORGE_COMPONENT_SPEC_ARTIFACT_KIND,
  FORGE_COMPONENT_SPEC_SCHEMA,
  FORGE_REQUIRED_COMPONENTS,
  buildForgeComponentSpecArtifactContent,
  buildForgeComponentSpecPrompt,
  createMockComponentSpec,
  parseForgeComponentSpecPayload,
  readForgeComponentSpecArtifact,
} from "./forge-component-spec"
import {
  FORGE_COPY_ARTIFACT_KIND,
  FORGE_COPY_DOCUMENT_SCHEMA,
  buildForgeCopyArtifactContent,
  buildForgeCopyPrompt,
  createMockCopyDocument,
  parseForgeCopyDocumentPayload,
  readForgeCopyDocumentArtifact,
  runForgeCopySelfCheck,
} from "./forge-copy"
import {
  FORGE_DESIGN_ARTIFACT_KIND,
  FORGE_DESIGN_DIRECTION_SCHEMA,
  FORGE_DESIGN_STYLE_PACKS,
  buildForgeDesignArtifactContent,
  buildForgeDesignPrompt,
  createMockDesignDirection,
  isForgeDesignStylePack,
  parseForgeDesignDirectionPayload,
  readForgeDesignDirectionArtifact,
} from "./forge-design"
import { createMockDesignSystemSpecification } from "./forge-design-system"
import {
  FORGE_RESEARCH_REPORT_SCHEMA,
  buildForgeResearchArtifactContent,
  buildForgeResearchPrompt,
  createMockResearchReport,
} from "./forge-research"
import {
  FORGE_SITEMAP_ARTIFACT_KIND,
  FORGE_SITEMAP_STRATEGY_SCHEMA,
  buildForgeSitemapArtifactContent,
  buildForgeSitemapPrompt,
  createMockSitemapStrategy,
  parseForgeSitemapStrategyPayload,
  readForgeSitemapStrategyArtifact,
} from "./forge-sitemap"

describe("forge shell", () => {
  it("keeps Forge under the private admin route", () => {
    expect(FORGE_ROUTE).toBe("/forge")
  })

  it("defines the required empty dashboard cards", () => {
    expect(FORGE_DASHBOARD_CARDS.map((card) => card.label)).toEqual([
      "Active Projects",
      "Draft Builds",
      "Awaiting QA",
      "Ready to Deploy",
      "Integrations Health",
      "Recent Activity",
    ])
  })

  it("defines the initial production workflow stages", () => {
    expect(FORGE_WORKFLOW_STAGES).toEqual([
      "Intake",
      "Strategy selection",
      "Brief confirmation",
      "Site plan",
      "Design tokens",
      "Code generation",
      "Copy generation",
      "SEO/schema generation",
      "Internal critique",
      "Design critique",
      "Copy rewrite",
      "Code repair",
      "Final validation",
      "Export/preview",
    ])
  })

  it("can resolve dashboard cards by stable key", () => {
    expect(getForgeDashboardCard("ready-to-deploy")?.label).toBe("Ready to Deploy")
    expect(getForgeDashboardCard("missing")).toBeNull()
  })

  it("defines database enum values for the Forge foundation", () => {
    expect(FORGE_PROJECT_STATUSES).toContain("client_review")
    expect(FORGE_PROJECT_STATUSES).toContain("archived")
    expect(FORGE_TASK_AGENT_TYPES).toContain("repair")
    expect(FORGE_TASK_STATUSES).toEqual(["queued", "running", "completed", "failed", "cancelled"])
    expect(FORGE_ARTIFACT_TYPES).toContain("design_system")
    expect(FORGE_ARTIFACT_TYPES).toContain("originality_report")
    expect(FORGE_ARTIFACT_TYPES).toContain("site_inventory")
    expect(FORGE_ARTIFACT_TYPES).toContain("migration_analysis")
    expect(FORGE_ARTIFACT_TYPES).toContain("migration_candidate")
    expect(FORGE_ARTIFACT_TYPES).toContain("visual_critique")
    expect(FORGE_ARTIFACT_TYPES).toContain("deployment_notes")
    expect(FORGE_INTEGRATION_PROVIDERS).toEqual(["resend", "whatsapp", "analytics", "calendly", "stripe", "cloudinary", "custom"])
  })

  it("validates Forge project writes server-side", () => {
    expect(parseForgeProjectPayload({ businessName: "Acme" }).ok).toBe(false)
    expect(parseForgeProjectPayload({ name: "Acme build" }).ok).toBe(false)
    expect(parseForgeProjectPayload({ name: "Acme build", businessName: "Acme", websiteUrl: "acme.test" }).ok).toBe(false)
    expect(parseForgeProjectPayload({ name: "Acme build", businessName: "Acme", priority: "urgent" }).ok).toBe(false)

    const parsed = parseForgeProjectPayload({
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Manufacturing",
      websiteUrl: "https://acme.example",
      targetAudience: "Operations leaders",
      primaryGoal: "Increase qualified enquiries",
      deadline: "2026-08-01T09:00:00.000Z",
      clientId: "12",
      prospectId: "",
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.status).toBe("intake")
      expect(parsed.data.priority).toBe("medium")
      expect(parsed.data.clientId).toBe(12)
      expect(parsed.data.prospectId).toBeNull()
      expect(parsed.data.deadline).toBeInstanceOf(Date)
    }
  })

  it("validates Forge project patches and allows optional detail clearing", () => {
    expect(parseForgeProjectPayload({ name: "" }, "patch").ok).toBe(false)
    expect(parseForgeProjectPayload({ businessName: "" }, "patch").ok).toBe(false)

    const parsed = parseForgeProjectPayload({
      industry: "",
      websiteUrl: "",
      budgetRange: "",
      deadline: "",
      priority: "high",
    }, "patch")

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data).toMatchObject({
        industry: null,
        websiteUrl: null,
        budgetRange: null,
        deadline: null,
        priority: "high",
      })
    }
  })

  it("validates task, artifact, integration, activity, and memory writes", () => {
    expect(parseForgeTaskPayload({ projectId: 1, title: "Run research", agentType: "research", inputJson: [] }).ok).toBe(false)
    expect(parseForgeTaskPayload({ projectId: 1, title: "Run research", agentType: "research", inputJson: { query: "market" } }).ok).toBe(true)

    expect(parseForgeArtifactPayload({ projectId: 1, type: "copy_doc", title: "Homepage copy", metadataJson: { version: 1 } }).ok).toBe(true)
    expect(parseForgeArtifactPayload({ projectId: 1, type: "bad", title: "Homepage copy" }).ok).toBe(false)

    expect(parseForgeIntegrationConfigPayload({ projectId: 1, provider: "resend", configJson: { from: "hello@example.com" }, enabled: true }).ok).toBe(true)
    expect(parseForgeIntegrationConfigPayload({ projectId: 1, provider: "ftp" }).ok).toBe(false)

    expect(parseForgeActivityLogPayload({ projectId: 1, action: "create", message: "Project created" }).ok).toBe(true)
    expect(parseForgeMemoryPayload({ projectId: 1, key: "tone", value: "Direct, premium, practical" }).ok).toBe(true)
  })

  it("redacts sensitive integration config values before UI exposure", () => {
    expect(redactIntegrationConfig({
      apiKey: "abc",
      access_token: "def",
      fromEmail: "hello@example.com",
      nested: { visible: true },
    })).toEqual({
      apiKey: "[redacted]",
      access_token: "[redacted]",
      fromEmail: "hello@example.com",
      nested: { visible: true },
    })
  })

  it("scores structured intake completeness and reports missing fields", () => {
    const empty = emptyForgeIntakeData()
    const missing = getForgeIntakeMissingFields(empty)

    expect(missing.length).toBeGreaterThan(10)

    const parsed = parseForgeIntakePayload({
      businessOverview: "A Nottingham manufacturer selling specialist parts.",
      businessLocation: "Nottingham",
      coreServices: "Machining, repairs, and installation.",
      flagshipOffer: "Emergency repair service",
      idealCustomers: "Operations managers at industrial sites.",
      customerProblems: "Downtime, unclear suppliers, and urgent failures.",
      primaryLocation: "Nottingham",
      serviceAreas: "Nottingham, Derby, Leicester",
      brandTone: "Confident and practical",
      visualStyle: "Clean industrial premium",
      competitorUrls: "https://example.com",
      differentiators: "Faster response and better diagnostics.",
      primaryWebsiteGoal: "Generate qualified repair enquiries.",
      conversionActions: "Call, quote form, WhatsApp",
      testimonials: "Strong Google reviews and repeat contracts.",
      requiredPages: "Home, Services, Emergency Repairs, About, Contact",
      requiredIntegrations: "Resend, analytics, WhatsApp",
      existingAssets: "Logo, workshop photography, service PDFs",
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.completenessScore).toBe(100)
      expect(parsed.data.missingFields).toEqual([])
      expect(parsed.data.summary).toContain("## Website goals")
      expect(parsed.data.summary).toContain("Generate qualified repair enquiries.")
    }
  })

  it("reads persisted intake artifact metadata safely", () => {
    const parsed = parseForgeIntakePayload({
      businessOverview: "A cafe.",
      businessLocation: "Hucknall",
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      const read = readForgeIntakeArtifact({
        kind: FORGE_INTAKE_ARTIFACT_KIND,
        status: "completed",
        intake: parsed.data.intake,
        completenessScore: parsed.data.completenessScore,
      })

      expect(read.status).toBe("completed")
      expect(read.intake.businessLocation).toBe("Hucknall")
      expect(read.missingFields.length).toBeGreaterThan(0)
    }

    expect(readForgeIntakeArtifact(null).status).toBe("draft")
  })

  it("builds an intake summary with missing information", () => {
    const intake = emptyForgeIntakeData()
    const summary = buildForgeIntakeSummary(intake, 0)

    expect(summary).toContain("# Intake Summary")
    expect(summary).toContain("## Missing information")
    expect(summary).toContain("Business basics: Business overview")
  })

  it("starts a guided Forge build brief from one prompt", () => {
    const { intake, state } = createForgeBuildBriefFromPrompt({
      prompt: "Build a premium Minecraft server website for RTXGaming.",
      project: {
        businessName: "RTXGaming",
        industry: "Gaming",
        targetAudience: null,
        primaryGoal: null,
        websiteUrl: null,
      },
    })

    expect(intake.businessOverview).toContain("Minecraft server")
    expect(intake.requiredPages).toContain("Store")
    expect(intake.conversionActions).toContain("Join server")
    expect(state.messages[0].role).toBe("user")
    expect(state.currentQuestionId).not.toBeNull()
  })

  it("applies guided answers and supports short-answer controls", () => {
    const started = createForgeBuildBriefFromPrompt({
      prompt: "Build a premium Minecraft server website for RTXGaming.",
      project: {
        businessName: "RTXGaming",
        industry: "Gaming",
        targetAudience: null,
        primaryGoal: null,
        websiteUrl: null,
      },
    })
    const answered = applyForgeBuildBriefAnswer({
      state: { ...started.state, currentQuestionId: "target_audience" },
      intake: started.intake,
      answer: "Competitive Minecraft players and streamers who want a polished server community.",
    })
    const short = applyForgeBuildBriefAnswer({
      state: { ...answered.state, currentQuestionId: "brand_style" },
      intake: answered.intake,
      answer: "ask me less",
    })
    const final = finalizeForgeBuildBriefIntake(short.intake)
    const question = fallbackForgeBuildBriefQuestion(final, short.state)

    expect(answered.intake.idealCustomers).toContain("Competitive Minecraft")
    expect(short.state.askLess).toBe(true)
    expect(final.requiredIntegrations).toBeTruthy()
    expect(question.question).toBeTruthy()
  })

  it("resolves Forge AI provider and model routing safely", () => {
    expect(resolveForgeAiProvider({ FORGE_ENABLE_AI: "false", FORGE_DEFAULT_AI_PROVIDER: "openai" })).toBe("mock")
    expect(resolveForgeAiProvider({ FORGE_ENABLE_AI: "true", FORGE_DEFAULT_AI_PROVIDER: "openai" })).toBe("openai")
    expect(resolveForgeAiProvider({ FORGE_ENABLE_AI: "true", FORGE_DEFAULT_AI_PROVIDER: "unknown" })).toBe("mock")
    expect(resolveForgeAiModel("copywriting", "mock")).toBe(FORGE_AI_MODEL_ROUTES.copywriting.mock)
    expect(supportsOpenAiTemperature("gpt-5.5")).toBe(false)
    expect(supportsOpenAiTemperature("o3-mini")).toBe(false)
    expect(supportsOpenAiTemperature("gpt-4.1")).toBe(true)
  })

  it("detects build-time page-data collection where Forge must not open a database pool", () => {
    expect(isBuildPhaseWithoutDatabase({
      NEXT_PHASE: "phase-production-build",
      DATABASE_URL: "postgres://example",
    })).toBe(true)
    expect(isBuildPhaseWithoutDatabase({
      npm_lifecycle_event: "build",
      DATABASE_URL: "postgres://example",
    })).toBe(true)
    expect(isBuildPhaseWithoutDatabase({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://example",
    })).toBe(false)
    expect(isBuildPhaseWithoutDatabase({
      NODE_ENV: "production",
    })).toBe(true)
  })

  it("validates structured AI response JSON against a schema", () => {
    const valid = {
      summary: "Provider layer is ready.",
      nextSteps: ["Keep it server-side"],
      riskLevel: "low",
    }
    const invalid = {
      summary: "Provider layer is ready.",
      nextSteps: "Keep it server-side",
      riskLevel: "urgent",
    }

    expect(validateJsonSchemaValue(FORGE_AI_TEST_SCHEMA, valid)).toEqual([])
    expect(validateJsonSchemaValue(FORGE_AI_TEST_SCHEMA, invalid).length).toBeGreaterThan(0)
    expect(parseAndValidateStructuredJson(FORGE_AI_TEST_SCHEMA, JSON.stringify(valid)).ok).toBe(true)
    expect(parseAndValidateStructuredJson(FORGE_AI_TEST_SCHEMA, "{nope").ok).toBe(false)
  })

  it("creates mock AI responses and task output metadata", () => {
    const data = createMockStructuredResponse(FORGE_AI_TEST_SCHEMA, "planning")
    const parsed = parseAndValidateStructuredJson(FORGE_AI_TEST_SCHEMA, data)

    expect(parsed.ok).toBe(true)

    if (parsed.ok) {
      const metadata = buildForgeTaskOutputMetadata({
        provider: "mock",
        model: "mock-planning",
        taskType: "planning",
        data: parsed.data,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costEstimateUsd: null,
        latencyMs: 5,
        retries: 0,
        responseId: "mock",
      })

      expect(metadata.ai.provider).toBe("mock")
      expect(metadata.ai.costEstimateUsd).toBeNull()
      expect(metadata.response).toMatchObject({ riskLevel: "low" })
    }
  })

  it("defines a structured research report schema for the research agent", () => {
    const intake = emptyForgeIntakeData()
    intake.businessLocation = "Nottingham"
    intake.primaryLocation = "Nottingham"
    intake.coreServices = "Industrial repairs and maintenance"
    intake.idealCustomers = "Operations managers"
    intake.competitorUrls = "https://competitor.example"
    intake.differentiators = "Fast response and practical diagnostics"

    const report = createMockResearchReport({
      id: 1,
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Manufacturing",
      websiteUrl: "https://acme.example",
      brandNotes: "Direct and premium",
      targetAudience: "Operations leaders",
      primaryGoal: "Increase repair enquiries",
      budgetRange: "5k-10k",
    }, intake)

    expect(validateJsonSchemaValue(FORGE_RESEARCH_REPORT_SCHEMA, report)).toEqual([])
    expect(report.recommendedPages.map((page) => page.title)).toContain("Home")
  })

  it("builds research prompts without implying live website scraping", () => {
    const intake = emptyForgeIntakeData()
    intake.competitorUrls = "https://one.example\nhttps://two.example"

    const prompt = buildForgeResearchPrompt({
      project: {
        name: "Acme rebuild",
        businessName: "Acme Ltd",
        industry: "Manufacturing",
        websiteUrl: "https://acme.example",
        brandNotes: null,
        targetAudience: null,
        primaryGoal: null,
        budgetRange: null,
      },
      intake,
      memories: [{ key: "tone", value: "Clear and practical", source: "manual" }],
    })

    expect(prompt).toContain("Do not claim to have scraped")
    expect(prompt).toContain("https://one.example")
    expect(prompt).toContain("tone: Clear and practical")
  })

  it("formats research reports as usable Forge artifacts", () => {
    const report = createMockResearchReport({
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      websiteUrl: null,
      brandNotes: null,
      targetAudience: null,
      primaryGoal: null,
      budgetRange: null,
    }, emptyForgeIntakeData())

    const content = buildForgeResearchArtifactContent(report)

    expect(content).toContain("# Research Report")
    expect(content).toContain("## Local SEO opportunities")
    expect(content).toContain("## AEO/GEO opportunities")
  })

  it("defines a structured sitemap strategy schema for local service businesses", () => {
    const intake = emptyForgeIntakeData()
    intake.businessLocation = "Nottingham"
    intake.primaryLocation = "Nottingham"
    intake.coreServices = "Emergency repairs\nMaintenance plans"
    intake.conversionActions = "Request a quote"
    intake.testimonials = "Google reviews\nCase studies"

    const researchReport = createMockResearchReport({
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Industrial repairs",
      websiteUrl: "https://acme.example",
      brandNotes: null,
      targetAudience: "Operations leaders",
      primaryGoal: "Increase repair enquiries",
      budgetRange: null,
    }, intake)
    const strategy = createMockSitemapStrategy({
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Industrial repairs",
      websiteUrl: "https://acme.example",
      targetAudience: "Operations leaders",
      primaryGoal: "Increase repair enquiries",
    }, intake, researchReport)

    expect(validateJsonSchemaValue(FORGE_SITEMAP_STRATEGY_SCHEMA, strategy)).toEqual([])
    expect(strategy.selectedStrategyPack).toBe("trades_business")
    expect(strategy.sitemap.map((page) => page.title)).toContain("Emergency repairs")
    expect(strategy.sitemap.some((page) => page.schemaRecommendation.includes("LocalBusiness"))).toBe(true)
  })

  it("selects a gaming/community strategy pack for Minecraft server sites", () => {
    const intake = emptyForgeIntakeData()
    intake.businessOverview = "Premium Minecraft server website for RTXGaming."
    intake.coreServices = "Minecraft server\nGame modes\nDiscord community"
    intake.conversionActions = "Copy server IP\nJoin Discord\nVisit store"
    intake.requiredPages = "Home\nPlay\nGame modes\nStore\nVote\nRules\nSupport"

    const project = {
      name: "RTXGaming build",
      businessName: "RTXGaming",
      industry: "Gaming",
      websiteUrl: null,
      targetAudience: "Minecraft players",
      primaryGoal: "Grow server joins",
    }
    const selection = selectForgeStrategyPack(project, intake)
    const strategy = createMockSitemapStrategy(project, intake, null)

    expect(selection.pack.id).toBe("gaming_community_server")
    expect(strategy.selectedStrategyPack).toBe("gaming_community_server")
    expect(strategy.strategyPackRationale).toMatch(/minecraft/i)
    expect(strategy.sitemap.map((page) => page.title)).toEqual(expect.arrayContaining(["Play / Join", "Game Modes", "Store", "Vote", "Rules & Support"]))
    expect(strategy.sitemap[0].primaryCta).toMatch(/server ip/i)
    expect(strategy.sitemap.some((page) => /^LocalBusiness|Service schema with LocalBusiness/i.test(page.schemaRecommendation))).toBe(false)
    expect(strategy.conversionNotes.join(" ")).toContain("Discord")
  })

  it("builds sitemap prompts around selected strategy packs", () => {
    const intake = emptyForgeIntakeData()
    intake.businessLocation = "Nottingham"
    intake.coreServices = "Emergency repairs"
    const prompt = buildForgeSitemapPrompt({
      project: {
        name: "Acme rebuild",
        businessName: "Acme Ltd",
        industry: "Industrial repairs",
        websiteUrl: "https://acme.example",
        targetAudience: "Operations leaders",
        primaryGoal: "Increase enquiries",
      },
      intake,
      intakeSummary: "# Intake Summary\nService business in Nottingham.",
      researchReport: null,
    })

    expect(prompt).toContain("Selected strategy pack")
    expect(prompt).toContain("Trades business")
    expect(prompt).toContain("Forbidden generic sections")
    expect(prompt).toContain("Service business in Nottingham.")
  })

  it("parses and reads sitemap strategy artifact metadata", () => {
    const strategy = createMockSitemapStrategy({
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      websiteUrl: null,
      targetAudience: null,
      primaryGoal: null,
    }, emptyForgeIntakeData(), null)

    expect(parseForgeSitemapStrategyPayload(strategy).ok).toBe(true)
    expect(parseForgeSitemapStrategyPayload({ strategySummary: "Missing fields" }).ok).toBe(false)

    const read = readForgeSitemapStrategyArtifact({
      kind: FORGE_SITEMAP_ARTIFACT_KIND,
      status: "approved",
      strategy,
      approvedStrategy: strategy,
      approvedAt: "2026-06-20T12:00:00.000Z",
      approvedBy: "admin@example.com",
    })

    expect(read.status).toBe("approved")
    expect(read.approvedStrategy?.sitemap[0].title).toBe("Home")
  })

  it("formats sitemap strategy artifacts for review", () => {
    const strategy = createMockSitemapStrategy({
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      websiteUrl: null,
      targetAudience: null,
      primaryGoal: null,
    }, emptyForgeIntakeData(), null)
    const content = buildForgeSitemapArtifactContent(strategy)

    expect(content).toContain("# Sitemap & Strategy")
    expect(content).toContain("## Recommended sitemap")
    expect(content).toContain("## Internal linking plan")
  })

  it("defines a structured copy document schema and mock output", () => {
    const intake = emptyForgeIntakeData()
    intake.businessLocation = "Nottingham"
    intake.primaryLocation = "Nottingham"
    intake.coreServices = "Emergency repairs\nMaintenance plans"
    intake.conversionActions = "Request a quote"
    intake.testimonials = "Google reviews\nCase studies"
    intake.idealCustomers = "Operations leaders"

    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Industrial repairs",
      brandNotes: "Plain-spoken and confident",
      targetAudience: "Operations leaders",
      primaryGoal: "Increase repair enquiries",
    }
    const researchReport = createMockResearchReport({
      ...project,
      websiteUrl: "https://acme.example",
      budgetRange: null,
    }, intake)
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: "https://acme.example",
    }, intake, researchReport)
    const copy = createMockCopyDocument(project, sitemap, intake, researchReport)

    expect(validateJsonSchemaValue(FORGE_COPY_DOCUMENT_SCHEMA, copy)).toEqual([])
    expect(copy.pages[0].seoTitle).toContain("Acme Ltd")
    expect(copy.selfCheck.status).toBe("pass")
  })

  it("flags banned generic copy phrases during self-check", () => {
    const copy = createMockCopyDocument({
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
      primaryGoal: null,
    }, createMockSitemapStrategy({
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      websiteUrl: null,
      targetAudience: null,
      primaryGoal: null,
    }, emptyForgeIntakeData(), null), emptyForgeIntakeData(), null)

    copy.pages[0].heroSubheading = "Unlock your potential with tailored solutions."
    const check = runForgeCopySelfCheck(copy)

    expect(check.status).toBe("review")
    expect(check.flaggedPhrases).toContain("unlock your potential")
    expect(check.flaggedPhrases).toContain("tailored solutions")
  })

  it("builds copy prompts from approved sitemap, research, intake, and brand context", () => {
    const intake = emptyForgeIntakeData()
    intake.coreServices = "Emergency repairs"
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Industrial repairs",
      brandNotes: "Direct and practical",
      targetAudience: "Operations leaders",
      primaryGoal: "Increase repair enquiries",
    }
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: "https://acme.example",
    }, intake, null)
    const prompt = buildForgeCopyPrompt({
      project,
      approvedSitemap: sitemap,
      researchReport: null,
      intakeSummary: "# Intake Summary\nIndustrial repair project.",
      regeneratePagePath: "/",
      existingCopy: null,
    })

    expect(prompt).toContain("approved sitemap")
    expect(prompt).toContain("unlock your potential")
    expect(prompt).toContain("Regenerate the page at /")
    expect(prompt).toContain("Direct and practical")
  })

  it("parses and reads copy document artifact metadata", () => {
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
      primaryGoal: null,
    }
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: null,
    }, emptyForgeIntakeData(), null)
    const copy = createMockCopyDocument(project, sitemap, emptyForgeIntakeData(), null)

    expect(parseForgeCopyDocumentPayload(copy).ok).toBe(true)
    expect(parseForgeCopyDocumentPayload({ copySummary: "Missing pages" }).ok).toBe(false)

    const read = readForgeCopyDocumentArtifact({
      kind: FORGE_COPY_ARTIFACT_KIND,
      status: "approved",
      copy,
      approvedCopy: copy,
      approvedAt: "2026-06-20T12:00:00.000Z",
      approvedBy: "admin@example.com",
    })

    expect(read.status).toBe("approved")
    expect(read.approvedCopy?.pages[0].path).toBe("/")
  })

  it("formats copy documents for review", () => {
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
      primaryGoal: null,
    }
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: null,
    }, emptyForgeIntakeData(), null)
    const copy = createMockCopyDocument(project, sitemap, emptyForgeIntakeData(), null)
    const content = buildForgeCopyArtifactContent(copy)

    expect(content).toContain("# Copy Document")
    expect(content).toContain("## Self-check")
    expect(content).toContain("#### Local SEO copy")
  })

  it("defines internal design style packs and validates design direction output", () => {
    expect(FORGE_DESIGN_STYLE_PACKS).toEqual([
      "Neon command hub",
      "Luxury dark premium",
      "Clean local professional",
      "Bold trade/industrial",
      "Soft wellness/beauty",
      "Charity trust/friendly",
      "SaaS glass dashboard",
      "Ecommerce conversion",
      "Editorial/content-led",
    ])
    expect(isForgeDesignStylePack("Bold trade/industrial")).toBe(true)
    expect(isForgeDesignStylePack("Generic AI")).toBe(false)
    expect(FORGE_ANIMATION_PACKS).toEqual([
      "Minimal Premium",
      "Cinematic Hero",
      "Smooth Local Business",
      "Editorial Reveal",
      "Glass Motion",
      "Industrial Precision",
    ])
    expect(isForgeAnimationPack("Industrial Precision")).toBe(true)
    expect(isForgeAnimationPack("Chaotic Scrolljack")).toBe(false)

    const intake = emptyForgeIntakeData()
    intake.businessLocation = "Nottingham"
    intake.coreServices = "Industrial repairs"
    intake.visualStyle = "Strong industrial premium"
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Industrial repairs",
      brandNotes: "Direct and robust",
      targetAudience: "Operations leaders",
    }
    const researchReport = createMockResearchReport({
      ...project,
      websiteUrl: null,
      primaryGoal: "Increase repair enquiries",
      budgetRange: null,
    }, intake)
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: null,
      primaryGoal: "Increase repair enquiries",
    }, intake, researchReport)
    const copy = createMockCopyDocument({
      ...project,
      primaryGoal: "Increase repair enquiries",
    }, sitemap, intake, researchReport)
    const direction = createMockDesignDirection({
      project,
      intake,
      approvedSitemap: sitemap,
      approvedCopy: copy,
    })

    expect(validateJsonSchemaValue(FORGE_DESIGN_DIRECTION_SCHEMA, direction)).toEqual([])
    expect(direction.selectedStylePack).toBe("Bold trade/industrial")
    expect(direction.selectedAnimationPack).toBe("Industrial Precision")
    expect(direction.overAnimationWarning).toMatch(/over-animate|over-animated|restrained/i)
    expect(getForgeAnimationPack(direction.selectedAnimationPack).reducedMotionFallback).toContain("Disable")
    expect(buildForgeAnimationConfigForSite(direction.selectedAnimationPack).threePlaceholder).toContain("not included")
    expect(buildForgeAnimationWarning("Cinematic Hero", "Clean local professional")).toContain("heavier animation pack")
    expect(chooseForgeAnimationPack({ industry: "Industrial repairs" })).toBe("Industrial Precision")
  })

  it("builds design prompts that force practical decisions", () => {
    const intake = emptyForgeIntakeData()
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Industrial repairs",
      brandNotes: "Strong and practical",
      targetAudience: "Operations leaders",
    }
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: null,
      primaryGoal: "Increase enquiries",
    }, intake, null)
    const copy = createMockCopyDocument({
      ...project,
      primaryGoal: "Increase enquiries",
    }, sitemap, intake, null)
    const prompt = buildForgeDesignPrompt({
      project,
      intake,
      intakeSummary: "# Intake Summary",
      researchReport: null,
      approvedSitemap: sitemap,
      approvedCopy: copy,
      preferredStylePack: "Luxury dark premium",
      preferredAnimationPack: "Cinematic Hero",
    })

    expect(prompt).toContain("Do not create generic AI website direction")
    expect(prompt).toContain("Admin preferred style pack: Luxury dark premium")
    expect(prompt).toContain("Admin preferred animation pack: Cinematic Hero")
    expect(prompt).toContain("Internal animation packs")
    expect(prompt).toContain("warning against over-animated designs")
  })

  it("parses and reads design direction artifact metadata", () => {
    const intake = emptyForgeIntakeData()
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
    }
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: null,
      primaryGoal: null,
    }, intake, null)
    const copy = createMockCopyDocument({
      ...project,
      primaryGoal: null,
    }, sitemap, intake, null)
    const direction = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })

    expect(parseForgeDesignDirectionPayload(direction).ok).toBe(true)
    expect(parseForgeDesignDirectionPayload({ designStyleName: "Missing fields" }).ok).toBe(false)

    const read = readForgeDesignDirectionArtifact({
      kind: FORGE_DESIGN_ARTIFACT_KIND,
      status: "approved",
      direction,
      approvedDirection: direction,
      approvedAt: "2026-06-20T12:00:00.000Z",
      approvedBy: "admin@example.com",
    })

    expect(read.status).toBe("approved")
    expect(read.approvedDirection?.selectedStylePack).toBe(direction.selectedStylePack)
    expect(read.approvedDirection?.selectedAnimationPack).toBe(direction.selectedAnimationPack)
  })

  it("formats design directions for review", () => {
    const intake = emptyForgeIntakeData()
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
    }
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: null,
      primaryGoal: null,
    }, intake, null)
    const copy = createMockCopyDocument({
      ...project,
      primaryGoal: null,
    }, sitemap, intake, null)
    const content = buildForgeDesignArtifactContent(createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy }))

    expect(content).toContain("# Design Direction")
    expect(content).toContain("## Visual direction")
    expect(content).toContain("## Locked design tokens")
    expect(content).toContain("## Forbidden design mismatches")
    expect(content).toContain("## Animation pack behaviour")
    expect(content).toContain("## Premium interaction ideas")
    expect(content).toContain("## Over-animation warning")
  })

  it("defines a component specification schema with required reusable components", () => {
    const intake = emptyForgeIntakeData()
    intake.coreServices = "Emergency repairs\nMaintenance plans"
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Industrial repairs",
      brandNotes: "Direct and robust",
      targetAudience: "Operations leaders",
    }
    const sitemap = createMockSitemapStrategy({
      ...project,
      websiteUrl: null,
      primaryGoal: "Increase repair enquiries",
    }, intake, null)
    const copy = createMockCopyDocument({
      ...project,
      primaryGoal: "Increase repair enquiries",
    }, sitemap, intake, null)
    const design = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })
    const spec = createMockComponentSpec(sitemap, copy, design)

    expect(validateJsonSchemaValue(FORGE_COMPONENT_SPEC_SCHEMA, spec)).toEqual([])
    expect(FORGE_REQUIRED_COMPONENTS.every((name) => spec.components.some((component) => component.name === name))).toBe(true)
    expect(parseForgeComponentSpecPayload(spec).ok).toBe(true)
  })

  it("rejects component specs missing required reusable components", () => {
    const intake = emptyForgeIntakeData()
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
    }
    const sitemap = createMockSitemapStrategy({ ...project, websiteUrl: null, primaryGoal: null }, intake, null)
    const copy = createMockCopyDocument({ ...project, primaryGoal: null }, sitemap, intake, null)
    const design = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })
    const spec = createMockComponentSpec(sitemap, copy, design)
    spec.components = spec.components.filter((component) => component.name !== "LeadForm")

    const parsed = parseForgeComponentSpecPayload(spec)

    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toContain("LeadForm")
  })

  it("builds component spec prompts as exact code-generator blueprints", () => {
    const intake = emptyForgeIntakeData()
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
    }
    const sitemap = createMockSitemapStrategy({ ...project, websiteUrl: null, primaryGoal: null }, intake, null)
    const copy = createMockCopyDocument({ ...project, primaryGoal: null }, sitemap, intake, null)
    const design = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })
    const prompt = buildForgeComponentSpecPrompt({ approvedSitemap: sitemap, approvedCopy: copy, approvedDesign: design })

    expect(prompt).toContain("exact implementation blueprint")
    expect(prompt).toContain("Hero, TrustBar, ServicesGrid")
    expect(prompt).toContain("Approved design direction")
  })

  it("reads approved component spec artifact metadata", () => {
    const intake = emptyForgeIntakeData()
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
    }
    const sitemap = createMockSitemapStrategy({ ...project, websiteUrl: null, primaryGoal: null }, intake, null)
    const copy = createMockCopyDocument({ ...project, primaryGoal: null }, sitemap, intake, null)
    const design = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })
    const spec = createMockComponentSpec(sitemap, copy, design)
    const read = readForgeComponentSpecArtifact({
      kind: FORGE_COMPONENT_SPEC_ARTIFACT_KIND,
      status: "approved",
      spec,
      approvedSpec: spec,
      approvedAt: "2026-06-21T12:00:00.000Z",
      approvedBy: "admin@example.com",
    })

    expect(read.status).toBe("approved")
    expect(read.approvedSpec?.components.map((component) => component.name)).toContain("LeadForm")
  })

  it("formats component specs for review", () => {
    const intake = emptyForgeIntakeData()
    const project = {
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: null,
      brandNotes: null,
      targetAudience: null,
    }
    const sitemap = createMockSitemapStrategy({ ...project, websiteUrl: null, primaryGoal: null }, intake, null)
    const copy = createMockCopyDocument({ ...project, primaryGoal: null }, sitemap, intake, null)
    const design = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })
    const content = buildForgeComponentSpecArtifactContent(createMockComponentSpec(sitemap, copy, design))

    expect(content).toContain("# Component Specification")
    expect(content).toContain("## Components")
    expect(content).toContain("### LeadForm")
  })

  it("builds generated-site workspace slugs inside the ignored workspace root", () => {
    const project = { id: 42, name: "Acme Website Build", businessName: "Acme Ltd" }

    expect(buildForgeWorkspaceSlug(project)).toBe("42-acme-ltd")
    expect(buildForgeWorkspaceRelativePath(project)).toBe(`${FORGE_GENERATED_SITES_DIR}/42-acme-ltd`)
    expect(FORGE_WORKSPACE_MEMORY_KEY).toBe("generated_site_workspace")
  })

  it("prevents workspace path traversal and core app targets", () => {
    expect(normalizeForgeWorkspacePath("src/app/page.tsx")).toEqual({ ok: true, path: "src/app/page.tsx" })
    expect(normalizeForgeWorkspacePath("../admin/src/app/page.tsx").ok).toBe(false)
    expect(normalizeForgeWorkspacePath("/tmp/site.tsx").ok).toBe(false)
    expect(normalizeForgeWorkspacePath("C:\\tmp\\site.tsx").ok).toBe(false)
    expect(normalizeForgeWorkspacePath("admin/src/app/page.tsx").ok).toBe(false)
    expect(normalizeForgeWorkspacePath("web/src/app/page.tsx").ok).toBe(false)
  })

  it("restricts executable workspace writes unless explicitly approved", () => {
    const packageJson = JSON.stringify({ scripts: { dev: "next dev" } })

    expect(assertForgeWorkspaceFileAllowed("src/app/page.tsx", "export default function Page() {}").ok).toBe(true)
    expect(assertForgeWorkspaceFileAllowed("scripts/deploy.sh", "echo deploy").ok).toBe(false)
    expect(assertForgeWorkspaceFileAllowed("package.json", packageJson).ok).toBe(false)
    expect(assertForgeWorkspaceFileAllowed("package.json", packageJson, { allowExecutableScripts: true }).ok).toBe(true)
  })

  it("enforces generated-workspace file allowlists and secret filename denylists", () => {
    expect(assertForgeWorkspacePathAllowlisted("src/app/page.tsx").ok).toBe(true)
    expect(assertForgeWorkspacePathAllowlisted("docs/handover.md").ok).toBe(true)
    expect(assertForgeWorkspacePathAllowlisted("tmp/output.txt").ok).toBe(false)
    expect(assertForgeWorkspaceFilenameSafe(".env").ok).toBe(false)
    expect(assertForgeWorkspaceFilenameSafe(".env.local").ok).toBe(false)
    expect(assertForgeWorkspaceFilenameSafe(".npmrc").ok).toBe(false)
    expect(assertForgeWorkspaceFilenameSafe("src/private/id_rsa").ok).toBe(false)
    expect(assertForgeWorkspaceFilenameSafe("src/private/deploy.pem").ok).toBe(false)
    expect(assertForgeWorkspaceFileAllowed("src/app/page.tsx", "export default function Page() { return null }").ok).toBe(true)
    expect(assertForgeWorkspaceFileAllowed("src/app/.env", "SECRET=value").ok).toBe(false)
  })

  it("blocks unsafe generated file content before it reaches the workspace", () => {
    expect(assertForgeWorkspaceContentSafe("src/app/api/contact/route.ts", "const key = process.env.RESEND_API_KEY").ok).toBe(true)
    expect(assertForgeWorkspaceContentSafe("src/app/page.tsx", "const key = process.env.OPENAI_API_KEY").ok).toBe(false)
    expect(assertForgeWorkspaceContentSafe("src/app/page.tsx", "fetch('https://tracking.example.com/pixel')").ok).toBe(false)
    expect(assertForgeWorkspaceContentSafe("src/app/page.tsx", "const url = 'https://wa.me/447700900123'").ok).toBe(true)
    expect(assertForgeWorkspaceContentSafe("src/scripts/cleanup.ts", "rm -rf generated-sites").ok).toBe(false)
  })

  it("rate limits mutating Forge task endpoints by actor and route", () => {
    const store: ForgeRateLimitStore = new Map()
    const key = buildForgeRateLimitKey({
      actor: "admin@example.com",
      method: "POST",
      pathname: "/api/forge/projects/42/research",
      bucket: "task",
    })

    expect(isForgeMutatingMethod("POST")).toBe(true)
    expect(isForgeMutatingMethod("GET")).toBe(false)
    expect(isForgeTaskEndpoint("/api/forge/projects/42/research")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects")).toBe(false)
    expect(resolveForgeRateLimitConfig({ FORGE_RATE_LIMIT_WINDOW_MS: "5000", FORGE_MUTATION_RATE_LIMIT: "9", FORGE_TASK_RATE_LIMIT: "2" })).toEqual({
      windowMs: 5000,
      mutationLimit: 9,
      taskLimit: 2,
    })
    expect(checkForgeRateLimit(store, key, 2, 1000, 0).ok).toBe(true)
    expect(checkForgeRateLimit(store, key, 2, 1000, 100).ok).toBe(true)
    const limited = checkForgeRateLimit(store, key, 2, 1000, 200)
    expect(limited.ok).toBe(false)
    expect(limited.ok ? 0 : limited.retryAfterMs).toBe(800)
    expect(checkForgeRateLimit(store, key, 2, 1000, 1001).ok).toBe(true)
  })

  it("redacts Forge secret values before they can be logged or exported", () => {
    const redacted = redactForgeSecrets("OPENAI_API_KEY=sk_live_secret RESEND_API_KEY=re_secret_token -----BEGIN PRIVATE KEY-----abc-----END PRIVATE KEY-----")

    expect(redacted).toContain("OPENAI_API_KEY=[redacted]")
    expect(redacted).toContain("RESEND_API_KEY=[redacted]")
    expect(redacted).not.toContain("sk_live_secret")
    expect(redacted).not.toContain("re_secret_token")
    expect(redacted).toContain("[redacted-private-key]")
    expect(truncateForgeQaLog("build failed with ANTHROPIC_API_KEY=sk_test_secret")).not.toContain("sk_test_secret")
  })

  it("does not pass admin secrets into generated workspace child processes", () => {
    const env = buildForgeGeneratedProcessEnv({
      PATH: "/usr/bin",
      DATABASE_URL: "postgres://secret",
      AUTH_SECRET: "auth-secret",
      OPENAI_API_KEY: "sk-secret",
      ANTHROPIC_API_KEY: "anthropic-secret",
      RESEND_API_KEY: "re-secret",
      WHATSAPP_ACCESS_TOKEN: "wa-secret",
    })

    expect(env.PATH).toBe("/usr/bin")
    expect(env.NEXT_TELEMETRY_DISABLED).toBe("1")
    expect(env.BROWSER).toBe("none")
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.AUTH_SECRET).toBeUndefined()
    expect(env.OPENAI_API_KEY).toBeUndefined()
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
    expect(env.RESEND_API_KEY).toBeUndefined()
    expect(env.WHATSAPP_ACCESS_TOKEN).toBeUndefined()
  })

  it("reads workspace metadata safely and limits destructive deletion eligibility", () => {
    const metadata = {
      projectId: 42,
      slug: "42-acme-ltd",
      relativePath: "generated-sites/42-acme-ltd",
      template: FORGE_WORKSPACE_TEMPLATE,
      fileCount: 12,
      createdAt: "2026-06-21T08:00:00.000Z",
      updatedAt: "2026-06-21T08:00:00.000Z",
    }

    expect(readForgeWorkspaceMemory(JSON.stringify(metadata))).toEqual(metadata)
    expect(readForgeWorkspaceMemory(JSON.stringify({ ...metadata, relativePath: "admin/src" }))).toBeNull()
    expect(canDeleteForgeWorkspace({ id: 1, name: "Client build", businessName: "Acme", status: "active" })).toBe(false)
    expect(canDeleteForgeWorkspace({ id: 1, name: "Client build", businessName: "Acme", status: "archived" })).toBe(true)
    expect(canDeleteForgeWorkspace({ id: 1, name: "Demo build", businessName: "Acme", status: "active" })).toBe(true)
  })

  it("maps generated site routes to workspace-safe page files", () => {
    expect(routePathToFilePath("/")).toBe("src/app/page.tsx")
    expect(routePathToFilePath("/emergency-repairs")).toBe("src/app/emergency-repairs/page.tsx")
    expect(routePathToFilePath("service area")).toBe("src/app/service-area/page.tsx")
  })

  it("generates a complete static frontend file set inside workspace rules", () => {
    const intake = emptyForgeIntakeData()
    intake.businessLocation = "Nottingham"
    intake.primaryLocation = "Nottingham"
    intake.coreServices = "Emergency repairs\nMaintenance plans"
    intake.conversionActions = "Request a quote"
    intake.testimonials = "Google reviews\nCase studies"
    intake.visualStyle = "Strong industrial premium"

    const project = {
      id: 42,
      name: "Acme rebuild",
      businessName: "Acme Ltd",
      industry: "Industrial repairs",
      websiteUrl: "https://acme.example",
      brandNotes: "Direct and robust",
      targetAudience: "Operations leaders",
      primaryGoal: "Increase repair enquiries",
    }
    const sitemap = createMockSitemapStrategy(project, intake, null)
    const copy = createMockCopyDocument(project, sitemap, intake, null)
    const design = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })
    const designSystem = createMockDesignSystemSpecification({ project, intake, researchReport: null, approvedSitemap: sitemap, approvedCopy: copy, approvedDesign: design })
    const spec = createMockComponentSpec(sitemap, copy, design)
    const workspace = {
      projectId: 42,
      slug: "42-acme-ltd",
      relativePath: "generated-sites/42-acme-ltd",
      template: FORGE_WORKSPACE_TEMPLATE,
      fileCount: 0,
      createdAt: "2026-06-21T08:00:00.000Z",
      updatedAt: "2026-06-21T08:00:00.000Z",
    } as const
    const files = createForgeFrontendCodeFiles({
      project,
      workspace,
      approvedSitemap: sitemap,
      approvedCopy: copy,
      approvedDesign: design,
      approvedDesignSystem: designSystem,
      approvedComponentSpec: spec,
      integrationPlaceholders: ["Resend API route placeholder", "WhatsApp CTA placeholder"],
      resendConfig: {
        fromEmail: "Website <hello@example.com>",
        toEmail: "leads@example.com",
        replyToBehaviour: "submitter",
        subjectPrefix: "Acme enquiry",
        testMode: true,
        enabled: true,
      },
      whatsappConfig: {
        businessNumber: "+447700900123",
        defaultMessage: "Hi, I need help with an industrial repair.",
        ctaLabel: "Message Acme",
        placements: ["sticky", "inline", "service_pages", "contact_page"],
        enabled: true,
      },
    })
    const packageJson = files.find((file) => file.path === "package.json")?.content ?? ""
    const siteData = files.find((file) => file.path === "src/lib/site-data.ts")?.content ?? ""

    expect(validateForgeGeneratedFileSet(files)).toEqual({ ok: true })
    expect(files.map((file) => file.path)).toContain("src/app/page.tsx")
    expect(files.map((file) => file.path)).toContain("src/app/contact/page.tsx")
    expect(files.map((file) => file.path)).toContain("src/app/sitemap.ts")
    expect(files.map((file) => file.path)).toContain("src/app/robots.ts")
    expect(files.map((file) => file.path)).toContain("src/lib/seo.ts")
    expect(files.map((file) => file.path)).toContain("src/lib/design-tokens.ts")
    expect(files.map((file) => file.path)).toContain("src/app/style-guide/page.tsx")
    const seoLib = files.find((file) => file.path === "src/lib/seo.ts")?.content ?? ""
    expect(seoLib).toContain("BreadcrumbList")
    expect(seoLib).toContain("FAQPage")
    expect(seoLib).toContain("getPageSeo")
    expect(files.map((file) => file.path)).toContain("src/lib/animation-config.ts")
    expect(files.map((file) => file.path)).toContain("src/lib/resend-config.ts")
    expect(files.map((file) => file.path)).toContain("src/lib/whatsapp-config.ts")
    expect(files.map((file) => file.path)).toContain("src/lib/contact-validation.ts")
    expect(files.map((file) => file.path)).toContain("src/lib/email-template.ts")
    expect(files.map((file) => file.path)).toContain("src/components/AnimationProvider.tsx")
    expect(files.map((file) => file.path)).toContain("src/components/PageRenderer.tsx")
    expect(files.map((file) => file.path)).toContain("src/components/StickyWhatsAppButton.tsx")
    expect(packageJson).toContain("framer-motion")
    expect(packageJson).toContain("resend")
    expect(files.find((file) => file.path === "src/lib/animation-config.ts")?.content).toContain("Industrial Precision")
    expect(files.find((file) => file.path === "src/app/globals.css")?.content).toContain("prefers-reduced-motion")
    expect(files.find((file) => file.path === "src/app/globals.css")?.content).toContain("motion-safe-card")
    expect(files.find((file) => file.path === "src/app/globals.css")?.content).toContain("--space-4:")
    expect(files.find((file) => file.path === "src/lib/design-tokens.ts")?.content).toContain("DesignTokenId")
    expect(files.find((file) => file.path === "src/app/style-guide/page.tsx")?.content).toContain("Generated design-token implementation")
    expect(files.find((file) => file.path === "src/components/MotionSection.tsx")?.content).toContain("useReducedMotion")
    expect(files.find((file) => file.path === "src/components/MotionSection.tsx")?.content).toContain("animationConfig.revealOffset")
    expect(files.find((file) => file.path === "src/components/MotionSection.tsx")?.content).not.toContain("animationConfig.name ===")
    expect(files.find((file) => file.path === "src/app/api/contact/route.ts")?.content).toContain("new Resend")
    expect(files.find((file) => file.path === "src/lib/resend-config.ts")?.content).not.toContain("RESEND_API_KEY=")
    expect(files.find((file) => file.path === "src/lib/whatsapp-config.ts")?.content).toContain("447700900123")
    expect(files.find((file) => file.path === "src/lib/whatsapp-config.ts")?.content).not.toContain("WHATSAPP_ACCESS_TOKEN=")
    expect(files.find((file) => file.path === "src/components/WhatsAppCTA.tsx")?.content).toContain("wa.me")
    expect(siteData).toContain("trustElements: readonly string[]")
    expect(siteData).toContain("sections: readonly { readonly heading: string; readonly body: string }[]")
    // Generated site-data.ts must be syntactically valid TypeScript: the canonical generator is the
    // deterministic repair's source of truth for restoring a corrupted/stale workspace copy (e.g. an
    // unterminated string literal), so it can never itself emit broken source.
    const siteDataSyntaxErrors = ts
      .transpileModule(siteData, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ESNext } })
      .diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? []
    expect(siteDataSyntaxErrors).toEqual([])
    expect(packageJson).not.toContain("\"three\"")
    expect(files.some((file) => file.path.startsWith("admin/") || file.path.startsWith("web/"))).toBe(false)
  })

  it("locks neon gaming design tokens into generated CSS and passes design alignment QA", () => {
    const intake = emptyForgeIntakeData()
    intake.coreServices = "Survival server\nRanks store\nDiscord community\nPlayer support"
    intake.conversionActions = "Copy server IP\nJoin Discord\nLogin/Register\nVisit store"
    intake.requiredIntegrations = "Discord, store, live server status placeholders"
    intake.visualStyle = "Neon gaming command hub"
    intake.brandTone = "Energetic, premium, community-first"

    const project = {
      id: 77,
      name: "RTXGaming",
      businessName: "RTXGaming",
      industry: "Minecraft server",
      websiteUrl: "https://rtxgaming.example",
      brandNotes: "Neon cyan and violet gaming command centre",
      targetAudience: "Minecraft players, streamers, and community members",
      primaryGoal: "Grow player registrations and Discord community activity",
    }
    const sitemap = createMockSitemapStrategy(project, intake, null)
    const copy = createMockCopyDocument(project, sitemap, intake, null)
    const design = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })
    const designSystem = createMockDesignSystemSpecification({ project, intake, researchReport: null, approvedSitemap: sitemap, approvedCopy: copy, approvedDesign: design })
    const spec = createMockComponentSpec(sitemap, copy, design)
    const workspace = {
      projectId: 77,
      slug: "77-rtxgaming",
      relativePath: "generated-sites/77-rtxgaming",
      template: FORGE_WORKSPACE_TEMPLATE,
      fileCount: 0,
      createdAt: "2026-06-21T08:00:00.000Z",
      updatedAt: "2026-06-21T08:00:00.000Z",
    } as const

    const files = createForgeFrontendCodeFiles({
      project,
      workspace,
      approvedSitemap: sitemap,
      approvedCopy: copy,
      approvedDesign: design,
      approvedDesignSystem: designSystem,
      approvedComponentSpec: spec,
      integrationPlaceholders: [],
    })
    const globalsCss = files.find((file) => file.path === "src/app/globals.css")?.content ?? ""
    const tailwindConfig = files.find((file) => file.path === "tailwind.config.ts")?.content ?? ""
    const heroComponent = files.find((file) => file.path === "src/components/Hero.tsx")?.content ?? ""
    const siteData = files.find((file) => file.path === "src/lib/site-data.ts")?.content ?? ""

    expect(design.selectedStylePack).toBe("Neon command hub")
    expect(globalsCss).toContain("--font-display: 'Orbitron'")
    expect(globalsCss).toContain("--surface: #05070f")
    expect(globalsCss).toContain("--brand: #22d3ee")
    expect(globalsCss).toContain("--hero-bg:")
    expect(tailwindConfig).toContain("var(--font-display)")
    expect(tailwindConfig).toContain("var(--brand)")
    expect(tailwindConfig).not.toContain("#22d3ee")
    expect(`${globalsCss}\n${tailwindConfig}`).not.toMatch(/Georgia|#f7f4ef/i)
    expect(heroComponent).toContain("hero-brand-surface")
    expect(heroComponent).toContain("bg-brand")
    expect(siteData).toContain("designTokens")
    expect(siteData).toMatch(/Discord|server|store|player/i)

    expect(buildDesignAlignmentQaResult(design, { globalsCss, tailwindConfig, heroComponent, siteData }).status).toBe("passed")
    expect(buildDesignAlignmentQaResult(design, {
      globalsCss: ":root { --font-display: 'Georgia'; --surface: #f7f4ef; }",
      tailwindConfig: "paper: '#f7f4ef'",
      heroComponent,
      siteData,
    }).status).toBe("failed")
  })

  it("summarises generated frontend code artifacts for admin review", () => {
    const summary = buildForgeGeneratedCodeSummary({
      workspace: {
        projectId: 42,
        slug: "42-acme-ltd",
        relativePath: "generated-sites/42-acme-ltd",
        template: FORGE_WORKSPACE_TEMPLATE,
        fileCount: 32,
        createdAt: "2026-06-21T08:00:00.000Z",
        updatedAt: "2026-06-21T09:00:00.000Z",
      },
      files: [
        { path: "package.json", purpose: "Package", content: "{}" },
        { path: "src/app/page.tsx", purpose: "Home", content: "export default function Page() { return null }" },
      ],
      approvedSitemap: createMockSitemapStrategy({
        name: "Acme rebuild",
        businessName: "Acme Ltd",
        industry: null,
        websiteUrl: null,
        targetAudience: null,
        primaryGoal: null,
      }, emptyForgeIntakeData(), null),
      approvedComponentSpec: createMockComponentSpec(
        createMockSitemapStrategy({
          name: "Acme rebuild",
          businessName: "Acme Ltd",
          industry: null,
          websiteUrl: null,
          targetAudience: null,
          primaryGoal: null,
        }, emptyForgeIntakeData(), null),
        createMockCopyDocument({
          name: "Acme rebuild",
          businessName: "Acme Ltd",
          industry: null,
          brandNotes: null,
          targetAudience: null,
          primaryGoal: null,
        }, createMockSitemapStrategy({
          name: "Acme rebuild",
          businessName: "Acme Ltd",
          industry: null,
          websiteUrl: null,
          targetAudience: null,
          primaryGoal: null,
        }, emptyForgeIntakeData(), null), emptyForgeIntakeData(), null),
        createMockDesignDirection({
          project: {
            name: "Acme rebuild",
            businessName: "Acme Ltd",
            industry: null,
            brandNotes: null,
            targetAudience: null,
          },
          intake: emptyForgeIntakeData(),
          approvedSitemap: createMockSitemapStrategy({
            name: "Acme rebuild",
            businessName: "Acme Ltd",
            industry: null,
            websiteUrl: null,
            targetAudience: null,
            primaryGoal: null,
          }, emptyForgeIntakeData(), null),
          approvedCopy: createMockCopyDocument({
            name: "Acme rebuild",
            businessName: "Acme Ltd",
            industry: null,
            brandNotes: null,
            targetAudience: null,
            primaryGoal: null,
          }, createMockSitemapStrategy({
            name: "Acme rebuild",
            businessName: "Acme Ltd",
            industry: null,
            websiteUrl: null,
            targetAudience: null,
            primaryGoal: null,
          }, emptyForgeIntakeData(), null), emptyForgeIntakeData(), null),
        }),
      ),
      approvedDesign: createMockDesignDirection({
        project: {
          name: "Acme rebuild",
          businessName: "Acme Ltd",
          industry: "Industrial repairs",
          brandNotes: null,
          targetAudience: null,
        },
        intake: emptyForgeIntakeData(),
        approvedSitemap: createMockSitemapStrategy({
          name: "Acme rebuild",
          businessName: "Acme Ltd",
          industry: "Industrial repairs",
          websiteUrl: null,
          targetAudience: null,
          primaryGoal: null,
        }, emptyForgeIntakeData(), null),
        approvedCopy: createMockCopyDocument({
          name: "Acme rebuild",
          businessName: "Acme Ltd",
          industry: "Industrial repairs",
          brandNotes: null,
          targetAudience: null,
          primaryGoal: null,
        }, createMockSitemapStrategy({
          name: "Acme rebuild",
          businessName: "Acme Ltd",
          industry: "Industrial repairs",
          websiteUrl: null,
          targetAudience: null,
          primaryGoal: null,
        }, emptyForgeIntakeData(), null), emptyForgeIntakeData(), null),
      }),
      integrationPlaceholders: ["resend"],
      warnings: [],
    })
    const read = readForgeGeneratedCodeArtifact({ kind: FORGE_GENERATED_CODE_ARTIFACT_KIND, summary })
    const content = buildForgeGeneratedCodeArtifactContent(summary)

    expect(read.status).toBe("generated")
    expect(read.summary?.workspacePath).toBe("generated-sites/42-acme-ltd")
    expect(content).toContain("# Generated Site Code Summary")
    expect(summary.routes).toContain("/style-guide")
    expect(content).toContain("framer-motion")
    expect(content).toContain("Industrial Precision")
  })

  it("stores preview state in Forge memory with loopback defaults", () => {
    const state = defaultForgePreviewState(42, "generated-sites/42-acme-ltd")
    const read = readForgePreviewMemory(JSON.stringify({
      ...state,
      status: "running",
      url: "http://127.0.0.1:4300",
      port: 4300,
      pid: 1234,
      startedAt: "2026-06-21T10:00:00.000Z",
    }))

    expect(FORGE_PREVIEW_MEMORY_KEY).toBe("generated_site_preview")
    expect(FORGE_PREVIEW_METHOD).toBe("local-next-dev")
    expect(state.host).toBe("127.0.0.1")
    expect(read?.status).toBe("running")
    expect(read?.workspacePath).toBe("generated-sites/42-acme-ltd")
    expect(readForgePreviewMemory(JSON.stringify({ ...state, status: "public" }))).toBeNull()
  })

  it("keeps preview hosts private unless public previews are explicitly enabled", () => {
    expect(resolveForgePreviewHost({ FORGE_PREVIEW_HOST: "0.0.0.0" })).toBe("127.0.0.1")
    expect(resolveForgePreviewHost({ FORGE_PREVIEW_HOST: "localhost" })).toBe("localhost")
    expect(resolveForgePreviewHost({ FORGE_PREVIEW_HOST: "0.0.0.0", FORGE_ALLOW_PUBLIC_PREVIEWS: "true" })).toBe("0.0.0.0")
    expect(canExposeForgePreviewHost("0.0.0.0", {})).toBe(false)
    expect(canExposeForgePreviewHost("0.0.0.0", { FORGE_ALLOW_PUBLIC_PREVIEWS: "true" })).toBe(true)
    expect(resolveForgePreviewPortBase({ FORGE_PREVIEW_PORT_BASE: "4400" })).toBe(4400)
    expect(resolveForgePreviewPortBase({ FORGE_PREVIEW_PORT_BASE: "80" })).toBe(4300)
    expect(buildForgePreviewUrl("127.0.0.1", 4300)).toBe("http://127.0.0.1:4300")
  })

  it("defines stable preview viewport sizes", () => {
    expect(FORGE_PREVIEW_VIEWPORTS.desktop.width).toBeGreaterThan(FORGE_PREVIEW_VIEWPORTS.tablet.width)
    expect(FORGE_PREVIEW_VIEWPORTS.tablet.width).toBeGreaterThan(FORGE_PREVIEW_VIEWPORTS.mobile.width)
    expect(FORGE_PREVIEW_VIEWPORTS.mobile.height).toBeGreaterThan(FORGE_PREVIEW_VIEWPORTS.mobile.width)
  })

  it("classifies Forge command chat intents and persists transcript memory", () => {
    expect(FORGE_COMMAND_CHAT_MEMORY_KEY).toBe("forge_command_chat")
    expect(classifyForgeCommandHeuristic("regenerate homepage copy").action).toBe("copy_update")
    expect(classifyForgeCommandHeuristic("make design more premium").action).toBe("design_update")
    expect(classifyForgeCommandHeuristic("run research").action).toBe("research_run")
    expect(classifyForgeCommandHeuristic("generate sitemap").action).toBe("sitemap_run")
    expect(classifyForgeCommandHeuristic("run QA").action).toBe("qa_run")
    expect(classifyForgeCommandHeuristic("repair build errors").action).toBe("repair_run")
    expect(classifyForgeCommandHeuristic("generate proposal").action).toBe("proposal_generate")
    expect(classifyForgeCommandHeuristic("export handover pack").action).toBe("export_run")
    expect(classifyForgeCommandHeuristic("start preview").action).toBe("preview_start")
    expect(classifyForgeCommandHeuristic("improve hero section").action).toBe("site_generate")
    expect(forgeCommandRequiresConfirmation("site_generate")).toBe(true)
    expect(forgeCommandRequiresConfirmation("repair_run")).toBe(true)
    expect(forgeCommandRequiresConfirmation("qa_run")).toBe(false)

    const state = appendForgeCommandMessages(emptyForgeCommandChatState(), [{
      id: "1",
      role: "user",
      content: "run QA",
      createdAt: "2026-06-21T10:00:00.000Z",
      action: "qa_run",
      intent: "qa_run",
      status: "classified",
      taskId: 10,
      jobId: 20,
      requiresConfirmation: false,
    }], "2026-06-21T10:01:00.000Z")
    const read = readForgeCommandChatMemory(JSON.stringify(state))

    expect(read.messages).toHaveLength(1)
    expect(read.messages[0].action).toBe("qa_run")
    expect(read.messages[0].jobId).toBe(20)
    expect(readForgeCommandChatMemory("not json").messages).toHaveLength(0)
  })

  it("detects generated-site QA commands from package scripts", () => {
    const commands = getForgeQaCommands(JSON.stringify({
      scripts: {
        build: "next build",
        typecheck: "tsc --noEmit",
      },
    }))

    expect(commands.map((command) => [command.name, command.shouldRun])).toEqual([
      ["install", true],
      ["typecheck", true],
      ["lint", false],
      ["build", true],
    ])
    expect(commands[0].command).toBe("npm install --ignore-scripts --include=dev --no-audit --no-fund")
  })

  it("controls repair attempts from actual failed QA reports", () => {
    const failedReport = buildQaReport({
      workspacePath: "generated-sites/42-acme-ltd",
      commands: [
        { name: "install", command: "npm install", status: "passed", exitCode: 0, durationMs: 10, stdout: "", stderr: "", skippedReason: null },
        { name: "build", command: "npm run build", status: "failed", exitCode: 1, durationMs: 12, stdout: "build output", stderr: "src/app/page.tsx failed", skippedReason: null },
      ],
    })
    const passedReport = buildQaReport({
      workspacePath: "generated-sites/42-acme-ltd",
      commands: [
        { name: "install", command: "npm install", status: "passed", exitCode: 0, durationMs: 10, stdout: "", stderr: "", skippedReason: null },
        { name: "build", command: "npm run build", status: "passed", exitCode: 0, durationMs: 12, stdout: "", stderr: "", skippedReason: null },
      ],
    })

    expect(canAttemptForgeRepair(failedReport, 3)).toEqual({ ok: true, nextAttempt: 1 })
    expect(canAttemptForgeRepair(passedReport, 3).ok).toBe(false)
    expect(resolveForgeMaxRepairAttempts({ FORGE_MAX_REPAIR_ATTEMPTS: "5" })).toBe(5)
    expect(resolveForgeMaxRepairAttempts({ FORGE_MAX_REPAIR_ATTEMPTS: "bad" })).toBe(3)

    failedReport.repairHistory = [
      { attempt: 1, taskId: 1, status: "failed", summary: "Failed", patches: [], startedAt: "now", completedAt: "now", error: "Nope" },
    ]
    expect(canAttemptForgeRepair(failedReport, 1).ok).toBe(false)
  })

  it("validates repair patches against workspace safety rules", () => {
    expect(validateForgeRepairPatches([
      { path: "src/app/page.tsx", content: "export default function Page() { return null }", reason: "Fix page" },
    ])).toEqual({ ok: true })
    expect(validateForgeRepairPatches([
      { path: "../admin/src/app/page.tsx", content: "bad", reason: "Escape" },
    ]).ok).toBe(false)
    expect(validateForgeRepairPatches([
      { path: "web/src/app/page.tsx", content: "bad", reason: "Core app" },
    ]).ok).toBe(false)
  })

  it("builds deterministic repair patches for readonly generated site data errors", () => {
    const report = buildQaReport({
      workspacePath: "generated-sites/42-acme-ltd",
      commands: [
        {
          name: "typecheck",
          command: "npm run typecheck",
          status: "failed",
          exitCode: 2,
          durationMs: 10,
          stdout: "",
          stderr: "trustElements is readonly and cannot be assigned to the mutable type string[]",
          skippedReason: null,
        },
      ],
    })
    const repair = buildDeterministicForgeRepairPatchResponse({
      report,
      files: [{
        path: "src/lib/site-data.ts",
        content: [
          "export type SitePage = {",
          "  trustElements: string[]",
          "  sectionHeadings: string[]",
          "  sections: { heading: string; body: string }[]",
          "  faqItems: { question: string; answer: string }[]",
          "  serviceDescriptions: string[]",
          "}",
        ].join("\n"),
      }],
    })

    expect(repair.patches).toHaveLength(1)
    expect(repair.patches[0].content).toContain("trustElements: readonly string[]")
    expect(repair.patches[0].content).toContain("sections: readonly { readonly heading: string; readonly body: string }[]")
  })

  it("reads and formats QA reports with repair history", () => {
    const report = buildQaReport({
      workspacePath: "generated-sites/42-acme-ltd",
      commands: [
        { name: "install", command: "npm install", status: "passed", exitCode: 0, durationMs: 10, stdout: "", stderr: "", skippedReason: null },
        { name: "build", command: "npm run build", status: "failed", exitCode: 1, durationMs: 12, stdout: "build output", stderr: "build error", skippedReason: null },
      ],
      repairHistory: [
        { attempt: 1, taskId: 2, status: "no_patch", summary: "Mock repair", patches: [], startedAt: "2026-06-21T10:00:00.000Z", completedAt: "2026-06-21T10:01:00.000Z", error: null },
      ],
    })
    const read = readForgeQaArtifact({ kind: FORGE_QA_ARTIFACT_KIND, report })
    const content = buildForgeQaArtifactContent(report)

    expect(FORGE_QA_ARTIFACT_TITLE).toBe("QA Report")
    expect(read.status).toBe("failed")
    expect(read.repairHistory).toHaveLength(1)
    expect(content).toContain("# QA Report")
    expect(content).toContain("Attempt 1")
  })

  it("truncates captured QA logs safely", () => {
    const long = "x".repeat(20_000)
    const truncated = truncateForgeQaLog(long, 1_000)

    expect(truncated.length).toBeLessThan(long.length)
    expect(truncated).toContain("[...truncated")
  })

  it("validates and redacts Forge Resend integration config", () => {
    expect(parseForgeResendConfigPayload({ enabled: true, fromEmail: "", toEmail: "" }).ok).toBe(false)
    const parsed = parseForgeResendConfigPayload({
      enabled: true,
      fromEmail: "Website <hello@example.com>",
      toEmail: "leads@example.com",
      replyToBehaviour: "submitter",
      subjectPrefix: "Acme enquiry",
      testMode: true,
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(readForgeResendConfig(parsed.data, true)).toMatchObject({ enabled: true, testMode: true })
      expect(redactForgeResendConfig(parsed.data).apiKey).toBe("[environment: RESEND_API_KEY]")
      expect(buildResendIntegrationPlaceholder(parsed.data)).toContain("Resend enabled")
    }

    expect(defaultForgeResendConfig().testMode).toBe(true)
  })

  it("adds a QA failure when Resend is enabled but generated form files are missing", () => {
    expect(buildResendFormQaResult({
      contactRoute: true,
      config: true,
      validation: true,
      template: true,
    }, true).status).toBe("passed")
    expect(buildResendFormQaResult({
      contactRoute: false,
      config: true,
      validation: true,
      template: true,
    }, true).status).toBe("failed")
    expect(buildResendFormQaResult({
      contactRoute: false,
      config: false,
      validation: false,
      template: false,
    }, false).status).toBe("skipped")
  })

  it("adds a QA failure when generated reduced-motion support is missing", () => {
    expect(buildReducedMotionQaResult({
      globalsCss: "@media (prefers-reduced-motion: reduce) { .motion-safe-card, .motion-safe-cta { transform: none !important; } }",
      motionSection: "import { useReducedMotion } from 'framer-motion'",
      animationConfig: true,
    }).status).toBe("passed")
    expect(buildReducedMotionQaResult({
      globalsCss: ".motion-safe-card { transform: translateY(-2px); }",
      motionSection: "export function MotionSection() { return null }",
      animationConfig: true,
    }).status).toBe("failed")
  })

  it("defines mandatory generated-site QA gates", () => {
    expect(FORGE_MANDATORY_QA_CHECKS.map((check) => check.name)).toEqual([
      "typecheck",
      "build",
      "placeholder_scan",
      "copy_quality",
      "cta_relevance",
      "schema_appropriateness",
      "design_alignment",
      "mobile_responsive",
      "content_depth",
      "seo_score",
      "forbidden_generic_content",
    ])
  })

  it("runs deterministic generated-site content QA scans", () => {
    const files = [
      {
        path: "src/lib/site-data.ts",
        content: `export const site = ${JSON.stringify({
          businessName: "RTXGaming",
          industry: "Minecraft server",
          brandNotes: "Neon gaming server hub",
          targetAudience: "Minecraft players",
          primaryGoal: "Grow server joins",
          nav: [{ label: "Play", href: "/play" }],
          services: [{ title: "Survival server", href: "/play", description: "Join the RTXGaming survival world with community events." }],
          pages: [{
            title: "Home",
            path: "/",
            schema: "Organization schema",
            h1: "RTXGaming Minecraft server",
            heroSubheading: "Join the server, meet players on Discord, and explore game modes.",
            primaryCta: "Copy server IP",
            secondaryCta: "Join Discord",
            trustElements: ["Active Discord", "Player support", "Store and vote routes"],
            sections: [{ heading: "Game modes", body: "Survival, events, ranks, and player support are easy to find." }],
            faqItems: [{ question: "How do I join?", answer: "Copy the server IP and join Discord for support." }],
            localSeoCopy: "RTXGaming supports players through server actions and community updates.",
          }],
        })} as const`,
      },
      {
        path: "src/lib/seo.ts",
        content: "export const seo = { pages: { '/': { jsonLd: [{ '@type': 'Organization' }, { '@type': 'FAQPage' }] } } }",
      },
      {
        path: "src/components/Hero.tsx",
        content: "export function Hero(){ return <section className=\"grid max-w-7xl px-5 md:grid-cols-2\"><a>Copy server IP</a></section> }",
      },
      {
        path: "src/app/globals.css",
        content: "body{overflow-x:hidden}",
      },
    ]

    expect(buildPlaceholderScanQaResult(files).status).toBe("passed")
    expect(buildCopyQualityQaResult(files).status).toBe("passed")
    expect(buildCtaRelevanceQaResult(files).status).toBe("passed")
    expect(buildSchemaAppropriatenessQaResult(files).status).toBe("passed")
    expect(buildMobileResponsiveQaResult(files).status).toBe("passed")
    expect(buildForbiddenGenericContentQaResult(files).status).toBe("passed")

    const badFiles = files.map((file) => file.path === "src/lib/site-data.ts"
      ? { ...file, content: file.content.replace("Copy server IP", "Learn more").replace("Join Discord", "Lorem ipsum placeholder") }
      : file)

    expect(buildPlaceholderScanQaResult(badFiles).status).toBe("failed")
    expect(buildForbiddenGenericContentQaResult(badFiles).status).toBe("failed")
    expect(buildCtaRelevanceQaResult(badFiles).status).toBe("failed")
    expect(buildContentDepthQaResult(files).status).toBe("passed")
  })

  it("flags thin and duplicated pages in the content depth check", () => {
    const thinFiles = [{
      path: "src/lib/site-data.ts",
      content: `export const site = ${JSON.stringify({
        businessName: "Acme",
        pages: [
          { path: "/", heroSubheading: "Hi.", sections: [{ heading: "x", body: "Short." }], faqItems: [], serviceDescriptions: [], localSeoCopy: "" },
          { path: "/about", heroSubheading: "Hi.", sections: [{ heading: "x", body: "Short." }], faqItems: [], serviceDescriptions: [], localSeoCopy: "" },
        ],
      })} as const`,
    }]
    const result = buildContentDepthQaResult(thinFiles)

    expect(result.status).toBe("failed")
    expect(result.stderr).toContain("Thin pages")
    expect(result.stderr).toContain("identical body copy")
  })

  it("scores readiness and gates Client ready on hard checks", () => {
    const passed = (name: string): ForgeQaCommandResult => ({ name: name as ForgeQaCommandResult["name"], command: name, status: "passed", exitCode: 0, durationMs: 1, stdout: "ok", stderr: "", skippedReason: null })
    const allHardPassing = [
      "install",
      ...FORGE_MANDATORY_QA_CHECKS.map((check) => check.name),
    ].map(passed)

    const ready = computeForgeReadiness(allHardPassing)
    expect(ready.score).toBe(100)
    expect(ready.band).toBe("client_ready")
    expect(ready.clientReady).toBe(true)
    expect(ready.blockingReasons).toEqual([])

    // A failing catastrophic check (build) caps the score in the bottom band and blocks client ready.
    const buildFailing = allHardPassing.map((command) =>
      command.name === "build" ? { ...command, status: "failed" as const, exitCode: 1 } : command)
    const broken = computeForgeReadiness(buildFailing)
    expect(broken.clientReady).toBe(false)
    expect(broken.band).toBe("not_acceptable")
    expect(broken.score).toBeLessThan(60)
    expect(broken.blockingReasons.some((reason) => /Production build/.test(reason))).toBe(true)

    // A single non-catastrophic hard failure cannot reach Client ready, capped at Needs review.
    const seoFailing = allHardPassing.map((command) =>
      command.name === "seo_score" ? { ...command, status: "failed" as const, exitCode: 1 } : command)
    const needsReview = computeForgeReadiness(seoFailing)
    expect(needsReview.clientReady).toBe(false)
    expect(needsReview.hardChecksPassed).toBe(false)
    expect(needsReview.score).toBeLessThanOrEqual(74)
  })

  it("embeds the readiness assessment in QA reports and artifact content", () => {
    const report = buildQaReport({
      workspacePath: "generated-sites/42-acme-ltd",
      commands: [
        { name: "install", command: "npm install", status: "passed", exitCode: 0, durationMs: 10, stdout: "", stderr: "", skippedReason: null },
        { name: "typecheck", command: "npm run typecheck", status: "failed", exitCode: 2, durationMs: 12, stdout: "", stderr: "type error", skippedReason: null },
      ],
    })

    expect(report.readiness.clientReady).toBe(false)
    expect(report.readiness.band).toBe("not_acceptable")
    expect(buildForgeQaArtifactContent(report)).toContain("## Readiness")
    expect(buildForgeQaArtifactContent(report)).toContain("Client ready: no")
  })

  it("validates and redacts Forge WhatsApp integration config", () => {
    expect(parseForgeWhatsAppConfigPayload({ enabled: true, businessNumber: "not a phone" }).ok).toBe(false)
    const parsed = parseForgeWhatsAppConfigPayload({
      enabled: true,
      businessNumber: "+44 7700 900123",
      defaultMessage: "Hi, I would like to talk about my project.",
      ctaLabel: "Chat on WhatsApp",
      placements: ["sticky", "inline", "service_pages", "contact_page"],
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(readForgeWhatsAppConfig(parsed.data, true)).toMatchObject({ enabled: true, businessNumber: "+44 7700 900123" })
      expect(redactForgeWhatsAppConfig(parsed.data).cloudApi.accessToken).toBe("[future env: WHATSAPP_ACCESS_TOKEN]")
      expect(buildWhatsAppIntegrationPlaceholder(parsed.data)).toContain("WhatsApp enabled")
      expect(buildWhatsAppUrl(parsed.data.businessNumber, parsed.data.defaultMessage)).toContain("https://wa.me/447700900123")
    }

    expect(defaultForgeWhatsAppConfig().placements).toContain("sticky")
  })

  it("adds a QA failure when WhatsApp is enabled but generated CTA files or links are invalid", () => {
    const config = defaultForgeWhatsAppConfig()
    config.businessNumber = "+447700900123"
    config.defaultMessage = "Hi, I need help."
    config.ctaLabel = "WhatsApp us"
    config.placements = ["sticky", "inline", "contact_page"]
    config.enabled = true

    expect(buildWhatsAppLinkQaResult({
      config: true,
      cta: true,
      sticky: true,
    }, config).status).toBe("passed")
    expect(buildWhatsAppLinkQaResult({
      config: false,
      cta: true,
      sticky: true,
    }, config).status).toBe("failed")
    expect(buildWhatsAppLinkQaResult({
      config: true,
      cta: true,
      sticky: true,
    }, { ...config, businessNumber: "123" }).status).toBe("failed")
    expect(buildWhatsAppLinkQaResult({
      config: false,
      cta: false,
      sticky: false,
    }, { ...config, enabled: false }).status).toBe("skipped")
  })

  it("builds Docker sandbox args with resource limits, loopback publishing, and no secret envs", () => {
    const config = resolveForgeSandboxConfig({
      FORGE_SANDBOX_RUNNER: "docker",
      FORGE_SANDBOX_CPUS: "2",
      FORGE_SANDBOX_MEMORY: "1536m",
      FORGE_SANDBOX_NETWORK: "none",
    })
    const args = buildForgeDockerRunArgs({
      workspaceRoot: "/tmp/generated-sites/1-demo",
      command: "npm run build",
      config,
      publish: { host: "127.0.0.1", hostPort: 4300, containerPort: 3000 },
    })

    expect(config.runner).toBe("docker")
    expect(args).toContain("--cpus")
    expect(args).toContain("2")
    expect(args).toContain("--memory")
    expect(args).toContain("1536m")
    expect(args).toContain("--network")
    expect(args).toContain("none")
    expect(args).toContain("--cap-drop")
    expect(args).toContain("no-new-privileges")
    expect(args).toContain("127.0.0.1:4300:3000")
    expect(args.join(" ")).not.toContain("OPENAI_API_KEY")
    expect(args.join(" ")).not.toContain("DATABASE_URL")
  })

  it("enforces live Forge AI budget limits before provider calls", () => {
    const config = resolveForgeAiBudgetConfig({
      FORGE_ENABLE_AI: "true",
      FORGE_AI_MAX_TOKENS_PER_TASK: "1000",
      FORGE_AI_DAILY_TOKEN_BUDGET: "2000",
      FORGE_AI_DAILY_USD_BUDGET: "3",
    })
    const ledger = { date: getForgeAiBudgetDate(new Date("2026-06-21T10:00:00.000Z")), totalTokens: 1500, totalCostUsd: 1.25, requests: 2 }

    expect(assertForgeAiBudgetAllowsRequest({ config, ledger, requestedMaxTokens: 400 })).toEqual({ ok: true })
    expect(assertForgeAiBudgetAllowsRequest({ config, ledger, requestedMaxTokens: 1200 }).ok).toBe(false)
    expect(assertForgeAiBudgetAllowsRequest({ config, ledger, requestedMaxTokens: 700 }).ok).toBe(false)
    expect(estimateForgeAiCostUsd("openai", { inputTokens: 1000, outputTokens: 500 })).toBeGreaterThan(0)
    expect(resolveForgeAiBudgetConfig({ FORGE_ENABLE_AI: "false" }).enabled).toBe(false)
  })

  it("resolves persisted Forge AI cost budgets and warning states", () => {
    const config = resolveForgeAiCostBudgetConfig({
      FORGE_MAX_PROJECT_AI_COST: "12.5",
      FORGE_MAX_MONTHLY_AI_COST: "100",
    })

    expect(config.maxProjectAiCost).toBe(12.5)
    expect(config.maxMonthlyAiCost).toBe(100)
    expect(parseForgeAiCostLimit("0")).toBeNull()
    expect(parseForgeAiCostLimit("not-a-number")).toBeNull()

    const safe = buildForgeAiBudgetStatus(5, config.maxProjectAiCost, 1)
    const warning = buildForgeAiBudgetStatus(9.9, config.maxProjectAiCost, 0.2)
    const blocked = buildForgeAiBudgetStatus(12.4, config.maxProjectAiCost, 0.2)

    expect(safe.warning).toBe(false)
    expect(safe.blocked).toBe(false)
    expect(warning.warning).toBe(true)
    expect(blocked.blocked).toBe(true)
    expect(formatForgeAiCost(0.123456)).toBe("$0.1235")
  })

  it("versions artifacts and compacts large retained logs", () => {
    const retention = resolveForgeArtifactRetentionConfig({
      FORGE_ARTIFACT_MAX_VERSIONS: "4",
      FORGE_ARTIFACT_MAX_CONTENT_BYTES: "100000",
      FORGE_QA_LOG_MAX_CHARS: "3000",
    })
    const metadata = buildForgeArtifactVersionMetadata({
      latestVersion: 3,
      content: "QA report",
      retentionPolicy: "qa-log",
      now: new Date("2026-06-21T10:00:00.000Z"),
    })
    const compacted = compactForgeLargeLog("x".repeat(10_000), retention.largeLogMaxChars)

    expect(retention.maxVersionsPerArtifact).toBe(4)
    expect(metadata.version).toBe(4)
    expect(metadata.retentionPolicy).toBe("qa-log")
    expect(compacted.length).toBeLessThan(10_000)
    expect(compacted).toContain("retained tail")
  })

  it("protects every Forge API route with explicit auth", () => {
    const apiRoot = path.resolve(process.cwd(), "src/app/api/forge")
    const routeFiles = collectRouteFiles(apiRoot)

    expect(routeFiles.length).toBeGreaterThanOrEqual(21)
    for (const file of routeFiles) {
      const content = readFileSync(file, "utf8")
      expect(content, file).toMatch(/auth\(\)/)
      expect(content, file).toMatch(/Unauthorized\./)
    }
  })
})

function collectRouteFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...collectRouteFiles(absolute))
    if (entry.isFile() && entry.name === "route.ts") files.push(absolute)
  }
  return files
}

// RTXGaming is the canonical "premium gaming/community site" scenario. It locks in that Forge cannot
// regress back to generic local-business output (beige styling, LocalBusiness schema, enquiry-first
// CTAs) for a Minecraft server/community brand. If any quality gate below flips to failing, Forge has
// regressed and this test must fail.
describe("RTXGaming Forge quality regression", () => {
  function buildRtxScenario() {
    const intake = emptyForgeIntakeData()
    intake.coreServices = "Survival\nSkyblock\nBedwars\nPremium ranks"
    intake.conversionActions = "Copy server IP\nJoin Discord\nRegister account\nVisit store\nVote for server"
    intake.visualStyle = "Dark neon gaming command hub"
    const project = {
      id: 77,
      name: "RTXGaming",
      businessName: "RTXGaming",
      industry: "Minecraft server and gaming community",
      websiteUrl: "https://rtxgaming.example",
      brandNotes: "Premium Minecraft server and Discord community with a dark neon gaming aesthetic",
      targetAudience: "Minecraft players and Discord community members",
      primaryGoal: "Grow server joins, Discord members, store visits and votes",
    }
    const sitemap = createMockSitemapStrategy(project, intake, null)
    const copy = createMockCopyDocument(project, sitemap, intake, null)
    const design = createMockDesignDirection({ project, intake, approvedSitemap: sitemap, approvedCopy: copy })
    const spec = createMockComponentSpec(sitemap, copy, design)
    const workspace = {
      projectId: 77,
      slug: "77-rtxgaming",
      relativePath: "generated-sites/77-rtxgaming",
      template: FORGE_WORKSPACE_TEMPLATE,
      fileCount: 0,
      createdAt: "2026-06-24T08:00:00.000Z",
      updatedAt: "2026-06-24T08:00:00.000Z",
    } as const
    const files = createForgeFrontendCodeFiles({
      project,
      workspace,
      approvedSitemap: sitemap,
      approvedCopy: copy,
      approvedDesign: design,
      approvedComponentSpec: spec,
      integrationPlaceholders: [],
    })
    const read = (path: string) => files.find((file) => file.path === path)?.content ?? ""
    return { sitemap, design, files, siteData: read("src/lib/site-data.ts"), seo: read("src/lib/seo.ts"), globals: read("src/app/globals.css") }
  }

  it("produces a premium gaming site, not generic local-business output", () => {
    const { sitemap, design, files, siteData, seo, globals } = buildRtxScenario()

    // Gaming strategy + dark neon design pack are selected (not local-service / beige editorial).
    expect(sitemap.selectedStrategyPack).toBe("gaming_community_server")
    expect(design.selectedStylePack).toBe("Neon command hub")

    // Expected gaming structure: game modes, store, vote, community, support pages.
    const paths = sitemap.sitemap.map((page) => page.path)
    expect(paths).toEqual(expect.arrayContaining(["/", "/game-modes", "/store", "/vote", "/community", "/support"]))

    // Expected CTAs: server IP, Discord, login/register, store, vote.
    const ctaText = [...siteData.matchAll(/"(?:primary|secondary)Cta":\s*"([^"]+)"/g)].map((match) => match[1]).join(" | ").toLowerCase()
    expect(ctaText).toContain("server ip")
    expect(ctaText).toContain("discord")
    expect(ctaText).toMatch(/store|vote/)
    expect(siteData.toLowerCase()).toMatch(/login|register/)

    // Server stats placeholders present; no beige/editorial styling; no LocalBusiness schema.
    expect(siteData.toLowerCase()).toMatch(/status|stat|player count|online/)
    expect(/#f7f4ef|beige|cream|\bGeorgia\b/i.test(globals)).toBe(false)
    expect(/"@type"\s*:\s*"LocalBusiness"/.test(seo)).toBe(false)
    expect(seo).toContain("WebSite")

    // Every mandatory content/design quality gate passes for the canonical gaming output.
    expect(buildPlaceholderScanQaResult(files).status).toBe("passed")
    expect(buildCopyQualityQaResult(files).status).toBe("passed")
    expect(buildCtaRelevanceQaResult(files).status).toBe("passed")
    expect(buildSchemaAppropriatenessQaResult(files).status).toBe("passed")
    expect(buildMobileResponsiveQaResult(files).status).toBe("passed")
    expect(buildContentDepthQaResult(files).status).toBe("passed")
    expect(buildForbiddenGenericContentQaResult(files).status).toBe("passed")
    expect(buildDesignAlignmentQaResult(design, {
      globalsCss: globals,
      tailwindConfig: files.find((file) => file.path === "tailwind.config.ts")?.content ?? "",
      heroComponent: files.find((file) => file.path === "src/components/Hero.tsx")?.content ?? "",
      siteData,
    }).status).toBe("passed")

    // site-data.ts is syntactically valid TypeScript (typecheck/build proxy at the unit level).
    const syntaxErrors = ts
      .transpileModule(siteData, { reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ESNext } })
      .diagnostics?.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error) ?? []
    expect(syntaxErrors).toEqual([])
  })

  it("reaches Client ready when the gaming gates and typecheck/build pass", () => {
    const { files } = buildRtxScenario()
    const commands: ForgeQaCommandResult[] = [
      buildPlaceholderScanQaResult(files),
      buildCopyQualityQaResult(files),
      buildCtaRelevanceQaResult(files),
      buildSchemaAppropriatenessQaResult(files),
      buildMobileResponsiveQaResult(files),
      buildContentDepthQaResult(files),
      buildForbiddenGenericContentQaResult(files),
      { name: "typecheck", command: "tsc --noEmit", status: "passed", exitCode: 0, durationMs: 1, stdout: "", stderr: "", skippedReason: null },
      { name: "build", command: "next build", status: "passed", exitCode: 0, durationMs: 1, stdout: "", stderr: "", skippedReason: null },
      { name: "design_alignment", command: "design", status: "passed", exitCode: 0, durationMs: 1, stdout: "", stderr: "", skippedReason: null },
      { name: "seo_score", command: "seo", status: "passed", exitCode: 0, durationMs: 1, stdout: "", stderr: "", skippedReason: null },
    ]
    const readiness = computeForgeReadiness(commands)

    expect(readiness.clientReady).toBe(true)
    expect(readiness.band).toBe("client_ready")
    expect(readiness.blockingReasons).toEqual([])
  })

  it("still rejects a regression to generic local-business output", () => {
    const { files } = buildRtxScenario()
    // Simulate Forge regressing to generic output: enquiry-first CTAs and LocalBusiness JSON-LD.
    const regressed = files.map((file) => {
      if (file.path === "src/lib/site-data.ts") {
        // Strip every gaming CTA back to an enquiry-first label.
        return { ...file, content: file.content.replace(/("(?:primary|secondary)Cta":\s*)"[^"]+"/g, '$1"Request a quote"') }
      }
      if (file.path === "src/lib/seo.ts") {
        return { ...file, content: `${file.content}\nconst extra = { "@type": "LocalBusiness" }` }
      }
      return file
    })

    expect(buildCtaRelevanceQaResult(regressed).status).toBe("failed")
    expect(buildSchemaAppropriatenessQaResult(regressed).status).toBe("failed")
  })
})
