export const ENTERPRISE_CONTACT_PATH = "/enterprise/contact"
export const ENTERPRISE_CONTACT_THANKS_PATH = "/enterprise/contact/thanks"
export const ENTERPRISE_ENQUIRY_STORAGE_KEY = "scalesmiths.enterprise.enquiry.draft.v1"

export const ENTERPRISE_STAGES = [
  "Organisation",
  "Current Situation",
  "System Requirements",
  "Technical Environment",
  "Project Context",
  "Final Message",
] as const

export type EnterpriseStageIndex = 0 | 1 | 2 | 3 | 4 | 5

export const ENTERPRISE_COMPANY_SIZES = [
  "1–10",
  "11–50",
  "51–200",
  "201–1,000",
  "1,000+",
] as const

export const ENTERPRISE_SYSTEM_AREAS = [
  "Internal business system",
  "Operational platform",
  "Workflow automation",
  "Mobile application",
  "Offline application",
  "Inspection/check system",
  "Compliance platform",
  "Asset management",
  "Portal",
  "SaaS",
  "Integrations",
  "Reporting/analytics",
  "Data migration",
  "Other",
] as const

export const ENTERPRISE_BUDGET_BANDS = [
  "Under £25k",
  "£25k–£50k",
  "£50k–£100k",
  "£100k–£250k",
  "£250k+",
  "Not yet established",
] as const

export const ENTERPRISE_TIMESCALES = [
  "Exploring / no fixed date",
  "Next quarter",
  "3–6 months",
  "6–12 months",
  "ASAP if the fit is right",
] as const

export const ENTERPRISE_YES_NO_UNSURE = ["Yes", "No", "Not sure"] as const

export const ENTERPRISE_CLOUD_PROVIDERS = [
  "Microsoft Azure",
  "Amazon Web Services",
  "Google Cloud",
  "Other / hybrid",
  "On-premises",
  "Not sure",
] as const

export type EnterpriseEnquiryDraft = {
  name: string
  email: string
  phone: string
  company: string
  jobTitle: string
  companySize: string
  siteCount: string
  currentSystems: string
  problem: string
  overlappingSystems: string
  manualProcesses: string
  operationalFriction: string
  systemAreas: string[]
  systemAreasOther: string
  microsoft365: string
  requireSso: string
  cloudProvider: string
  existingApis: string
  dataMigration: string
  mobileOffline: string
  securityProcurement: string
  approxUsers: string
  approxSites: string
  timescale: string
  budgetApproved: string
  budgetRange: string
  approvers: string
  finalMessage: string
  consent: boolean
  website: string
}

export const emptyEnterpriseEnquiryDraft = (): EnterpriseEnquiryDraft => ({
  name: "",
  email: "",
  phone: "",
  company: "",
  jobTitle: "",
  companySize: "",
  siteCount: "",
  currentSystems: "",
  problem: "",
  overlappingSystems: "",
  manualProcesses: "",
  operationalFriction: "",
  systemAreas: [],
  systemAreasOther: "",
  microsoft365: "",
  requireSso: "",
  cloudProvider: "",
  existingApis: "",
  dataMigration: "",
  mobileOffline: "",
  securityProcurement: "",
  approxUsers: "",
  approxSites: "",
  timescale: "",
  budgetApproved: "",
  budgetRange: "",
  approvers: "",
  finalMessage: "",
  consent: false,
  website: "",
})

export function isEnterpriseSystemArea(value: string): value is (typeof ENTERPRISE_SYSTEM_AREAS)[number] {
  return (ENTERPRISE_SYSTEM_AREAS as readonly string[]).includes(value)
}

export function isEnterpriseBudgetBand(value: string): value is (typeof ENTERPRISE_BUDGET_BANDS)[number] {
  return (ENTERPRISE_BUDGET_BANDS as readonly string[]).includes(value)
}

export function validateEnterpriseStage(stage: number, draft: EnterpriseEnquiryDraft): { ok: true } | { ok: false; field: string; message: string } {
  if (stage === 0) {
    if (!draft.name.trim()) return { ok: false, field: "name", message: "Please add your name." }
    if (!draft.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      return { ok: false, field: "email", message: "Please add a valid work email address." }
    }
    if (!draft.phone.trim()) return { ok: false, field: "phone", message: "Please add a phone number." }
    if (!draft.company.trim()) return { ok: false, field: "company", message: "Please add your company name." }
    if (!draft.jobTitle.trim()) return { ok: false, field: "jobTitle", message: "Please add your job title." }
    if (!draft.companySize.trim()) return { ok: false, field: "companySize", message: "Please choose a company size." }
    return { ok: true }
  }

  if (stage === 1) {
    if (!draft.problem.trim()) {
      return { ok: false, field: "problem", message: "Please describe the problem you are trying to solve." }
    }
    return { ok: true }
  }

  if (stage === 2) {
    if (draft.systemAreas.length === 0) {
      return { ok: false, field: "systemAreas", message: "Please select at least one system requirement area." }
    }
    if (draft.systemAreas.includes("Other") && !draft.systemAreasOther.trim()) {
      return { ok: false, field: "systemAreasOther", message: "Please briefly describe the other system requirement." }
    }
    return { ok: true }
  }

  if (stage === 3) {
    return { ok: true }
  }

  if (stage === 4) {
    if (!draft.timescale.trim()) return { ok: false, field: "timescale", message: "Please choose a desired timescale." }
    if (!draft.budgetRange.trim()) return { ok: false, field: "budgetRange", message: "Please choose a budget range." }
    return { ok: true }
  }

  if (stage === 5) {
    if (!draft.finalMessage.trim()) {
      return { ok: false, field: "finalMessage", message: "Please add a short message about what you want from discovery." }
    }
    if (!draft.consent) {
      return { ok: false, field: "consent", message: "Please confirm consent before submitting." }
    }
    return { ok: true }
  }

  return { ok: true }
}

export function buildEnterpriseEnquiryBrief(draft: EnterpriseEnquiryDraft) {
  const areas = draft.systemAreas.includes("Other") && draft.systemAreasOther.trim()
    ? [...draft.systemAreas.filter((area) => area !== "Other"), `Other: ${draft.systemAreasOther.trim()}`]
    : draft.systemAreas

  return [
    "=== Enterprise discovery brief ===",
    "",
    "— Organisation —",
    `Job title: ${draft.jobTitle || "Not provided"}`,
    `Company size: ${draft.companySize || "Not provided"}`,
    `Sites / locations: ${draft.siteCount || "Not provided"}`,
    "",
    "— Current situation —",
    `Current systems: ${draft.currentSystems || "Not provided"}`,
    `Problem to solve: ${draft.problem || "Not provided"}`,
    `Overlapping systems: ${draft.overlappingSystems || "Not provided"}`,
    `Manual processes: ${draft.manualProcesses || "Not provided"}`,
    `Operational friction: ${draft.operationalFriction || "Not provided"}`,
    "",
    "— System requirements —",
    `Selected areas: ${areas.length ? areas.join("; ") : "Not provided"}`,
    "",
    "— Technical environment —",
    `Microsoft 365 / Entra ID: ${draft.microsoft365 || "Not provided"}`,
    `SSO required: ${draft.requireSso || "Not provided"}`,
    `Cloud provider: ${draft.cloudProvider || "Not provided"}`,
    `Existing APIs / integrations: ${draft.existingApis || "Not provided"}`,
    `Data migration required: ${draft.dataMigration || "Not provided"}`,
    `Mobile / offline required: ${draft.mobileOffline || "Not provided"}`,
    `Security / procurement known: ${draft.securityProcurement || "Not provided"}`,
    "",
    "— Project context —",
    `Approx. users: ${draft.approxUsers || "Not provided"}`,
    `Approx. sites: ${draft.approxSites || "Not provided"}`,
    `Desired timescale: ${draft.timescale || "Not provided"}`,
    `Budget already approved: ${draft.budgetApproved || "Not provided"}`,
    `Budget range: ${draft.budgetRange || "Not provided"}`,
    `Approvers involved: ${draft.approvers || "Not provided"}`,
    "",
    "— Final message —",
    draft.finalMessage.trim() || "Not provided",
  ].join("\n")
}

export function buildEnterpriseQuotePayload(draft: EnterpriseEnquiryDraft) {
  const needs = draft.systemAreas
    .filter(isEnterpriseSystemArea)
    .slice(0, 14)
    .map((area) => (area === "Other" && draft.systemAreasOther.trim() ? `Other: ${draft.systemAreasOther.trim()}` : area))

  return {
    name: draft.name.trim(),
    email: draft.email.trim(),
    biz: draft.company.trim(),
    phone: draft.phone.trim(),
    businessType: draft.companySize.trim() || "Enterprise organisation",
    type: needs.length ? needs.join(", ") : "Enterprise System",
    budget: draft.budgetRange.trim(),
    timeframe: draft.timescale.trim(),
    goal: draft.problem.trim(),
    needs,
    carePlanInterest: draft.budgetApproved.trim() || "Not provided",
    preferredContactMethod: "Email",
    intent: "enterprise" as const,
    funnelType: "enterprise" as const,
    consent: draft.consent === true,
    brief: buildEnterpriseEnquiryBrief(draft),
    website: draft.website,
  }
}
