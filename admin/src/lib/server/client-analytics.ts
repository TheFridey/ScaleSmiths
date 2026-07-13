import "server-only"
import { and, desc, eq, gte } from "drizzle-orm"
import { isBuildPhaseWithoutDatabase } from "@/lib/build-env"
import { minimisedMetric, summarizeClientAnalytics, type AnalyticsProviderId, type ClientAnalyticsDailyMetric, type ClientAnalyticsSummary } from "@/lib/client-analytics"
import { evaluateWebsiteOutcome, type WebsiteOutcomeEvaluation } from "@/lib/website-outcome-evaluator"
import { buildContinuousOptimisationProposals, didProposalImproveMetric, type StoredOptimisationProposal } from "@/lib/continuous-optimisation"
import { analyticsAdapterFor } from "./client-analytics-adapters"
import { decryptAnalyticsCredentials, encryptAnalyticsCredentials } from "./client-analytics-credentials"

export async function loadClientAnalyticsSummary(clientId: number): Promise<ClientAnalyticsSummary> {
  if (isBuildPhaseWithoutDatabase()) return summarizeClientAnalytics({ configs: [], metrics: [] })
  const { db } = await import("@/lib/db")
  const { clientAnalyticsConfigs, clientAnalyticsDailyMetrics } = await import("@/lib/schema")
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)
  const [configs, metrics] = await Promise.all([
    db.select().from(clientAnalyticsConfigs).where(eq(clientAnalyticsConfigs.clientId, clientId)).orderBy(desc(clientAnalyticsConfigs.updatedAt)),
    db.select().from(clientAnalyticsDailyMetrics).where(and(eq(clientAnalyticsDailyMetrics.clientId, clientId), gte(clientAnalyticsDailyMetrics.metricDate, since))).orderBy(desc(clientAnalyticsDailyMetrics.metricDate)),
  ])
  return summarizeClientAnalytics({
    configs: configs.map((config) => ({
      id: config.id,
      clientId: config.clientId,
      provider: config.provider,
      displayName: config.displayName,
      propertyId: config.propertyId,
      consentGranted: config.consentGranted,
      consentNotes: config.consentNotes,
      retentionDays: config.retentionDays,
      enabled: config.enabled,
      scopes: config.scopes,
      sourceAttribution: config.sourceAttribution,
      hasCredentials: Boolean(config.credentialsEncrypted),
      lastIngestedAt: config.lastIngestedAt?.toISOString() ?? null,
    })),
    metrics: metrics.map((metric) => ({
      clientId: metric.clientId,
      configId: metric.configId,
      metricDate: metric.metricDate.toISOString(),
      source: metric.source,
      sourceAttribution: metric.sourceAttribution,
      sessions: metric.sessions,
      conversionEvents: metric.conversionEvents,
      formSubmissions: metric.formSubmissions,
      phoneClicks: metric.phoneClicks,
      ctaClicks: metric.ctaClicks,
      searchImpressions: metric.searchImpressions,
      searchClicks: metric.searchClicks,
      errorCount: metric.errorCount,
      uptimeChecks: metric.uptimeChecks,
      uptimeFailures: metric.uptimeFailures,
      lcpP75Ms: metric.lcpP75Ms,
      inpP75Ms: metric.inpP75Ms,
      clsP75: metric.clsP75 === null ? null : Number(metric.clsP75),
      rawSummary: metric.rawSummary,
    })),
  })
}

export async function loadClientWebsiteOutcomeEvaluation(clientId: number): Promise<WebsiteOutcomeEvaluation> {
  if (isBuildPhaseWithoutDatabase()) return evaluateWebsiteOutcome({ clientId, clientName: `Client #${clientId}`, intendedConversionStrategy: null, analytics: summarizeClientAnalytics({ configs: [], metrics: [] }), metrics: [] })
  const { db } = await import("@/lib/db")
  const { clientAnalyticsConfigs, clientAnalyticsDailyMetrics, clients, forgeProjects, leadScoreSnapshots, prospects } = await import("@/lib/schema")
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - 30)
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  const [configs, metrics, projects, scores] = await Promise.all([
    db.select().from(clientAnalyticsConfigs).where(eq(clientAnalyticsConfigs.clientId, clientId)).orderBy(desc(clientAnalyticsConfigs.updatedAt)),
    db.select().from(clientAnalyticsDailyMetrics).where(and(eq(clientAnalyticsDailyMetrics.clientId, clientId), gte(clientAnalyticsDailyMetrics.metricDate, since))).orderBy(desc(clientAnalyticsDailyMetrics.metricDate)),
    db.select().from(forgeProjects).where(eq(forgeProjects.clientId, clientId)).orderBy(desc(forgeProjects.updatedAt)),
    db.select({
      outcome: leadScoreSnapshots.outcome,
      outcomeValue: leadScoreSnapshots.outcomeValue,
      convertedClientId: prospects.convertedClientId,
    }).from(leadScoreSnapshots).innerJoin(prospects, eq(prospects.id, leadScoreSnapshots.prospectId)).where(eq(prospects.convertedClientId, clientId)),
  ])
  const metricRows: ClientAnalyticsDailyMetric[] = metrics.map((metric) => ({
    clientId: metric.clientId,
    configId: metric.configId,
    metricDate: metric.metricDate.toISOString(),
    source: metric.source,
    sourceAttribution: metric.sourceAttribution,
    sessions: metric.sessions,
    conversionEvents: metric.conversionEvents,
    formSubmissions: metric.formSubmissions,
    phoneClicks: metric.phoneClicks,
    ctaClicks: metric.ctaClicks,
    searchImpressions: metric.searchImpressions,
    searchClicks: metric.searchClicks,
    errorCount: metric.errorCount,
    uptimeChecks: metric.uptimeChecks,
    uptimeFailures: metric.uptimeFailures,
    lcpP75Ms: metric.lcpP75Ms,
    inpP75Ms: metric.inpP75Ms,
    clsP75: metric.clsP75 === null ? null : Number(metric.clsP75),
    rawSummary: metric.rawSummary,
  }))
  const analytics = summarizeClientAnalytics({
    configs: configs.map((config) => ({
      id: config.id,
      clientId: config.clientId,
      provider: config.provider,
      displayName: config.displayName,
      propertyId: config.propertyId,
      consentGranted: config.consentGranted,
      consentNotes: config.consentNotes,
      retentionDays: config.retentionDays,
      enabled: config.enabled,
      scopes: config.scopes,
      sourceAttribution: config.sourceAttribution,
      hasCredentials: Boolean(config.credentialsEncrypted),
      lastIngestedAt: config.lastIngestedAt?.toISOString() ?? null,
    })),
    metrics: metricRows,
  })
  const wonValues = scores.filter((score) => score.outcome === "won" && typeof score.outcomeValue === "number").map((score) => score.outcomeValue ?? 0)
  return evaluateWebsiteOutcome({
    clientId,
    clientName: client?.name ?? `Client #${clientId}`,
    intendedConversionStrategy: projects.find((project) => project.primaryGoal)?.primaryGoal ?? null,
    launchedAt: projects.find((project) => project.status === "deployed")?.updatedAt.toISOString() ?? null,
    analytics,
    metrics: metricRows,
    leadQuality: scores.length ? {
      won: scores.filter((score) => score.outcome === "won").length,
      lost: scores.filter((score) => score.outcome === "lost" || score.outcome === "disqualified").length,
      noDecision: scores.filter((score) => score.outcome === "no_decision" || !score.outcome).length,
      averageValue: wonValues.length ? Math.round(wonValues.reduce((sum, value) => sum + value, 0) / wonValues.length) : null,
    } : null,
  })
}

export async function loadClientOptimisationProposals(clientId: number): Promise<{ generated: ReturnType<typeof buildContinuousOptimisationProposals>; stored: StoredOptimisationProposal[] }> {
  if (isBuildPhaseWithoutDatabase()) return { generated: [], stored: [] }
  const { db } = await import("@/lib/db")
  const { clientOptimisationProposals, clients } = await import("@/lib/schema")
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
  const outcome = await loadClientWebsiteOutcomeEvaluation(clientId)
  const generated = buildContinuousOptimisationProposals({
    clientId,
    clientName: client?.name ?? `Client #${clientId}`,
    isRetainerClient: Boolean(client && client.mrr > 0 && client.status === "active"),
    outcome,
  })
  const rows = await db.select().from(clientOptimisationProposals).where(eq(clientOptimisationProposals.clientId, clientId)).orderBy(desc(clientOptimisationProposals.updatedAt))
  return {
    generated: generated.filter((proposal) => !rows.some((row) => row.proposalKey === proposal.key)),
    stored: rows.map((row) => ({
      id: row.id,
      key: row.proposalKey,
      title: row.title,
      evidence: row.evidenceJson as unknown as StoredOptimisationProposal["evidence"],
      expectedImpact: row.expectedImpact,
      confidence: row.confidence as StoredOptimisationProposal["confidence"],
      estimatedEffort: row.estimatedEffort,
      risk: row.risk as StoredOptimisationProposal["risk"],
      proposedChange: row.proposedChange,
      validationMethod: row.validationMethod,
      rollbackPlan: row.rollbackPlan,
      requiredApproval: row.requiredApproval,
      relevantPages: row.relevantPages,
      relevantArtifacts: row.relevantArtifacts as unknown as StoredOptimisationProposal["relevantArtifacts"],
      targetMetric: row.targetMetric,
      baselineValue: row.baselineValue === null ? null : Number(row.baselineValue),
      status: row.status,
      measuredValue: row.measuredValue === null ? null : Number(row.measuredValue),
      improved: row.improved,
      outcomeNotes: row.outcomeNotes,
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt?.toISOString() ?? null,
      measuredAt: row.measuredAt?.toISOString() ?? null,
    })),
  }
}

export async function saveGeneratedOptimisationProposal(input: { clientId: number; key: string; actor: string }) {
  if (isBuildPhaseWithoutDatabase()) return null
  const { db } = await import("@/lib/db")
  const { clientAnalyticsAuditLogs, clientOptimisationProposals } = await import("@/lib/schema")
  const proposals = await loadClientOptimisationProposals(input.clientId)
  const proposal = proposals.generated.find((item) => item.key === input.key)
  if (!proposal) throw new Error("Optimisation proposal not found or already stored.")
  const [created] = await db.insert(clientOptimisationProposals).values({
    clientId: input.clientId,
    proposalKey: proposal.key,
    title: proposal.title,
    evidenceJson: proposal.evidence as unknown as Record<string, unknown>[],
    expectedImpact: proposal.expectedImpact,
    confidence: proposal.confidence,
    estimatedEffort: proposal.estimatedEffort,
    risk: proposal.risk,
    proposedChange: proposal.proposedChange,
    validationMethod: proposal.validationMethod,
    rollbackPlan: proposal.rollbackPlan,
    requiredApproval: proposal.requiredApproval,
    relevantPages: proposal.relevantPages,
    relevantArtifacts: proposal.relevantArtifacts as unknown as Record<string, unknown>[],
    targetMetric: proposal.targetMetric,
    baselineValue: proposal.baselineValue === null ? null : String(proposal.baselineValue),
  }).returning()
  await db.insert(clientAnalyticsAuditLogs).values({ clientId: input.clientId, actor: input.actor, action: "optimisation_proposal_created", message: `Created optimisation proposal: ${proposal.title}.`, metadataJson: { proposalKey: proposal.key, targetMetric: proposal.targetMetric, automaticWebsiteChange: false } })
  return created
}

export async function updateOptimisationProposalStatus(input: { clientId: number; proposalId: number; status: "accepted" | "rejected" | "completed"; actor: string; notes?: string | null }) {
  if (isBuildPhaseWithoutDatabase()) return null
  const { db } = await import("@/lib/db")
  const { clientAnalyticsAuditLogs, clientOptimisationProposals } = await import("@/lib/schema")
  const [updated] = await db.update(clientOptimisationProposals).set({ status: input.status, decidedBy: input.actor, decidedAt: new Date(), outcomeNotes: input.notes ?? null, updatedAt: new Date() }).where(and(eq(clientOptimisationProposals.id, input.proposalId), eq(clientOptimisationProposals.clientId, input.clientId))).returning()
  if (!updated) throw new Error("Optimisation proposal not found.")
  await db.insert(clientAnalyticsAuditLogs).values({ clientId: input.clientId, actor: input.actor, action: `optimisation_proposal_${input.status}`, message: `${input.status} optimisation proposal: ${updated.title}.`, metadataJson: { proposalId: input.proposalId, automaticWebsiteChange: false } })
  return updated
}

export async function measureOptimisationProposal(input: { clientId: number; proposalId: number; measuredValue: number; actor: string; notes?: string | null }) {
  if (isBuildPhaseWithoutDatabase()) return null
  const { db } = await import("@/lib/db")
  const { clientAnalyticsAuditLogs, clientOptimisationProposals } = await import("@/lib/schema")
  const [existing] = await db.select().from(clientOptimisationProposals).where(and(eq(clientOptimisationProposals.id, input.proposalId), eq(clientOptimisationProposals.clientId, input.clientId))).limit(1)
  if (!existing) throw new Error("Optimisation proposal not found.")
  const baseline = existing.baselineValue === null ? null : Number(existing.baselineValue)
  const improved = didProposalImproveMetric({ baselineValue: baseline, measuredValue: input.measuredValue, targetMetric: existing.targetMetric })
  const [updated] = await db.update(clientOptimisationProposals).set({ status: "measured", measuredValue: String(input.measuredValue), improved, outcomeNotes: input.notes ?? existing.outcomeNotes, measuredAt: new Date(), updatedAt: new Date() }).where(eq(clientOptimisationProposals.id, existing.id)).returning()
  await db.insert(clientAnalyticsAuditLogs).values({ clientId: input.clientId, actor: input.actor, action: "optimisation_proposal_measured", message: `Measured optimisation proposal: ${existing.title}.`, metadataJson: { proposalId: input.proposalId, targetMetric: existing.targetMetric, baselineValue: baseline, measuredValue: input.measuredValue, improved } })
  return updated
}

export async function saveClientAnalyticsConfig(input: {
  clientId: number
  provider: AnalyticsProviderId
  displayName: string
  propertyId: string | null
  consentGranted: boolean
  consentNotes: string | null
  retentionDays: number
  enabled: boolean
  credentials: Record<string, unknown> | null
  scopes: string[]
  sourceAttribution: string
  actor: string
}) {
  if (isBuildPhaseWithoutDatabase()) return null
  const { db } = await import("@/lib/db")
  const { clientAnalyticsAuditLogs, clientAnalyticsConfigs } = await import("@/lib/schema")
  const [config] = await db.insert(clientAnalyticsConfigs).values({
    clientId: input.clientId,
    provider: input.provider,
    displayName: input.displayName,
    propertyId: input.propertyId,
    consentGranted: input.consentGranted,
    consentNotes: input.consentNotes,
    retentionDays: input.retentionDays,
    enabled: input.enabled && input.consentGranted,
    credentialsEncrypted: input.credentials ? encryptAnalyticsCredentials(input.credentials) : null,
    scopes: input.scopes,
    sourceAttribution: input.sourceAttribution,
    createdBy: input.actor,
    updatedBy: input.actor,
  }).returning()
  await db.insert(clientAnalyticsAuditLogs).values({
    clientId: input.clientId,
    configId: config.id,
    actor: input.actor,
    action: "analytics_config_created",
    message: `Created ${input.provider} analytics connection for client #${input.clientId}.`,
    metadataJson: { provider: input.provider, consentGranted: input.consentGranted, enabled: input.enabled && input.consentGranted, hasCredentials: Boolean(input.credentials), scopes: input.scopes },
  })
  return config
}

export async function ingestClientAnalytics(configId: number, actor: string) {
  if (isBuildPhaseWithoutDatabase()) return { inserted: 0 }
  const { db } = await import("@/lib/db")
  const { clientAnalyticsAuditLogs, clientAnalyticsConfigs, clientAnalyticsDailyMetrics } = await import("@/lib/schema")
  const [config] = await db.select().from(clientAnalyticsConfigs).where(eq(clientAnalyticsConfigs.id, configId)).limit(1)
  if (!config) throw new Error("Analytics configuration not found.")
  if (!config.enabled || !config.consentGranted) {
    await db.insert(clientAnalyticsAuditLogs).values({ clientId: config.clientId, configId: config.id, actor, action: "analytics_ingest_skipped", message: "Analytics ingest skipped because source is disabled or consent is missing.", metadataJson: { provider: config.provider, consentGranted: config.consentGranted, enabled: config.enabled } })
    return { inserted: 0 }
  }
  const adapter = analyticsAdapterFor(config.provider)
  const to = new Date()
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - 7)
  const credentials = decryptAnalyticsCredentials(config.credentialsEncrypted)
  const metrics = await adapter.ingest({ clientId: config.clientId, configId: config.id, propertyId: config.propertyId, sourceAttribution: config.sourceAttribution, credentials, from, to })
  const minimised = metrics.map(minimisedMetric)
  for (const metric of minimised) await insertMetric(metric)
  await db.update(clientAnalyticsConfigs).set({ lastIngestedAt: new Date(), updatedBy: actor, updatedAt: new Date() }).where(eq(clientAnalyticsConfigs.id, config.id))
  await db.insert(clientAnalyticsAuditLogs).values({ clientId: config.clientId, configId: config.id, actor, action: "analytics_ingested", message: `Ingested ${minimised.length} analytics daily metric row(s).`, metadataJson: { provider: config.provider, sourceAttribution: config.sourceAttribution, inserted: minimised.length } })
  return { inserted: minimised.length }

  async function insertMetric(metric: ClientAnalyticsDailyMetric) {
    await db.insert(clientAnalyticsDailyMetrics).values({
      clientId: metric.clientId,
      configId: metric.configId ?? null,
      metricDate: new Date(metric.metricDate),
      source: metric.source,
      sourceAttribution: metric.sourceAttribution,
      sessions: metric.sessions ?? null,
      conversionEvents: metric.conversionEvents ?? null,
      formSubmissions: metric.formSubmissions ?? null,
      phoneClicks: metric.phoneClicks ?? null,
      ctaClicks: metric.ctaClicks ?? null,
      searchImpressions: metric.searchImpressions ?? null,
      searchClicks: metric.searchClicks ?? null,
      errorCount: metric.errorCount ?? null,
      uptimeChecks: metric.uptimeChecks ?? null,
      uptimeFailures: metric.uptimeFailures ?? null,
      lcpP75Ms: metric.lcpP75Ms ?? null,
      inpP75Ms: metric.inpP75Ms ?? null,
      clsP75: metric.clsP75 === undefined || metric.clsP75 === null ? null : String(metric.clsP75),
      rawSummary: metric.rawSummary ?? {},
    })
  }
}
