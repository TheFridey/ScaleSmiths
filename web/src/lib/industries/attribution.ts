/**
 * Industry → quote attribution helpers.
 * Sensitive personal data never goes in URLs; only industry/pathway/hub/hint.
 */

import type { CommercialPathwayId } from "./types"

export interface IndustryAttribution {
  industry: string
  hub: string
  pathway: CommercialPathwayId | "unknown"
  hint: string
}

const PATHWAYS = new Set<CommercialPathwayId>(["build", "growth", "systems", "audit"])

export function parseIndustryAttribution(search: string | URLSearchParams): IndustryAttribution | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search
  const industry = (params.get("industry") ?? "").trim().slice(0, 80)
  const hub = (params.get("hub") ?? "").trim().slice(0, 80)
  const pathwayRaw = (params.get("pathway") ?? "").trim()
  const hint = (params.get("hint") ?? "").trim().slice(0, 80)
  if (!industry && !hint) return null
  const pathway = PATHWAYS.has(pathwayRaw as CommercialPathwayId)
    ? (pathwayRaw as CommercialPathwayId)
    : "unknown"
  return { industry: industry || "unspecified", hub: hub || "unspecified", pathway, hint }
}

export function industryAttributionBriefPrefix(attribution: IndustryAttribution): string {
  const parts = [
    `[Industry page attribution] industry=${attribution.industry}; hub=${attribution.hub}; pathway=${attribution.pathway}`,
  ]
  if (attribution.hint) parts.push(`visitor_hint=${attribution.hint}`)
  return `${parts.join("; ")}.\n\n`
}

export function industryAttributionBusinessType(attribution: IndustryAttribution): string {
  if (attribution.industry === "missing-industry-request" && attribution.hint) {
    return attribution.hint
  }
  if (attribution.industry && attribution.industry !== "unspecified" && attribution.industry !== "missing-industry-request") {
    return attribution.industry.replaceAll("-", " ")
  }
  return ""
}
