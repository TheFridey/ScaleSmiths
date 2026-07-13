import { STAGE_WIN_PROBABILITY, type OutreachDirection, type ProposalStatus, type ProspectPriority, type ProspectSource, type ProspectStage } from "./prospects"

export type LeadScoreFactorCategory =
  | "business_type"
  | "existing_website_quality"
  | "apparent_urgency"
  | "budget_evidence"
  | "decision_maker_access"
  | "referral_source"
  | "engagement"
  | "required_scope"
  | "strategic_fit"
  | "retainer_potential"
  | "estimated_delivery_effort"
  | "probability_of_closing"

export type LeadScoreFactorPolarity = "positive" | "negative" | "neutral"
export type LeadScoreConfidence = "low" | "medium" | "high"
export type LeadScoreOutcome = "won" | "lost" | "no_decision" | "disqualified"

export interface LeadScoreProspectInput {
  id?: number
  businessName: string
  industry?: string | null
  source: ProspectSource
  stage: ProspectStage
  priority: ProspectPriority
  websiteUrl?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  estimatedProjectValue: number
  estimatedMonthlyRetainer: number
  revenueScore: number
  trustScore: number
  conversionScore: number
  seoScore: number
  mobileScore: number
  auditSummary?: string | null
  painPoints?: string | null
  opportunityNotes?: string | null
  objectionNotes?: string | null
  nextFollowUpAt?: Date | string | null
  lastContactedAt?: Date | string | null
  discoveryCallAt?: Date | string | null
  proposalSentAt?: Date | string | null
  lostReason?: string | null
}

export interface LeadScoreActivityInput {
  direction: OutreachDirection
  type: string
  subject?: string | null
  body?: string | null
  outcome?: string | null
  createdAt?: Date | string | null
}

export interface LeadScoreProposalInput {
  status: ProposalStatus
  quotedAmount: number
  monthlyRetainerAmount: number
  sentAt?: Date | string | null
  acceptedAt?: Date | string | null
  rejectedAt?: Date | string | null
}

export interface LeadScoreFactor {
  category: LeadScoreFactorCategory
  label: string
  polarity: LeadScoreFactorPolarity
  points: number
  confidence: LeadScoreConfidence
  evidence: string[]
  sourceFields: string[]
  uncertain: boolean
}

export interface LeadScoreResult {
  score: number
  confidence: LeadScoreConfidence
  confidenceScore: number
  positiveFactors: LeadScoreFactor[]
  negativeFactors: LeadScoreFactor[]
  neutralFactors: LeadScoreFactor[]
  missingInformation: string[]
  recommendedNextAction: string
  estimatedProjectValue: number
  estimatedRetainerPotential: number
  probabilityOfClosing: number
  affectedData: Array<{ field: string; value: string | number | boolean | null; note: string }>
  modelVersion: string
  protectedCharacteristicsExcluded: true
}

export interface LeadScoreInputs {
  prospect: LeadScoreProspectInput
  activities?: LeadScoreActivityInput[]
  proposals?: LeadScoreProposalInput[]
  now?: Date
}

const MODEL_VERSION = "deterministic-lead-score-v1"
const HIGH_FIT_INDUSTRIES = /\b(?:home\s*service|trade|plaster|electric|roof|clinic|health|legal|account|professional|ecommerce|e-commerce|motorsport|technology|charity|nonprofit|veteran)\b/i
const URGENCY_TERMS = /\b(?:urgent|asap|quick|soon|immediately|deadline|launch|broken|not working|losing leads|need enquiries|this month)\b/i
const RETAINER_TERMS = /\b(?:seo|maintenance|care plan|support|content|ads|monthly|retainer|hosting|analytics|conversion)\b/i
const SCOPE_TERMS = /\b(?:new website|rebuild|redesign|seo|booking|ecommerce|e-commerce|portal|automation|migration|copy|brand|crm)\b/i

export function scoreLead({ prospect, activities = [], proposals = [], now = new Date() }: LeadScoreInputs): LeadScoreResult {
  const factors: LeadScoreFactor[] = []
  const missing = new Set<string>()
  const affectedData: LeadScoreResult["affectedData"] = []
  const notes = textBlob(prospect)
  const latestActivityAt = maxDate(activities.map((activity) => activity.createdAt))
  const inboundCount = activities.filter((activity) => activity.direction === "inbound").length
  const outboundCount = activities.filter((activity) => activity.direction === "outbound").length
  const proposal = proposals.find((item) => item.status === "accepted") ?? proposals.find((item) => item.status === "sent" || item.status === "viewed" || item.status === "follow_up_due") ?? proposals[0]

  addBusinessType(factors, missing, prospect)
  addWebsiteQuality(factors, missing, prospect)
  addUrgency(factors, missing, prospect, notes, now)
  addBudget(factors, missing, prospect, proposal)
  addDecisionMaker(factors, missing, prospect, activities)
  addSource(factors, prospect.source)
  addEngagement(factors, missing, { inboundCount, outboundCount, latestActivityAt, now, stage: prospect.stage })
  addScope(factors, missing, prospect, notes)
  addStrategicFit(factors, missing, prospect, notes)
  addRetainer(factors, missing, prospect, notes)
  addEffort(factors, prospect)
  addClosingProbability(factors, prospect.stage)

  addAffected(affectedData, "industry", prospect.industry ?? null, "Used only as business category and strategic-fit evidence.")
  addAffected(affectedData, "source", prospect.source, "Referral and inbound sources increase confidence; cold sources are weaker.")
  addAffected(affectedData, "stage", prospect.stage, "Used for probability-of-closing and engagement context.")
  addAffected(affectedData, "priority", prospect.priority, "Used as a human-entered urgency/fit signal.")
  addAffected(affectedData, "websiteUrl", Boolean(prospect.websiteUrl), "Presence is used only to identify whether existing-site quality can be audited.")
  addAffected(affectedData, "estimatedProjectValue", prospect.estimatedProjectValue, "Used as budget evidence and value estimate.")
  addAffected(affectedData, "estimatedMonthlyRetainer", prospect.estimatedMonthlyRetainer, "Used as retainer potential.")
  addAffected(affectedData, "auditScores", auditAverage(prospect), "Revenue/trust/conversion/SEO/mobile scores are used as existing website quality evidence.")
  addAffected(affectedData, "activityCounts", `${inboundCount} inbound / ${outboundCount} outbound`, "Used as engagement evidence.")

  const rawScore = 42 + factors.reduce((sum, factor) => sum + factor.points, 0)
  const score = clamp(Math.round(rawScore), 0, 100)
  const evidenceFields = new Set(factors.filter((factor) => !factor.uncertain).flatMap((factor) => factor.sourceFields).filter((field) => !field.startsWith("missing.")))
  const confidenceScore = clamp(Math.round((evidenceFields.size / 16) * 100 - uncertainPenalty(factors)), 0, 100)
  const confidence = confidenceScore >= 72 ? "high" : confidenceScore >= 42 ? "medium" : "low"
  const probabilityOfClosing = clamp(Math.round(((STAGE_WIN_PROBABILITY[prospect.stage] ?? 0) * 100 + score) / 2), 0, 100)
  const estimatedProjectValue = proposal?.quotedAmount && proposal.quotedAmount > 0 ? proposal.quotedAmount : prospect.estimatedProjectValue
  const estimatedRetainerPotential = proposal?.monthlyRetainerAmount && proposal.monthlyRetainerAmount > 0 ? proposal.monthlyRetainerAmount : prospect.estimatedMonthlyRetainer

  return {
    score,
    confidence,
    confidenceScore,
    positiveFactors: factors.filter((factor) => factor.polarity === "positive"),
    negativeFactors: factors.filter((factor) => factor.polarity === "negative"),
    neutralFactors: factors.filter((factor) => factor.polarity === "neutral"),
    missingInformation: Array.from(missing),
    recommendedNextAction: recommendNextAction({ score, confidence, prospect, missing: Array.from(missing), inboundCount, proposals }),
    estimatedProjectValue,
    estimatedRetainerPotential,
    probabilityOfClosing,
    affectedData,
    modelVersion: MODEL_VERSION,
    protectedCharacteristicsExcluded: true,
  }
}

function addBusinessType(factors: LeadScoreFactor[], missing: Set<string>, prospect: LeadScoreProspectInput) {
  if (!prospect.industry) {
    missing.add("Business type or industry.")
    factors.push(factor("business_type", "Business type is not recorded", "neutral", 0, "low", ["No industry field was supplied."], ["missing.industry"], true))
    return
  }
  const fit = HIGH_FIT_INDUSTRIES.test(prospect.industry)
  factors.push(factor("business_type", fit ? "Business type matches known ScaleSmiths fit" : "Business type has no proven fit signal", fit ? "positive" : "neutral", fit ? 5 : 0, fit ? "medium" : "low", [`Industry: ${prospect.industry}`], ["industry"], !fit))
}

function addWebsiteQuality(factors: LeadScoreFactor[], missing: Set<string>, prospect: LeadScoreProspectInput) {
  const avg = auditAverage(prospect)
  if (!prospect.websiteUrl) missing.add("Existing website URL.")
  if (avg === 0) {
    missing.add("Website audit scores.")
    factors.push(factor("existing_website_quality", "Existing-site quality has not been audited", "neutral", 0, "low", ["Audit score fields are all zero."], ["missing.auditScores"], true))
    return
  }
  const points = avg <= 4 ? 9 : avg <= 6 ? 5 : avg <= 8 ? -2 : -5
  factors.push(factor("existing_website_quality", points > 0 ? "Website audit indicates clear improvement opportunity" : "Website audit suggests lower visible improvement gap", points > 0 ? "positive" : "negative", points, "high", [`Average audit score: ${avg}/10. Lower scores mean more room for improvement.`], ["revenueScore", "trustScore", "conversionScore", "seoScore", "mobileScore"], false))
}

function addUrgency(factors: LeadScoreFactor[], missing: Set<string>, prospect: LeadScoreProspectInput, notes: string, now: Date) {
  const followUp = toDate(prospect.nextFollowUpAt)
  const urgentText = URGENCY_TERMS.test(notes)
  if (!urgentText && !followUp && prospect.priority === "medium") missing.add("Apparent urgency or deadline.")
  const overdue = Boolean(followUp && followUp < now && prospect.stage !== "won" && prospect.stage !== "lost")
  const priorityPoints = prospect.priority === "high" ? 5 : prospect.priority === "low" ? -2 : 0
  const points = priorityPoints + (urgentText ? 4 : 0) + (overdue ? 2 : 0)
  factors.push(factor("apparent_urgency", points > 0 ? "Urgency signal exists" : prospect.priority === "low" ? "Low priority lowers urgency" : "Urgency is unclear", points > 0 ? "positive" : prospect.priority === "low" ? "negative" : "neutral", points, urgentText || followUp || prospect.priority !== "medium" ? "medium" : "low", [
    `Priority: ${prospect.priority}.`,
    urgentText ? "Notes mention urgency or a deadline." : "No urgency language found in notes.",
    followUp ? `Next follow-up: ${followUp.toISOString()}.` : "No follow-up date set.",
  ], ["priority", "auditSummary", "painPoints", "opportunityNotes", "nextFollowUpAt"], points === 0))
}

function addBudget(factors: LeadScoreFactor[], missing: Set<string>, prospect: LeadScoreProspectInput, proposal?: LeadScoreProposalInput) {
  const value = proposal?.quotedAmount && proposal.quotedAmount > 0 ? proposal.quotedAmount : prospect.estimatedProjectValue
  if (value <= 0) {
    missing.add("Budget or estimated project value.")
    factors.push(factor("budget_evidence", "Budget evidence is missing", "neutral", 0, "low", ["No estimated project value or quoted amount is recorded."], ["missing.estimatedProjectValue"], true))
    return
  }
  const points = value >= 10000 ? 9 : value >= 5000 ? 6 : value >= 2500 ? 3 : -2
  factors.push(factor("budget_evidence", "Budget/value evidence is recorded", points >= 0 ? "positive" : "negative", points, proposal ? "high" : "medium", [`Estimated or quoted project value: GBP ${value}.`], proposal ? ["proposal.quotedAmount"] : ["estimatedProjectValue"], false))
}

function addDecisionMaker(factors: LeadScoreFactor[], missing: Set<string>, prospect: LeadScoreProspectInput, activities: LeadScoreActivityInput[]) {
  const hasContact = Boolean(prospect.contactName && (prospect.contactEmail || prospect.contactPhone))
  const directReply = activities.some((activity) => activity.direction === "inbound")
  if (!hasContact) missing.add("Decision-maker contact details.")
  const points = hasContact ? 5 + (directReply ? 4 : 0) : -4
  factors.push(factor("decision_maker_access", hasContact ? "Named contact route exists" : "No named decision-maker route", hasContact ? "positive" : "negative", points, directReply ? "high" : hasContact ? "medium" : "low", [
    hasContact ? "Contact name and at least one contact method are recorded." : "Missing contact name plus email/phone.",
    directReply ? "Inbound activity suggests direct access." : "No inbound response recorded.",
  ], ["contactName", "contactEmail", "contactPhone", "outreachActivities.direction"], !directReply))
}

function addSource(factors: LeadScoreFactor[], source: ProspectSource) {
  const pointsBySource: Record<ProspectSource, number> = { referral: 8, inbound: 7, local: 4, linkedin: 1, email: 0, facebook: 0, other: -1 }
  const points = pointsBySource[source] ?? 0
  factors.push(factor("referral_source", source === "referral" || source === "inbound" ? "Source has strong intent signal" : "Source has limited intent signal", points >= 0 ? "positive" : "negative", points, source === "other" ? "low" : "medium", [`Source: ${source}.`], ["source"], source === "other"))
}

function addEngagement(factors: LeadScoreFactor[], missing: Set<string>, input: { inboundCount: number; outboundCount: number; latestActivityAt: Date | null; now: Date; stage: ProspectStage }) {
  if (input.inboundCount + input.outboundCount === 0) missing.add("Engagement or outreach history.")
  const daysSinceActivity = input.latestActivityAt ? Math.round((input.now.getTime() - input.latestActivityAt.getTime()) / 86_400_000) : null
  const stalePenalty = daysSinceActivity !== null && daysSinceActivity > 30 && input.stage !== "won" && input.stage !== "lost" ? -4 : 0
  const points = Math.min(12, input.inboundCount * 5 + input.outboundCount * 1) + stalePenalty
  factors.push(factor("engagement", input.inboundCount > 0 ? "Lead has replied or engaged" : input.outboundCount > 0 ? "Outreach exists but reply is not recorded" : "No engagement recorded", points > 0 ? "positive" : stalePenalty < 0 ? "negative" : "neutral", points, input.inboundCount > 0 ? "high" : input.outboundCount > 0 ? "medium" : "low", [
    `${input.inboundCount} inbound and ${input.outboundCount} outbound activities recorded.`,
    daysSinceActivity === null ? "No activity date available." : `Latest activity was ${daysSinceActivity} day(s) ago.`,
  ], ["outreachActivities.direction", "outreachActivities.createdAt"], input.inboundCount === 0))
}

function addScope(factors: LeadScoreFactor[], missing: Set<string>, prospect: LeadScoreProspectInput, notes: string) {
  const scopeEvidence = SCOPE_TERMS.test(notes)
  if (!scopeEvidence && prospect.estimatedProjectValue === 0) missing.add("Required project scope.")
  const points = scopeEvidence ? 5 : prospect.estimatedProjectValue > 0 ? 2 : 0
  factors.push(factor("required_scope", scopeEvidence ? "Required scope is described" : "Scope is not clearly described", points > 0 ? "positive" : "neutral", points, scopeEvidence ? "medium" : "low", [scopeEvidence ? "Notes include concrete website/service scope terms." : "No concrete scope terms found in notes."], ["auditSummary", "painPoints", "opportunityNotes", "estimatedProjectValue"], !scopeEvidence))
}

function addStrategicFit(factors: LeadScoreFactor[], missing: Set<string>, prospect: LeadScoreProspectInput, notes: string) {
  const hasCommercialEvidence = Boolean(prospect.estimatedProjectValue > 0 || prospect.estimatedMonthlyRetainer > 0 || RETAINER_TERMS.test(notes))
  if (!prospect.industry || !hasCommercialEvidence) missing.add("Strategic-fit evidence.")
  const industryFit = prospect.industry ? HIGH_FIT_INDUSTRIES.test(prospect.industry) : false
  const points = (industryFit ? 4 : 0) + (hasCommercialEvidence ? 3 : 0)
  factors.push(factor("strategic_fit", points >= 5 ? "Commercial and industry fit look plausible" : "Strategic fit is under-evidenced", points > 0 ? "positive" : "neutral", points, points >= 5 ? "medium" : "low", [
    prospect.industry ? `Industry: ${prospect.industry}.` : "No industry recorded.",
    hasCommercialEvidence ? "Commercial value or retainer signal exists." : "No commercial fit evidence recorded.",
  ], ["industry", "estimatedProjectValue", "estimatedMonthlyRetainer", "opportunityNotes"], points < 5))
}

function addRetainer(factors: LeadScoreFactor[], missing: Set<string>, prospect: LeadScoreProspectInput, notes: string) {
  const hasRetainerText = RETAINER_TERMS.test(notes)
  if (prospect.estimatedMonthlyRetainer <= 0 && !hasRetainerText) missing.add("Retainer potential.")
  const points = prospect.estimatedMonthlyRetainer >= 750 ? 8 : prospect.estimatedMonthlyRetainer > 0 ? 5 : hasRetainerText ? 3 : 0
  factors.push(factor("retainer_potential", points > 0 ? "Retainer potential is evidenced" : "Retainer potential is unknown", points > 0 ? "positive" : "neutral", points, prospect.estimatedMonthlyRetainer > 0 ? "high" : hasRetainerText ? "medium" : "low", [
    `Estimated monthly retainer: GBP ${prospect.estimatedMonthlyRetainer}.`,
    hasRetainerText ? "Notes mention recurring service terms." : "No recurring-service terms found in notes.",
  ], ["estimatedMonthlyRetainer", "opportunityNotes", "auditSummary"], points === 0))
}

function addEffort(factors: LeadScoreFactor[], prospect: LeadScoreProspectInput) {
  const scoreCount = [prospect.revenueScore, prospect.trustScore, prospect.conversionScore, prospect.seoScore, prospect.mobileScore].filter((score) => score > 0).length
  const lowQualityCount = [prospect.revenueScore, prospect.trustScore, prospect.conversionScore, prospect.seoScore, prospect.mobileScore].filter((score) => score > 0 && score <= 3).length
  const highScopeLowBudget = prospect.estimatedProjectValue > 0 && prospect.estimatedProjectValue < 2500 && lowQualityCount >= 3
  const points = highScopeLowBudget ? -6 : lowQualityCount >= 4 ? -2 : scoreCount >= 3 ? 1 : 0
  factors.push(factor("estimated_delivery_effort", highScopeLowBudget ? "Likely high effort for low budget" : "Delivery effort is not a blocker from current data", points < 0 ? "negative" : "neutral", points, scoreCount >= 3 ? "medium" : "low", [`${lowQualityCount} audited areas score 3/10 or lower.`, `Estimated project value: GBP ${prospect.estimatedProjectValue}.`], ["revenueScore", "trustScore", "conversionScore", "seoScore", "mobileScore", "estimatedProjectValue"], scoreCount < 3))
}

function addClosingProbability(factors: LeadScoreFactor[], stage: ProspectStage) {
  const probability = STAGE_WIN_PROBABILITY[stage] ?? 0
  const points = Math.round((probability - 0.25) * 24)
  factors.push(factor("probability_of_closing", "Pipeline stage informs close probability", points >= 0 ? "positive" : "negative", points, "high", [`Stage ${stage} has baseline close probability ${Math.round(probability * 100)}%.`], ["stage"], false))
}

function recommendNextAction(input: { score: number; confidence: LeadScoreConfidence; prospect: LeadScoreProspectInput; missing: string[]; inboundCount: number; proposals: LeadScoreProposalInput[] }) {
  if (input.prospect.stage === "won") return "Convert delivery notes into onboarding, retainer, and handover actions."
  if (input.prospect.stage === "lost") return "Record the loss reason clearly and use the outcome for calibration."
  if (input.confidence === "low" && input.missing.length) return `Fill missing qualification data: ${input.missing.slice(0, 2).join("; ")}.`
  if (input.score >= 78 && input.inboundCount > 0) return "Prioritise discovery or proposal follow-up; this lead has strong evidence and engagement."
  if (input.score >= 65) return "Book discovery or send a targeted audit follow-up with the evidenced commercial gaps."
  if (input.proposals.length > 0) return "Follow up on the proposal and capture objections or decision timing."
  if (input.score < 45) return "Keep light-touch nurturing unless new budget, urgency, or decision-maker evidence appears."
  return "Run a focused qualification pass before investing proposal time."
}

function factor(category: LeadScoreFactorCategory, label: string, polarity: LeadScoreFactorPolarity, points: number, confidence: LeadScoreConfidence, evidence: string[], sourceFields: string[], uncertain: boolean): LeadScoreFactor {
  return { category, label, polarity, points, confidence, evidence, sourceFields, uncertain }
}

function auditAverage(prospect: LeadScoreProspectInput) {
  const scores = [prospect.revenueScore, prospect.trustScore, prospect.conversionScore, prospect.seoScore, prospect.mobileScore].filter((score) => score > 0)
  if (!scores.length) return 0
  return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
}

function textBlob(prospect: LeadScoreProspectInput) {
  return [prospect.auditSummary, prospect.painPoints, prospect.opportunityNotes, prospect.objectionNotes, prospect.lostReason].filter(Boolean).join("\n")
}

function uncertainPenalty(factors: LeadScoreFactor[]) {
  return factors.filter((factor) => factor.uncertain).length * 3
}

function maxDate(values: Array<Date | string | null | undefined>) {
  const dates = values.map(toDate).filter((date): date is Date => Boolean(date))
  if (!dates.length) return null
  return new Date(Math.max(...dates.map((date) => date.getTime())))
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function addAffected(target: LeadScoreResult["affectedData"], field: string, value: string | number | boolean | null, note: string) {
  target.push({ field, value, note })
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
