import { NextResponse } from "next/server"
import { InvoiceDomainError } from "@/lib/invoices"
import { createProjectInvoiceDraft } from "@/lib/server/invoices"
import { guardApiCapability } from "@/lib/server/rbac"

export async function POST(request: Request) {
  try {
    const actor = await guardApiCapability("finance.write")
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new InvoiceDomainError("Invalid project invoice payload.")
    const input = body as Record<string, unknown>
    return NextResponse.json({ ok: true, invoice: await createProjectInvoiceDraft(id(input.projectId, "Project"), id(input.serviceAssignmentId, "Service assignment"), actor.id) }, { status: 201 })
  } catch (error) {
    return error instanceof InvoiceDomainError ? NextResponse.json({ error: error.safeMessage, code: error.code }, { status: error.status }) : NextResponse.json({ error: "Unable to create project invoice draft." }, { status: 500 })
  }
}

function id(value: unknown, label: string) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new InvoiceDomainError(`${label} id is invalid.`)
  return parsed
}
