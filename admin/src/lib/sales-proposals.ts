import { PROPOSAL_STATUSES, type ProposalStatus } from "./prospects"

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export const SALES_PROPOSAL_GENERATORS = ["forge", "manual"] as const

export type SalesProposalGeneratedBy = (typeof SALES_PROPOSAL_GENERATORS)[number]

export interface SalesProposalGeneratePayload {
  prospectId: number | null
  clientId: number | null
  selectedServices: string | null
  buildPrice: number
  retainerPrice: number
}

export interface SalesProposalEditPayload {
  title: string
  summary: string
  htmlContent: string
  status: ProposalStatus
}

export function parseSalesProposalGeneratePayload(input: Record<string, unknown>): ParseResult<SalesProposalGeneratePayload> {
  const prospectId = parseOptionalPositiveInteger(input.prospectId, "Prospect")
  if (!prospectId.ok) return prospectId

  const clientId = parseOptionalPositiveInteger(input.clientId, "Client")
  if (!clientId.ok) return clientId

  if (!prospectId.data && !clientId.data) {
    return { ok: false, error: "Prospect or client is required." }
  }

  const buildPrice = parseNonNegativeInteger(input.buildPrice, "Build price")
  if (!buildPrice.ok) return buildPrice

  const retainerPrice = parseNonNegativeInteger(input.retainerPrice, "Retainer price")
  if (!retainerPrice.ok) return retainerPrice

  return {
    ok: true,
    data: {
      prospectId: prospectId.data,
      clientId: clientId.data,
      selectedServices: optionalString(input.selectedServices, 4000),
      buildPrice: buildPrice.data,
      retainerPrice: retainerPrice.data,
    },
  }
}

export function parseSalesProposalEditPayload(input: Record<string, unknown>): ParseResult<SalesProposalEditPayload> {
  const title = optionalString(input.title, 240)
  const summary = optionalString(input.summary, 4000)
  const htmlContent = optionalString(input.htmlContent, 300_000)
  const status = parseProposalStatus(input.status)

  if (!title) return { ok: false, error: "Proposal title is required." }
  if (!summary) return { ok: false, error: "Proposal summary is required." }
  if (!htmlContent) return { ok: false, error: "Proposal HTML content is required." }
  if (!status.ok) return status

  return { ok: true, data: { title, summary, htmlContent, status: status.data } }
}

export function formatSalesPrice(value: number, suffix = "") {
  if (!value) return "To be confirmed"
  return `GBP ${value.toLocaleString("en-GB")}${suffix}`
}

function parseProposalStatus(value: unknown): ParseResult<ProposalStatus> {
  if (value === undefined || value === null || value === "") return { ok: true, data: "draft" }
  if (typeof value === "string" && PROPOSAL_STATUSES.includes(value as ProposalStatus)) {
    return { ok: true, data: value as ProposalStatus }
  }
  return { ok: false, error: "Proposal status is invalid." }
}

function parseOptionalPositiveInteger(value: unknown, label: string): ParseResult<number | null> {
  if (value === undefined || value === null || value === "") return { ok: true, data: null }

  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isInteger(parsed) || parsed < 1) return { ok: false, error: `${label} is required.` }
  return { ok: true, data: parsed }
}

function parseNonNegativeInteger(value: unknown, label: string): ParseResult<number> {
  if (value === undefined || value === null || value === "") return { ok: true, data: 0 }

  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return { ok: false, error: `${label} must be zero or more.` }
  }

  return { ok: true, data: parsed }
}

function optionalString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null
}
