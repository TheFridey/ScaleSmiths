import { NextResponse } from "next/server"
import { loadInvoiceSupplierIdentity, saveInvoiceSupplierIdentity } from "@/lib/server/invoice-supplier-settings"
import { guardApiCapability } from "@/lib/server/rbac"

export async function GET() {
  await guardApiCapability("finance.read")
  return NextResponse.json({ ok: true, settings: await loadInvoiceSupplierIdentity() })
}

export async function PUT(request: Request) {
  try {
    await guardApiCapability("finance.write")
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid invoice settings payload." }, { status: 400 })
    return NextResponse.json({ ok: true, settings: await saveInvoiceSupplierIdentity(body) })
  } catch { return NextResponse.json({ error: "Unable to save invoice settings." }, { status: 500 }) }
}
