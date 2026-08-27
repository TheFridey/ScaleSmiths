import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { invoicePortalClients } from "@/lib/schema"

export interface PortalClientProfile {
  companyName: string
  contactName: string | null
  contactFirstName: string | null
  portalName: string
  tier: string | null
  status: string
}

export async function loadPortalClientProfile(portalClientId: string): Promise<PortalClientProfile | null> {
  const [client] = await db
    .select({
      companyName: invoicePortalClients.name,
      contactName: invoicePortalClients.contactName,
      tier: invoicePortalClients.tier,
      status: invoicePortalClients.status,
    })
    .from(invoicePortalClients)
    .where(eq(invoicePortalClients.portalClientId, portalClientId))
    .limit(1)

  if (!client) return null

  const companyName = client.companyName.trim()
  const contactName = cleanOptionalName(client.contactName)

  return {
    companyName,
    contactName,
    contactFirstName: contactName?.split(/\s+/)[0] ?? null,
    portalName: `${companyName} Portal`,
    tier: cleanOptionalName(client.tier),
    status: client.status,
  }
}

function cleanOptionalName(value: string | null) {
  const cleaned = value?.trim()
  return cleaned || null
}
