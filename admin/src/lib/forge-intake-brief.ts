import { emptyForgeIntakeData, type ForgeIntakeData } from "./forge"
import type { ForgeJsonSchema, JsonValue } from "./forge-ai"

export const FORGE_BUILD_BRIEF_KIND = "forge_build_brief"

export const FORGE_BUILD_BRIEF_QUESTIONS = [
  {
    id: "business_site_type",
    label: "Business/site type",
    prompt: "What kind of website is this, and what should visitors immediately understand you offer?",
    fieldKeys: ["businessOverview", "coreServices", "flagshipOffer"],
    critical: true,
  },
  {
    id: "target_audience",
    label: "Target audience",
    prompt: "Who is this website mainly for, and what do they care about most?",
    fieldKeys: ["idealCustomers", "customerProblems"],
    critical: true,
  },
  {
    id: "primary_goal",
    label: "Primary goal",
    prompt: "What is the main outcome this website needs to drive?",
    fieldKeys: ["primaryWebsiteGoal", "secondaryGoals"],
    critical: true,
  },
  {
    id: "brand_style",
    label: "Brand style",
    prompt: "How should the site feel visually? A few words is enough.",
    fieldKeys: ["visualStyle", "brandTone", "brandLikes", "brandDislikes"],
    critical: true,
  },
  {
    id: "required_pages",
    label: "Required pages",
    prompt: "Which pages must be included?",
    fieldKeys: ["requiredPages", "pageNotes"],
    critical: true,
  },
  {
    id: "key_ctas",
    label: "Key CTAs",
    prompt: "What should visitors click or do when they are ready?",
    fieldKeys: ["conversionActions"],
    critical: true,
  },
  {
    id: "links_integrations",
    label: "Contact/social/store links",
    prompt: "What contact, social, store, Discord, booking, payment, or analytics links should Forge know about?",
    fieldKeys: ["requiredIntegrations", "integrationNotes"],
    critical: false,
  },
  {
    id: "must_have_features",
    label: "Must-have features",
    prompt: "Any must-have features, sections, proof, assets, or technical requirements?",
    fieldKeys: ["existingAssets", "assetAccessNotes", "testimonials", "caseStudies", "certifications", "guarantees"],
    critical: false,
  },
  {
    id: "service_area",
    label: "Location/service area",
    prompt: "Is this local, national, worldwide, or online-only?",
    fieldKeys: ["businessLocation", "primaryLocation", "serviceAreas"],
    critical: false,
  },
] as const

export type ForgeBuildBriefQuestionId = (typeof FORGE_BUILD_BRIEF_QUESTIONS)[number]["id"]

export interface ForgeBuildBriefMessage extends Record<string, JsonValue> {
  id: string
  role: "user" | "assistant" | "system"
  body: string
  questionId: ForgeBuildBriefQuestionId | null
  createdAt: string
}

export interface ForgeBuildBriefState extends Record<string, JsonValue> {
  kind: typeof FORGE_BUILD_BRIEF_KIND
  starterPrompt: string
  currentQuestionId: ForgeBuildBriefQuestionId | null
  completedQuestionIds: ForgeBuildBriefQuestionId[]
  skippedQuestionIds: ForgeBuildBriefQuestionId[]
  askLess: boolean
  messages: ForgeBuildBriefMessage[]
  updatedAt: string
}

export interface ForgeBuildBriefQuestionResponse extends Record<string, JsonValue> {
  questionId: ForgeBuildBriefQuestionId | "done"
  question: string
  reason: string
  briefSummary: string
}

export const FORGE_BUILD_BRIEF_QUESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questionId", "question", "reason", "briefSummary"],
  properties: {
    questionId: { type: "string", enum: [...FORGE_BUILD_BRIEF_QUESTIONS.map((question) => question.id), "done"] },
    question: { type: "string" },
    reason: { type: "string" },
    briefSummary: { type: "string" },
  },
} as const satisfies ForgeJsonSchema

export function emptyForgeBuildBriefState(now = new Date()): ForgeBuildBriefState {
  return {
    kind: FORGE_BUILD_BRIEF_KIND,
    starterPrompt: "",
    currentQuestionId: null,
    completedQuestionIds: [],
    skippedQuestionIds: [],
    askLess: false,
    messages: [],
    updatedAt: now.toISOString(),
  }
}

export function readForgeBuildBriefState(metadata: Record<string, unknown> | null | undefined): ForgeBuildBriefState {
  const raw = metadata?.buildBrief
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyForgeBuildBriefState()
  const record = raw as Partial<ForgeBuildBriefState>
  if (record.kind !== FORGE_BUILD_BRIEF_KIND) return emptyForgeBuildBriefState()

  return {
    kind: FORGE_BUILD_BRIEF_KIND,
    starterPrompt: typeof record.starterPrompt === "string" ? record.starterPrompt : "",
    currentQuestionId: isBriefQuestionId(record.currentQuestionId) ? record.currentQuestionId : null,
    completedQuestionIds: Array.isArray(record.completedQuestionIds) ? record.completedQuestionIds.filter(isBriefQuestionId) : [],
    skippedQuestionIds: Array.isArray(record.skippedQuestionIds) ? record.skippedQuestionIds.filter(isBriefQuestionId) : [],
    askLess: record.askLess === true,
    messages: Array.isArray(record.messages) ? record.messages.filter(isBriefMessage).slice(-40) : [],
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
  }
}

export function createForgeBuildBriefFromPrompt({
  prompt,
  project,
  now = new Date(),
}: {
  prompt: string
  project: { businessName: string; industry: string | null; targetAudience: string | null; primaryGoal: string | null; websiteUrl: string | null }
  now?: Date
}) {
  const cleaned = clean(prompt, 1200)
  const intake = emptyForgeIntakeData()
  const guessedBusiness = project.businessName || extractBusinessName(cleaned) || "the business"
  const lower = cleaned.toLowerCase()
  const isMinecraft = /minecraft|server|gaming|game|discord/i.test(cleaned)
  const isPremium = /premium|high-end|luxury|elite|professional/i.test(cleaned)

  intake.businessOverview = cleaned || `${guessedBusiness} needs a new website.`
  intake.coreServices = isMinecraft
    ? "Minecraft server website\nCommunity information\nServer features\nPlayer onboarding"
    : project.industry
      ? `${project.industry} website`
      : "Website build"
  intake.flagshipOffer = isMinecraft ? "Premium Minecraft server experience" : "Premium website experience"
  intake.idealCustomers = project.targetAudience || (isMinecraft ? "Minecraft players, gaming community members, streamers, and server explorers" : "Qualified customers who need a clear, trustworthy website")
  intake.customerProblems = isMinecraft ? "Players need to understand the server, trust the community, and find join/store/contact links quickly." : "Visitors need to understand the offer, trust the business, and know what to do next."
  intake.primaryWebsiteGoal = project.primaryGoal || (isMinecraft ? "Grow server joins and community engagement" : "Generate qualified enquiries")
  intake.visualStyle = isPremium ? "Premium, polished, modern, immersive" : "Modern, clear, trustworthy"
  intake.brandTone = isMinecraft ? "Energetic, confident, community-led" : "Professional, clear, confident"
  intake.requiredPages = isMinecraft ? "Home\nServer features\nRules\nStore\nVote\nCommunity\nContact" : "Home\nServices\nAbout\nContact"
  intake.conversionActions = isMinecraft ? "Join server\nOpen Discord\nVisit store\nVote for server" : "Contact the business\nRequest a quote"
  intake.requiredIntegrations = isMinecraft ? "Discord link\nStore link\nServer status or IP\nContact form" : "Contact form"
  intake.existingAssets = "Use supplied logo, brand assets, screenshots, photography, and approved copy when available."
  intake.businessLocation = lower.includes("worldwide") || isMinecraft ? "Online" : ""
  intake.primaryLocation = lower.includes("worldwide") || isMinecraft ? "Worldwide" : ""
  intake.serviceAreas = lower.includes("worldwide") || isMinecraft ? "Worldwide" : ""
  intake.testimonials = "Use real reviews, testimonials, proof, or community stats only if supplied."
  intake.competitorUrls = "Not supplied yet."
  intake.differentiators = isMinecraft ? "Premium positioning, strong community feel, clear server benefits, and fast join path." : "Premium positioning, clear offer, proof-led sections, and a simple conversion path."

  const currentQuestionId = getNextForgeBuildBriefQuestion(emptyForgeBuildBriefState(now), intake)?.id ?? null
  const state: ForgeBuildBriefState = {
    ...emptyForgeBuildBriefState(now),
    starterPrompt: cleaned,
    currentQuestionId,
    messages: [
      message("user", cleaned || "Start guided build brief.", null, now),
      message("assistant", getQuestionPrompt(currentQuestionId), currentQuestionId, now),
    ],
    updatedAt: now.toISOString(),
  }

  return { intake, state }
}

export function applyForgeBuildBriefAnswer({
  state,
  intake,
  answer,
  now = new Date(),
}: {
  state: ForgeBuildBriefState
  intake: ForgeIntakeData
  answer: string
  now?: Date
}) {
  const cleaned = clean(answer, 5000)
  const currentQuestionId = state.currentQuestionId
  const nextState: ForgeBuildBriefState = {
    ...state,
    askLess: state.askLess || /ask me less|less questions|fewer questions/i.test(cleaned),
    messages: [...state.messages, message("user", cleaned || "skip", currentQuestionId, now)].slice(-40),
    updatedAt: now.toISOString(),
  }
  const nextIntake = { ...intake }

  if (currentQuestionId) {
    const skipped = isSkipAnswer(cleaned)
    const judgement = isJudgementAnswer(cleaned)
    if (skipped) {
      nextState.skippedQuestionIds = uniqueIds([...nextState.skippedQuestionIds, currentQuestionId])
    } else {
      applyAnswerToIntake(nextIntake, currentQuestionId, judgement ? defaultAnswerForQuestion(currentQuestionId, nextIntake) : cleaned)
      nextState.completedQuestionIds = uniqueIds([...nextState.completedQuestionIds, currentQuestionId])
    }
  }

  if (/make it premium/i.test(cleaned)) {
    nextIntake.visualStyle = nextIntake.visualStyle || "Premium, polished, modern, conversion-focused"
    nextIntake.brandTone = nextIntake.brandTone || "Confident, premium, clear"
  }

  if (nextState.askLess) fillReasonableDefaults(nextIntake)

  const nextQuestion = getNextForgeBuildBriefQuestion(nextState, nextIntake)
  nextState.currentQuestionId = nextQuestion?.id ?? null
  nextState.messages = [
    ...nextState.messages,
    message("assistant", nextQuestion ? nextQuestion.prompt : "The build brief is ready. Review the summary, tweak anything you want, then generate from the current brief.", nextQuestion?.id ?? null, now),
  ].slice(-40)

  return { intake: nextIntake, state: nextState }
}

export function finalizeForgeBuildBriefIntake(intake: ForgeIntakeData) {
  const next = { ...intake }
  fillReasonableDefaults(next)
  return next
}

export function getNextForgeBuildBriefQuestion(state: ForgeBuildBriefState, intake: ForgeIntakeData) {
  const completed = new Set([...state.completedQuestionIds, ...state.skippedQuestionIds])
  const questions = state.askLess ? FORGE_BUILD_BRIEF_QUESTIONS.filter((question) => question.critical) : FORGE_BUILD_BRIEF_QUESTIONS
  return questions.find((question) => !completed.has(question.id) && question.fieldKeys.some((key) => !intake[key]?.trim())) ?? null
}

export function buildForgeBuildBriefSummary(intake: ForgeIntakeData, state: ForgeBuildBriefState) {
  const answered = state.completedQuestionIds.length
  const skipped = state.skippedQuestionIds.length
  const lines = [
    `Starter: ${state.starterPrompt || "Not started"}`,
    `Progress: ${answered} answered, ${skipped} skipped`,
    "",
    `Business: ${intake.businessOverview || "Not set"}`,
    `Audience: ${intake.idealCustomers || "Not set"}`,
    `Goal: ${intake.primaryWebsiteGoal || "Not set"}`,
    `Style: ${intake.visualStyle || "Not set"}`,
    `Pages: ${intake.requiredPages || "Not set"}`,
    `CTAs: ${intake.conversionActions || "Not set"}`,
    `Links/features: ${intake.requiredIntegrations || "Not set"}`,
  ]
  return lines.join("\n")
}

export function buildForgeBuildBriefAiPrompt({
  intake,
  state,
  project,
}: {
  intake: ForgeIntakeData
  state: ForgeBuildBriefState
  project: { name: string; businessName: string; industry: string | null; targetAudience: string | null; primaryGoal: string | null }
}) {
  const nextQuestion = getNextForgeBuildBriefQuestion(state, intake)
  return [
    "Ask exactly one concise intake question for a website build brief.",
    "Prioritise missing business/site type, audience, goal, brand style, pages, CTAs, links, and must-have features.",
    "Respect short-answer behaviour: users can skip or ask Forge to use judgement.",
    "Do not request credentials, private keys, or analytics access.",
    "",
    "Project:",
    JSON.stringify(project, null, 2),
    "",
    "Current structured intake:",
    JSON.stringify(intake, null, 2),
    "",
    "Brief conversation state:",
    JSON.stringify(state, null, 2),
    "",
    `Recommended deterministic next question: ${nextQuestion ? `${nextQuestion.id} - ${nextQuestion.prompt}` : "done"}`,
  ].join("\n")
}

export function fallbackForgeBuildBriefQuestion(intake: ForgeIntakeData, state: ForgeBuildBriefState): ForgeBuildBriefQuestionResponse {
  const nextQuestion = getNextForgeBuildBriefQuestion(state, intake)
  return {
    questionId: nextQuestion?.id ?? "done",
    question: nextQuestion?.prompt ?? "The build brief is ready. Review it, tweak anything you want, then generate from the current brief.",
    reason: nextQuestion ? `Missing: ${nextQuestion.fieldKeys.filter((key) => !intake[key]?.trim()).join(", ")}` : "Enough brief data is available to proceed.",
    briefSummary: buildForgeBuildBriefSummary(intake, state),
  }
}

function applyAnswerToIntake(intake: ForgeIntakeData, questionId: ForgeBuildBriefQuestionId, answer: string) {
  if (questionId === "business_site_type") {
    intake.businessOverview = answer
    intake.coreServices = answer
    intake.flagshipOffer = firstLine(answer)
  } else if (questionId === "target_audience") {
    intake.idealCustomers = answer
    intake.customerProblems = inferProblem(answer)
  } else if (questionId === "primary_goal") {
    intake.primaryWebsiteGoal = answer
  } else if (questionId === "brand_style") {
    intake.visualStyle = answer
    intake.brandTone = intake.brandTone || inferTone(answer)
  } else if (questionId === "required_pages") {
    intake.requiredPages = answer
    intake.pageNotes = intake.pageNotes || "Use Forge judgement for page ordering and conversion flow."
  } else if (questionId === "key_ctas") {
    intake.conversionActions = answer
  } else if (questionId === "links_integrations") {
    intake.requiredIntegrations = answer
    intake.integrationNotes = intake.integrationNotes || "Use only supplied public links and configured integrations."
  } else if (questionId === "must_have_features") {
    intake.existingAssets = answer
    intake.assetAccessNotes = answer
    intake.testimonials = intake.testimonials || "Use real proof only if supplied."
  } else if (questionId === "service_area") {
    intake.businessLocation = answer
    intake.primaryLocation = answer
    intake.serviceAreas = answer
  }
}

function fillReasonableDefaults(intake: ForgeIntakeData) {
  intake.businessOverview ||= "Website build brief supplied through guided Forge intake."
  intake.businessLocation ||= "Online"
  intake.primaryLocation ||= "Online"
  intake.serviceAreas ||= "Online / supplied service area"
  intake.coreServices ||= "Core website offer"
  intake.flagshipOffer ||= firstLine(intake.coreServices) || "Primary offer"
  intake.idealCustomers ||= "Target customers who need the offer clearly explained."
  intake.customerProblems ||= "Visitors need clarity, trust, and a simple next step."
  intake.brandTone ||= "Clear, confident, premium"
  intake.visualStyle ||= "Premium, polished, modern"
  intake.competitorUrls ||= "Not supplied."
  intake.differentiators ||= "Premium presentation, clear conversion path, and proof-led messaging."
  intake.primaryWebsiteGoal ||= "Drive the primary conversion action."
  intake.conversionActions ||= "Contact / enquire / buy / join"
  intake.testimonials ||= "Use real reviews, testimonials, and proof only if supplied."
  intake.requiredPages ||= "Home\nAbout\nServices or Features\nContact"
  intake.requiredIntegrations ||= "Contact form"
  intake.existingAssets ||= "Use supplied logo, brand assets, screenshots, images, and approved copy when available."
}

function defaultAnswerForQuestion(questionId: ForgeBuildBriefQuestionId, intake: ForgeIntakeData) {
  const map: Record<ForgeBuildBriefQuestionId, string> = {
    business_site_type: intake.businessOverview || "Use the starter prompt and project details to infer the site type and offer.",
    target_audience: intake.idealCustomers || "Use the starter prompt to infer the most likely target audience.",
    primary_goal: intake.primaryWebsiteGoal || "Choose the strongest conversion goal for this website.",
    brand_style: intake.visualStyle || "Make it premium, polished, modern, and appropriate for the audience.",
    required_pages: intake.requiredPages || "Create the essential pages for this site type.",
    key_ctas: intake.conversionActions || "Use the most natural conversion actions for this site.",
    links_integrations: intake.requiredIntegrations || "Include obvious public links and contact routes only.",
    must_have_features: intake.existingAssets || "Use practical must-have features for this site type.",
    service_area: intake.primaryLocation || "Online / supplied service area.",
  }
  return map[questionId]
}

function getQuestionPrompt(questionId: ForgeBuildBriefQuestionId | null) {
  return FORGE_BUILD_BRIEF_QUESTIONS.find((question) => question.id === questionId)?.prompt ?? "What should Forge build?"
}

function message(role: ForgeBuildBriefMessage["role"], body: string, questionId: ForgeBuildBriefQuestionId | null, now: Date): ForgeBuildBriefMessage {
  return {
    id: `${now.getTime()}-${role}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    body,
    questionId,
    createdAt: now.toISOString(),
  }
}

function isBriefQuestionId(value: unknown): value is ForgeBuildBriefQuestionId {
  return typeof value === "string" && FORGE_BUILD_BRIEF_QUESTIONS.some((question) => question.id === value)
}

function isBriefMessage(value: unknown): value is ForgeBuildBriefMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Partial<ForgeBuildBriefMessage>
  return typeof record.id === "string" &&
    (record.role === "user" || record.role === "assistant" || record.role === "system") &&
    typeof record.body === "string"
}

function uniqueIds(values: ForgeBuildBriefQuestionId[]) {
  return [...new Set(values)]
}

function isSkipAnswer(value: string) {
  return /^(skip|pass|not sure|n\/a|na)$/i.test(value.trim())
}

function isJudgementAnswer(value: string) {
  return /use your judgement|use judgment|you decide|forge decide|make it premium|best practice/i.test(value)
}

function inferTone(value: string) {
  if (/premium|luxury|high-end/i.test(value)) return "Premium, confident, polished"
  if (/fun|playful|gaming|minecraft/i.test(value)) return "Energetic, friendly, community-led"
  return "Clear, confident, professional"
}

function inferProblem(value: string) {
  if (/minecraft|gaming|server/i.test(value)) return "They need to quickly understand the server experience, trust the community, and know how to join."
  return `They need clarity, trust, and a strong reason to choose this offer. Audience notes: ${value}`
}

function extractBusinessName(value: string) {
  const match = value.match(/\bfor\s+([A-Za-z0-9][A-Za-z0-9 &'-]{1,60})\.?$/i)
  return match?.[1]?.trim() ?? null
}

function firstLine(value: string) {
  return value.split(/\r?\n|,/).map((item) => item.trim()).find(Boolean) ?? value.trim()
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : ""
}

export function briefQuestionIdFromAi(value: string | null): ForgeBuildBriefQuestionId | null {
  return isBriefQuestionId(value) ? value : null
}
