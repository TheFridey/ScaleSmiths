export interface ConversionPlanView {
  prospectId: number
  alreadyConverted: boolean
  warnings: Array<{ code: string; message: string; blocksExecute: boolean }>
  defaults: { clientName: string; tier: string; mrr: number; invoiceClientCode: string; projectName: string; onboardingTasks: Array<{ title: string }> }
  matchCandidates: Array<{ clientId: number; name: string; tier: string | null; mrr: number; matchedOn: string[] }>
  catalogue: Array<{ id: number; name: string; defaultUnitAmount: number; category: string | null }>
  existingConversionId: number | null
}

export interface ModalFormState {
  mode: "create" | "link"
  linkClientId: number | null
  name: string
  tier: string
  mrr: number
  code: string
  serviceIds: number[]
  createProject: boolean
  projectName: string
  onboardingTasks: boolean
  createDraftInvoice: boolean
  preparePortal: boolean
}

export function initialFormState(plan: ConversionPlanView): ModalFormState {
  return {
    mode: "create",
    linkClientId: null,
    name: plan.defaults.clientName,
    tier: plan.defaults.tier,
    mrr: plan.defaults.mrr,
    code: plan.defaults.invoiceClientCode,
    serviceIds: [],
    createProject: false,
    projectName: plan.defaults.projectName,
    onboardingTasks: false,
    createDraftInvoice: false,
    preparePortal: false,
  }
}

export function buildSubmitOptions(state: ModalFormState): Record<string, unknown> {
  const code = state.code.trim() ? state.code.trim().toUpperCase() : undefined
  const client =
    state.mode === "create"
      ? { mode: "create", name: state.name, tier: state.tier, invoiceClientCode: code ?? "" }
      : { mode: "link", clientId: state.linkClientId, tier: state.tier, invoiceClientCode: code }
  return {
    client,
    mrr: Number(state.mrr),
    catalogueItemIds: state.serviceIds,
    createProject: state.createProject,
    projectName: state.createProject ? state.projectName : undefined,
    onboardingTasks: state.onboardingTasks,
    createDraftInvoice: state.createDraftInvoice,
    preparePortal: state.preparePortal,
  }
}

export function blocksConvert(plan: ConversionPlanView, state: ModalFormState): boolean {
  if (plan.warnings.some((w) => w.blocksExecute)) return true
  if (state.mode === "link" && !state.linkClientId) return true
  if (state.createDraftInvoice && state.serviceIds.length === 0) return true
  return false
}

export function formatMoney(minor: number): string {
  return `£${(minor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`
}
