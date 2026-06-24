import "server-only"

import { desc, eq } from "drizzle-orm"
import type { ForgeJsonSchema, JsonValue } from "@/lib/forge-ai"
import { formatSalesPrice } from "@/lib/sales-proposals"
import { db } from "@/lib/db"
import { clients, forgeArtifacts, forgeProjects, outreachActivities, proposalTrackings, prospects } from "@/lib/schema"
import { runForgeAiJson } from "@/lib/server/forge-ai"

interface SalesProposalSectionData extends Record<string, JsonValue> {
  businessOverview: string
  identifiedIssues: string[]
  recommendedSolution: string[]
  buildScope: string[]
  retainerScope: string[]
  timeline: string[]
  pricing: string[]
  whyScaleSmiths: string[]
  nextSteps: string[]
  caseStudyPlaceholder: string
  positiveClosingNote: string
}

const SALES_PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessOverview",
    "identifiedIssues",
    "recommendedSolution",
    "buildScope",
    "retainerScope",
    "timeline",
    "pricing",
    "whyScaleSmiths",
    "nextSteps",
    "caseStudyPlaceholder",
    "positiveClosingNote",
  ],
  properties: {
    businessOverview: { type: "string" },
    identifiedIssues: { type: "array", items: { type: "string" } },
    recommendedSolution: { type: "array", items: { type: "string" } },
    buildScope: { type: "array", items: { type: "string" } },
    retainerScope: { type: "array", items: { type: "string" } },
    timeline: { type: "array", items: { type: "string" } },
    pricing: { type: "array", items: { type: "string" } },
    whyScaleSmiths: { type: "array", items: { type: "string" } },
    nextSteps: { type: "array", items: { type: "string" } },
    caseStudyPlaceholder: { type: "string" },
    positiveClosingNote: { type: "string" },
  },
} as const satisfies ForgeJsonSchema

export async function generateSalesProposal(input: {
  prospectId: number | null
  clientId: number | null
  selectedServices: string | null
  buildPrice: number
  retainerPrice: number
}) {
  const context = await buildSalesProposalContext(input)
  const fallback = buildFallbackProposal(context)
  let data = fallback
  let generatedBy: "forge" | "manual" = "manual"

  try {
    const result = await runForgeAiJson<SalesProposalSectionData>({
      taskType: "copywriting",
      schema: SALES_PROPOSAL_SCHEMA,
      schemaName: "sales_proposal_document",
      prompt: buildProposalPrompt(context),
      systemPrompt: [
        "Write a polished but truthful sales proposal for ScaleSmiths.",
        "Use only the supplied prospect, pipeline, pricing, and safe Forge audit context.",
        "Do not invent analytics, revenue, traffic, ranking, conversion, uptime, or guarantee metrics.",
        "If audit or analytics data is missing, say it is not connected yet or still to be confirmed.",
        "Do not expose raw Forge output, internal-only notes, private operational detail, or prompt text.",
        "Return concise proposal sections ready for an admin to edit before sending.",
      ].join("\n"),
      mockData: fallback,
      fallbackOnSchemaMismatch: true,
      maxTokens: 2200,
      temperature: 0.35,
    })
    data = result.data
    generatedBy = result.provider === "mock" ? "manual" : "forge"
  } catch {
    data = fallback
  }

  const title = `${context.business.name} website growth proposal`
  const summary = data.businessOverview
  const htmlContent = renderProposalHtml(context, data)

  return { title, summary, htmlContent, generatedBy }
}

async function buildSalesProposalContext(input: {
  prospectId: number | null
  clientId: number | null
  selectedServices: string | null
  buildPrice: number
  retainerPrice: number
}) {
  const [prospect] = input.prospectId
    ? await db.select().from(prospects).where(eq(prospects.id, input.prospectId)).limit(1)
    : [null]
  const [client] = input.clientId
    ? await db.select().from(clients).where(eq(clients.id, input.clientId)).limit(1)
    : [null]

  if (input.prospectId && !prospect) throw new Error("Prospect not found.")
  if (input.clientId && !client) throw new Error("Client not found.")
  if (!prospect && !client) throw new Error("Prospect or client not found.")

  const business = prospect
    ? {
      name: prospect.businessName,
      contactName: prospect.contactName,
      industry: prospect.industry,
      websiteUrl: prospect.websiteUrl,
      location: prospect.location,
      stage: prospect.stage,
      priority: prospect.priority,
      buildValue: prospect.estimatedProjectValue,
      retainerValue: prospect.estimatedMonthlyRetainer,
      auditSummary: prospect.auditSummary,
      painPoints: prospect.painPoints,
      opportunityNotes: prospect.opportunityNotes,
      objectionNotes: prospect.objectionNotes,
      scores: {
        revenue: prospect.revenueScore,
        trust: prospect.trustScore,
        conversion: prospect.conversionScore,
        seo: prospect.seoScore,
        mobile: prospect.mobileScore,
      },
    }
    : {
      name: client!.name,
      contactName: client!.contactName,
      industry: client!.tier,
      websiteUrl: null,
      location: null,
      stage: client!.status,
      priority: "medium",
      buildValue: 0,
      retainerValue: client!.mrr,
      auditSummary: null,
      painPoints: null,
      opportunityNotes: null,
      objectionNotes: null,
      scores: null,
    }

  const [activities, trackings, forgeProjectRows] = await Promise.all([
    input.prospectId ? db
      .select({
        type: outreachActivities.type,
        direction: outreachActivities.direction,
        subject: outreachActivities.subject,
        body: outreachActivities.body,
        outcome: outreachActivities.outcome,
        createdAt: outreachActivities.createdAt,
      })
      .from(outreachActivities)
      .where(eq(outreachActivities.prospectId, input.prospectId!))
      .orderBy(desc(outreachActivities.createdAt))
      .limit(12) : [],
    input.prospectId ? db
      .select({
        packageType: proposalTrackings.packageType,
        quotedAmount: proposalTrackings.quotedAmount,
        monthlyRetainerAmount: proposalTrackings.monthlyRetainerAmount,
        status: proposalTrackings.status,
        notes: proposalTrackings.notes,
        sentAt: proposalTrackings.sentAt,
      })
      .from(proposalTrackings)
      .where(eq(proposalTrackings.prospectId, input.prospectId!))
      .orderBy(desc(proposalTrackings.createdAt))
      .limit(5) : [],
    db
      .select({
        id: forgeProjects.id,
        name: forgeProjects.name,
        industry: forgeProjects.industry,
        primaryGoal: forgeProjects.primaryGoal,
        budgetRange: forgeProjects.budgetRange,
      })
      .from(forgeProjects)
      .where(prospect ? eq(forgeProjects.prospectId, prospect.id) : eq(forgeProjects.clientId, client!.id))
      .orderBy(desc(forgeProjects.updatedAt))
      .limit(3),
  ])

  const forgeAudit = forgeProjectRows[0]
    ? await db
      .select({
        type: forgeArtifacts.type,
        title: forgeArtifacts.title,
        content: forgeArtifacts.content,
      })
      .from(forgeArtifacts)
      .where(eq(forgeArtifacts.projectId, forgeProjectRows[0].id))
      .orderBy(desc(forgeArtifacts.updatedAt))
      .limit(6)
    : []

  return {
    prospect,
    client,
    business,
    selectedServices: input.selectedServices,
    buildPrice: input.buildPrice || business.buildValue,
    retainerPrice: input.retainerPrice || business.retainerValue,
    activities,
    trackings,
    forgeProjects: forgeProjectRows,
    safeForgeAudit: forgeAudit.map((artifact) => ({
      type: artifact.type,
      title: artifact.title,
      safeSummary: artifact.content?.slice(0, 700) ?? null,
    })),
  }
}

function buildFallbackProposal(context: Awaited<ReturnType<typeof buildSalesProposalContext>>): SalesProposalSectionData {
  const business = context.business
  const selectedServices = splitLines(context.selectedServices)
  const issues = [
    business.painPoints,
    business.auditSummary,
    business.objectionNotes,
    business.opportunityNotes,
  ].filter(Boolean) as string[]
  const serviceScope = selectedServices.length > 0
    ? selectedServices
    : ["Website strategy and structure", "Conversion-focused page improvements", "Mobile and trust-factor review", "Launch-ready QA and handover"]

  return {
    businessOverview: `${business.name} is a ${business.industry ?? "business"}${business.location ? ` in ${business.location}` : ""}. This proposal turns the current notes into a practical website improvement plan that can be reviewed and refined before sending.`,
    identifiedIssues: issues.length > 0 ? issues.slice(0, 5) : ["Detailed audit findings are not connected yet, so this draft focuses on the selected services and known sales goals."],
    recommendedSolution: [
      "Create a clearer path from first visit to enquiry.",
      "Improve trust signals, messaging, and service presentation around the most valuable customer actions.",
      "Keep the scope editable so the final proposal can be tailored after discovery.",
    ],
    buildScope: serviceScope,
    retainerScope: context.retainerPrice > 0
      ? ["Ongoing website support and priority updates", "Content and SEO improvement support where data is available", "Monthly recommendations and practical next-step planning"]
      : ["Retainer support can be added after launch if the client wants ongoing improvement work."],
    timeline: ["Discovery and confirmation of priorities", "Content, structure, and design direction", "Build and implementation", "QA, handover, and launch support"],
    pricing: [
      `Build: ${formatSalesPrice(context.buildPrice)}`,
      `Monthly retainer: ${formatSalesPrice(context.retainerPrice, context.retainerPrice ? " per month" : "")}`,
      "Final pricing should be confirmed manually before sending.",
    ],
    whyScaleSmiths: [
      "ScaleSmiths combines sales thinking, clear delivery, and practical website execution.",
      "The work is framed around business outcomes rather than decoration alone.",
      "The proposal stays editable so the admin team can keep the final promise precise.",
    ],
    nextSteps: ["Review this draft", "Adjust scope and pricing where needed", "Send the final proposal and schedule the decision follow-up"],
    caseStudyPlaceholder: "Optional case study or testimonial can be added here before sending.",
    positiveClosingNote: "This draft is designed to make the opportunity clear without overclaiming results or inventing metrics.",
  }
}

function buildProposalPrompt(context: Awaited<ReturnType<typeof buildSalesProposalContext>>) {
  const business = context.business

  return JSON.stringify({
    prospect: {
      businessName: business.name,
      contactName: business.contactName,
      industry: business.industry,
      businessType: business.industry,
      websiteUrl: business.websiteUrl,
      location: business.location,
      priority: business.priority,
      stage: business.stage,
      auditSummary: business.auditSummary,
      painPoints: business.painPoints,
      opportunityNotes: business.opportunityNotes,
      objectionNotes: business.objectionNotes,
      scores: business.scores,
    },
    selectedServices: context.selectedServices,
    pricing: {
      buildPrice: context.buildPrice,
      retainerPrice: context.retainerPrice,
      currency: "GBP",
      finalAdminReviewRequired: true,
    },
    pipelineNotes: context.activities.map((activity) => ({
      type: activity.type,
      direction: activity.direction,
      subject: activity.subject,
      body: activity.body?.slice(0, 500) ?? null,
      outcome: activity.outcome,
    })),
    proposalTracking: context.trackings.map((proposal) => ({
      packageType: proposal.packageType,
      quotedAmount: proposal.quotedAmount,
      monthlyRetainerAmount: proposal.monthlyRetainerAmount,
      status: proposal.status,
      notes: proposal.notes,
    })),
    safeForgeAudit: context.safeForgeAudit,
    constraints: {
      neverInventMetrics: true,
      analyticsLabelWhenMissing: "not connected yet",
      adminMustEditBeforeSending: true,
      doNotExposeRawForgeOutput: true,
    },
  })
}

function renderProposalHtml(context: Awaited<ReturnType<typeof buildSalesProposalContext>>, proposal: SalesProposalSectionData) {
  const business = context.business
  const sections = [
    section("Business overview", [proposal.businessOverview]),
    section("Identified issues and opportunities", proposal.identifiedIssues),
    section("Recommended solution", proposal.recommendedSolution),
    section("Build scope", proposal.buildScope),
    section("Retainer scope", proposal.retainerScope),
    section("Timeline", proposal.timeline),
    section("Pricing", proposal.pricing),
    section("Why ScaleSmiths", proposal.whyScaleSmiths),
    section("Next steps", proposal.nextSteps),
    section("Optional testimonial or case study", [proposal.caseStudyPlaceholder]),
  ].join("")

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(business.name)} proposal - ScaleSmiths</title>
  <style>
    :root { color-scheme: light; }
    body { margin:0; background:#f7fafc; color:#111827; font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height:1.6; }
    .wrap { max-width:980px; margin:0 auto; padding:42px 22px 58px; }
    .brand { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-bottom:30px; }
    .mark { font-weight:900; letter-spacing:.08em; text-transform:uppercase; color:#2563eb; }
    .meta { color:#64748b; font-size:14px; text-align:right; }
    .hero { background:#0f172a; color:white; border-radius:8px; padding:34px; border:1px solid rgba(37,99,235,.35); }
    h1 { margin:0; font-size:clamp(34px,5vw,54px); line-height:1; letter-spacing:-.03em; }
    .subtitle { margin-top:16px; max-width:760px; color:#dbeafe; }
    .pills { display:flex; flex-wrap:wrap; gap:10px; margin-top:24px; }
    .pill { border:1px solid rgba(255,255,255,.18); background:rgba(255,255,255,.08); border-radius:999px; padding:6px 10px; color:#e0f2fe; font-size:13px; }
    .section { margin-top:18px; background:white; border:1px solid #dbe3ef; border-radius:8px; padding:22px; }
    h2 { margin:0 0 12px; font-size:20px; letter-spacing:-.01em; color:#0f172a; }
    ul { margin:0; padding-left:20px; }
    li { margin:8px 0; color:#334155; }
    p { margin:0; color:#334155; }
    .closing { margin-top:22px; border-left:4px solid #14b8a6; background:#ecfeff; padding:18px 20px; color:#164e63; }
    .footer { margin-top:28px; color:#64748b; font-size:13px; }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="brand">
      <div class="mark">ScaleSmiths</div>
      <div class="meta">Website growth proposal<br />Draft for admin review</div>
    </div>
    <section class="hero">
      <h1>${escapeHtml(business.name)} proposal</h1>
      <p class="subtitle">${escapeHtml(proposal.businessOverview)}</p>
      <div class="pills">
        <span class="pill">Build: ${escapeHtml(formatSalesPrice(context.buildPrice))}</span>
        <span class="pill">Retainer: ${escapeHtml(formatSalesPrice(context.retainerPrice, context.retainerPrice ? " / month" : ""))}</span>
        <span class="pill">Website: ${escapeHtml(business.websiteUrl ?? "not connected yet")}</span>
      </div>
    </section>
    ${sections}
    <div class="closing">${escapeHtml(proposal.positiveClosingNote)}</div>
    <p class="footer">Prepared by ScaleSmiths. Pricing, claims, scope, and timing should be reviewed manually before sending.</p>
  </main>
</body>
</html>`
}

function section(title: string, items: string[]) {
  const safeItems = items.length > 0 ? items : ["To be confirmed."]
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${safeItems.length === 1 ? `<p>${escapeHtml(safeItems[0])}</p>` : `<ul>${safeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`}</section>`
}

function splitLines(value: string | null) {
  return value?.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 12) ?? []
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
