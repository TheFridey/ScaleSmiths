export const FORGE_SITE_INVENTORY_ARTIFACT_TITLE = "Existing Site Content Inventory"
export const FORGE_SITE_INVENTORY_ARTIFACT_KIND = "forge_site_inventory_v1"

export interface ForgeSiteInventoryPage {
  requestedUrl: string
  finalUrl: string
  depth: number
  status: number
  redirects: Array<{ from: string; to: string; status: number }>
  title: string
  metaDescription: string
  canonicalUrl: string | null
  headings: Array<{ level: number; text: string }>
  mainContent: string
  images: Array<{ src: string; alt: string }>
  internalLinks: string[]
  forms: Array<{ action: string | null; method: string; fields: string[] }>
  contactDetails: { emails: string[]; phones: string[]; addresses: string[] }
  structuredData: unknown[]
  contentType: string
  contentBytes: number
  fetchedAt: string
}

export interface ForgeSiteInventory {
  kind: typeof FORGE_SITE_INVENTORY_ARTIFACT_KIND
  startedAt: string
  completedAt: string
  startUrl: string
  allowedDomains: string[]
  policy: { maxPages: number; maxDepth: number; robots: "respect" | "ignore"; scriptsExecuted: false }
  pages: ForgeSiteInventoryPage[]
  discoveredUrls: string[]
  failures: Array<{ url: string; depth: number; category: string; message: string; occurredAt: string }>
  evidence: { robotsUrl: string; robotsStatus: number | null; robotsApplied: boolean; userAgent: string }
  summary: { pagesFetched: number; urlsDiscovered: number; failures: number; redirects: number; images: number; forms: number }
}

export function readForgeSiteInventory(value: unknown): ForgeSiteInventory | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<ForgeSiteInventory>
  return candidate.kind === FORGE_SITE_INVENTORY_ARTIFACT_KIND && Array.isArray(candidate.pages) && Array.isArray(candidate.failures)
    ? candidate as ForgeSiteInventory
    : null
}
