import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"
import { InvoiceDomainError, normalizeInvoiceClientCode } from "@/lib/invoices"
import { guardApiCapability } from "@/lib/server/rbac"
import { parseClientDomainFields } from "@/lib/clients"

export const dynamic = "force-dynamic"

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function POST(request: NextRequest) {
  await guardApiCapability("clients.write")
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid client payload." }, { status: 400 })
  }

  const name = optionalString(body.name)

  if (!name) {
    return NextResponse.json({ error: "Client name is required." }, { status: 400 })
  }
  const domain = parseClientDomainFields(body)
  if (!domain.ok) return NextResponse.json({ error: domain.error }, { status: 400 })

  const mrr = Number.parseInt(String(body.mrr ?? "0"), 10)
  let invoiceClientCode: string
  try { invoiceClientCode = normalizeInvoiceClientCode(body.invoiceClientCode) }
  catch (error) { return NextResponse.json({ error: error instanceof InvoiceDomainError ? error.safeMessage : "Invalid invoice client code." }, { status: 400 }) }

  let client
  try { [client] = await db
    .insert(clients)
    .values({
      name,
      contactName: optionalString(body.contactName),
      contactEmail: optionalString(body.contactEmail),
      tier: domain.tier,
      mrr: Number.isFinite(mrr) ? Math.max(0, mrr) : 0,
      status: domain.status,
      invoiceClientCode,
      billingAddressLine1: optionalString(body.billingAddressLine1),
      billingAddressLine2: optionalString(body.billingAddressLine2),
      billingCity: optionalString(body.billingCity),
      billingCounty: optionalString(body.billingCounty),
      billingPostcode: optionalString(body.billingPostcode),
      billingCountry: optionalString(body.billingCountry),
      portalClientId: optionalString(body.portalClientId),
    })
    .returning({ id: clients.id })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") return NextResponse.json({ error: "That invoice client code is already in use." }, { status: 409 })
    throw error
  }

  return NextResponse.json({ ok: true, clientId: client.id }, { status: 201 })
}
