import type { ClientAnalyticsDailyMetric, ClientAnalyticsSummary } from "./client-analytics"

export type WebsiteOutcomeSeverity = "positive" | "watch" | "concern" | "unknown"
export type WebsiteOutcomeConfidence = "high" | "medium" | "low"

export interface WebsiteOutcomeEvidence {
  label: string
  href: string
  recordType: string
  recordId: string
  metric?: string
  value?: string
  sourceAttribution: string
}

export interface WebsiteOutcomeFinding {
  category:
    | "conversion_strategy"
    | "actual_conversions"
    | "high_traffic_low_conversion"
    | "cta_performance"
    | "search_visibility"
    | "device_performance"
    | "core_web_vitals"
    | "form_completion"
    | "lead_quality"
    | "before_after"
    | "data_quality"
  severity: WebsiteOutcomeSeverity
  conclusion: string
  reasoning: string[]
  evidence: WebsiteOutcomeEvidence[]
  confidence: WebsiteOutcomeConfidence
  causationClaimed: false
}

export interface WebsiteOutcomeEvaluation {
  generatedAt: string
  clientId: number
  intendedConversionStrategy: string | null
  strongEvidence: WebsiteOutcomeFinding[]
  weakSignals: WebsiteOutcomeFinding[]
  hypotheses: WebsiteOutcomeFinding[]
  recommendedInvestigations: WebsiteOutcomeFinding[]
  suggestedImprovements: WebsiteOutcomeFinding[]
  requiredClientDecisions: WebsiteOutcomeFinding[]
  incompleteOrBiasedData: WebsiteOutcomeFinding[]
  overallConfidence: WebsiteOutcomeConfidence
}

export interface WebsiteOutcomeInput {
  clientId: number
  clientName: string
  intendedConversionStrategy: string | null
  analytics: ClientAnalyticsSummary
  metrics: ClientAnalyticsDailyMetric[]
  leadQuality?: { won: number; lost: number; noDecision: number; averageValue: number | null } | null
  launchedAt?: string | null
  generatedAt?: string
}

export function evaluateWebsiteOutcome(input: WebsiteOutcomeInput): WebsiteOutcomeEvaluation {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const findings: WebsiteOutcomeFinding[] = []
  const totals = input.analytics.totals
  const conversionRate = totals.sessions && totals.conversionEvents !== null ? totals.conversionEvents / totals.sessions : null
  const formRate = totals.sessions && totals.formSubmissions !== null ? totals.formSubmissions / totals.sessions : null
  const searchCtr = totals.searchImpressions && totals.searchClicks !== null ? totals.searchClicks / totals.searchImpressions : null

  add(findings, {
    category: "conversion_strategy",
    severity: input.intendedConversionStrategy ? "watch" : "unknown",
    conclusion: input.intendedConversionStrategy
      ? `The stated conversion strategy is: ${input.intendedConversionStrategy}`
      : "No approved intended conversion strategy was found for this client.",
    reasoning: input.intendedConversionStrategy ? ["Evaluation is framed against the approved project/client goal."] : ["A clear goal is required before outcome performance can be judged fairly."],
    evidence: input.intendedConversionStrategy ? [evidence("Conversion strategy", `/clients/${input.clientId}/analytics`, "client_goal", String(input.clientId), input.intendedConversionStrategy, "Approved admin project/client record")] : [],
    confidence: input.intendedConversionStrategy ? "high" : "low",
  })

  if (conversionRate !== null) {
    add(findings, {
      category: "actual_conversions",
      severity: conversionRate >= 0.03 ? "positive" : conversionRate < 0.01 ? "concern" : "watch",
      conclusion: `${totals.conversionEvents} conversion event(s) from ${totals.sessions} session(s).`,
      reasoning: [`Observed conversion rate is ${(conversionRate * 100).toFixed(1)}%.`, "This is correlation from post-launch aggregate data, not proof that the website caused the result."],
      evidence: metricEvidence(input, "conversionEvents", String(totals.conversionEvents), "Conversion events"),
      confidence: (totals.sessions ?? 0) >= 100 ? "medium" : "low",
    })
  }

  if (formRate !== null) {
    add(findings, {
      category: "form_completion",
      severity: formRate >= 0.02 ? "positive" : formRate < 0.005 ? "concern" : "watch",
      conclusion: `${totals.formSubmissions} form submission(s) recorded.`,
      reasoning: [`Form submission rate is ${(formRate * 100).toFixed(1)}% of sessions.`, "Phone and offline leads may make this incomplete."],
      evidence: metricEvidence(input, "formSubmissions", String(totals.formSubmissions), "Form submissions"),
      confidence: (totals.sessions ?? 0) >= 100 ? "medium" : "low",
    })
  }

  if (searchCtr !== null) {
    add(findings, {
      category: "search_visibility",
      severity: totals.searchImpressions && totals.searchImpressions > 0 ? "watch" : "unknown",
      conclusion: `${totals.searchClicks} search click(s) from ${totals.searchImpressions} impression(s).`,
      reasoning: [`Search click-through rate is ${(searchCtr * 100).toFixed(1)}%.`, "Search visibility should be interpreted with query/page evidence before deciding content changes."],
      evidence: metricEvidence(input, "searchClicks", String(totals.searchClicks), "Search clicks"),
      confidence: (totals.searchImpressions ?? 0) >= 100 ? "medium" : "low",
    })
  }

  if (totals.lcpP75Ms !== null || totals.inpP75Ms !== null || totals.clsP75 !== null) {
    const poor = (totals.lcpP75Ms !== null && totals.lcpP75Ms > 2500) || (totals.inpP75Ms !== null && totals.inpP75Ms > 200) || (totals.clsP75 !== null && totals.clsP75 > 0.1)
    add(findings, {
      category: "core_web_vitals",
      severity: poor ? "concern" : "positive",
      conclusion: `Core Web Vitals snapshot: LCP ${totals.lcpP75Ms ?? "missing"}ms, INP ${totals.inpP75Ms ?? "missing"}ms, CLS ${totals.clsP75 ?? "missing"}.`,
      reasoning: [poor ? "At least one p75 Core Web Vital is outside common good-threshold guidance." : "Recorded Core Web Vitals are within common good-threshold guidance.", "This does not isolate which page, device or third-party script caused the result."],
      evidence: metricEvidence(input, "coreWebVitals", `${totals.lcpP75Ms ?? "—"} / ${totals.inpP75Ms ?? "—"} / ${totals.clsP75 ?? "—"}`, "Core Web Vitals"),
      confidence: "medium",
    })
  }

  if (input.leadQuality && input.leadQuality.won + input.leadQuality.lost + input.leadQuality.noDecision > 0) {
    add(findings, {
      category: "lead_quality",
      severity: input.leadQuality.won > input.leadQuality.lost ? "positive" : "watch",
      conclusion: `${input.leadQuality.won} won, ${input.leadQuality.lost} lost, ${input.leadQuality.noDecision} undecided recorded lead outcome(s).`,
      reasoning: ["Lead quality is based on recorded admin outcomes, not inferred visitor identity.", input.leadQuality.averageValue ? `Average recorded won value: GBP ${input.leadQuality.averageValue.toLocaleString("en-GB")}.` : "No average won value is available."],
      evidence: [evidence("Lead outcomes", "/prospects", "lead_score_outcomes", String(input.clientId), `${input.leadQuality.won}/${input.leadQuality.lost}/${input.leadQuality.noDecision}`, "Admin lead outcome records")],
      confidence: input.leadQuality.won + input.leadQuality.lost >= 5 ? "medium" : "low",
    })
  }

  addDataQualityFindings(findings, input)
  addHypotheses(findings, input, conversionRate, searchCtr)

  return {
    generatedAt,
    clientId: input.clientId,
    intendedConversionStrategy: input.intendedConversionStrategy,
    strongEvidence: findings.filter((finding) => finding.confidence !== "low" && (finding.severity === "positive" || finding.category === "actual_conversions")),
    weakSignals: findings.filter((finding) => finding.confidence === "low" && finding.severity !== "unknown"),
    hypotheses: findings.filter((finding) => finding.category === "high_traffic_low_conversion" || finding.category === "cta_performance"),
    recommendedInvestigations: findings.filter((finding) => finding.category === "data_quality" || finding.severity === "concern"),
    suggestedImprovements: findings.filter((finding) => ["core_web_vitals", "form_completion", "search_visibility"].includes(finding.category) && finding.severity === "concern"),
    requiredClientDecisions: findings.filter((finding) => finding.category === "conversion_strategy" && finding.severity === "unknown"),
    incompleteOrBiasedData: findings.filter((finding) => finding.category === "data_quality" || finding.severity === "unknown"),
    overallConfidence: overallConfidence(findings),
  }
}

function addDataQualityFindings(findings: WebsiteOutcomeFinding[], input: WebsiteOutcomeInput) {
  for (const missing of input.analytics.missingData) add(findings, {
    category: "data_quality",
    severity: "unknown",
    conclusion: missing,
    reasoning: ["Outcome evaluation is incomplete until this source is connected or explicitly ruled out."],
    evidence: [],
    confidence: "high",
  })
  add(findings, {
    category: "high_traffic_low_conversion",
    severity: "unknown",
    conclusion: "High-traffic, low-conversion page analysis is unavailable from current aggregate-only data.",
    reasoning: ["The current privacy-conscious analytics rollup does not store page-level conversion dimensions.", "Connect a reviewed page-level aggregate source before naming pages."],
    evidence: [],
    confidence: "high",
  })
  add(findings, {
    category: "device_performance",
    severity: "unknown",
    conclusion: "Mobile versus desktop performance cannot be compared from current aggregate-only data.",
    reasoning: ["No device-level Core Web Vitals or conversion split is stored.", "Do not infer device performance from overall totals."],
    evidence: [],
    confidence: "high",
  })
  add(findings, {
    category: "before_after",
    severity: "unknown",
    conclusion: "Before-and-after launch performance is unavailable unless pre-launch baseline metrics are connected.",
    reasoning: ["Current data is post-launch aggregate evidence only.", "No causal uplift claim should be made without comparable baseline windows."],
    evidence: [],
    confidence: "high",
  })
}

function addHypotheses(findings: WebsiteOutcomeFinding[], input: WebsiteOutcomeInput, conversionRate: number | null, searchCtr: number | null) {
  if (conversionRate !== null && conversionRate < 0.01) add(findings, {
    category: "cta_performance",
    severity: "concern",
    conclusion: "CTA or offer clarity may be underperforming, but this is a hypothesis.",
    reasoning: ["Conversion rate is below 1%.", "CTA click and form source coverage may be incomplete, so this cannot be treated as proven."],
    evidence: metricEvidence(input, "conversionRate", `${(conversionRate * 100).toFixed(1)}%`, "Conversion rate"),
    confidence: "low",
  })
  if (searchCtr !== null && searchCtr < 0.01) add(findings, {
    category: "search_visibility",
    severity: "concern",
    conclusion: "Search snippets or query-page fit may need investigation.",
    reasoning: ["Search CTR is below 1%.", "Query and page breakdowns are required before rewriting content."],
    evidence: metricEvidence(input, "searchCtr", `${(searchCtr * 100).toFixed(1)}%`, "Search CTR"),
    confidence: "low",
  })
}

function add(findings: WebsiteOutcomeFinding[], input: Omit<WebsiteOutcomeFinding, "causationClaimed">) {
  findings.push({ ...input, causationClaimed: false })
}

function evidence(label: string, href: string, recordType: string, recordId: string, value: string, sourceAttribution: string): WebsiteOutcomeEvidence {
  return { label, href, recordType, recordId, value, sourceAttribution }
}

function metricEvidence(input: WebsiteOutcomeInput, metric: string, value: string, label: string): WebsiteOutcomeEvidence[] {
  const matching = input.metrics.filter((row) => row[metric as keyof ClientAnalyticsDailyMetric] !== undefined || metric === "conversionRate" || metric === "searchCtr" || metric === "coreWebVitals")
  const rows = matching.length ? matching : input.metrics
  return rows.slice(0, 3).map((row, index) => ({
    label,
    href: `/clients/${input.clientId}/analytics`,
    recordType: "client_analytics_daily_metric",
    recordId: `${row.clientId}:${row.configId ?? "none"}:${row.metricDate}:${index}`,
    metric,
    value,
    sourceAttribution: row.sourceAttribution,
  }))
}

function overallConfidence(findings: WebsiteOutcomeFinding[]): WebsiteOutcomeConfidence {
  if (findings.some((finding) => finding.category === "data_quality")) return "low"
  if (findings.filter((finding) => finding.confidence === "high").length >= 3) return "high"
  return "medium"
}
