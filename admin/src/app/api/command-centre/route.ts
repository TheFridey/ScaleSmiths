import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import {
  commercialMutation,
  commercialSnapshot,
} from "@/lib/server/command-centre"
import { CommercialError, csvCell } from "@/lib/command-centre"
import { AdminIdentityError } from "@/lib/admin-users"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store, max-age=0" }
function failure(error: unknown) {
  if (error instanceof CommercialError || error instanceof AdminIdentityError)
    return NextResponse.json(
      {
        error: error.message,
        details: error instanceof CommercialError ? error.details : undefined,
      },
      { status: error.status, headers },
    )
  const code =
    (error as { code?: string; cause?: { code?: string } })?.code ??
    (error as { cause?: { code?: string } })?.cause?.code
  if (code === "23505")
    return NextResponse.json(
      {
        error: "This record or reference already exists. Reload to review it.",
      },
      { status: 409, headers },
    )
  console.error("Command Centre operation failed", {
    code: code ?? "unavailable",
  })
  return NextResponse.json(
    {
      error:
        "Command Centre data is unavailable. Check database connectivity and migrations.",
    },
    { status: 503, headers },
  )
}
export async function GET(request: Request) {
  try {
    const actor = await guardApiCapability("leads.read")
    const data = await commercialSnapshot(actor)
    const exportType = new URL(request.url).searchParams.get("export")
    if (exportType === "payments") await guardApiCapability("finance.read")
    if (exportType) {
      const rows: unknown[][] =
        exportType === "activities"
          ? [
              ["Business ID", "Actor ID", "Type", "Outcome", "Time"],
              ...data.activities.map((a) => [
                a.prospectId,
                a.actorUserId ?? "Legacy attribution unverified",
                a.type,
                a.outcome,
                a.createdAt.toISOString(),
              ]),
            ]
          : exportType === "payments"
            ? [
                [
                  "Client ID",
                  "Amount pence",
                  "Category",
                  "Reference",
                  "Received",
                ],
                ...data.payments.map((p) => [
                  p.clientId,
                  p.amount,
                  p.category,
                  p.reference,
                  p.receivedAt.toISOString(),
                ]),
              ]
            : [
                [
                  "Business",
                  "Stage",
                  "Owner ID",
                  "Build estimate (legacy units)",
                  "Retainer estimate (legacy units)",
                  "Next action",
                ],
                ...data.leads.map((l) => [
                  l.businessName,
                  l.stage,
                  l.ownerUserId,
                  l.estimatedProjectValue,
                  l.estimatedMonthlyRetainer,
                  l.nextAction,
                ]),
              ]
      return new Response(
        rows.map((r) => r.map(csvCell).join(",")).join("\r\n"),
        {
          headers: {
            ...headers,
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="scalesmiths-commercial.csv"',
            "X-Content-Type-Options": "nosniff",
          },
        },
      )
    }
    return NextResponse.json(data, { headers })
  } catch (error) {
    return failure(error)
  }
}
export async function POST(request: Request) {
  try {
    const actor = await guardApiCapability("leads.read")
    const origin = request.headers.get("origin")
    const expected = new URL(process.env.AUTH_URL || request.url).origin
    if (!origin || origin !== expected)
      throw new CommercialError("Invalid request origin.", 403)
    const rate = await checkDurableRateLimit(
      `commercial:${actor.id}`,
      120,
      60000,
    )
    if (!rate.ok)
      throw new CommercialError("Too many requests. Try again shortly.", 429)
    const raw = await request.text()
    if (raw.length > 20000)
      throw new CommercialError("Request is too large.", 413)
    let input: unknown
    try {
      input = JSON.parse(raw)
    } catch {
      throw new CommercialError("Invalid JSON.")
    }
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new CommercialError("Invalid payload.")
    return NextResponse.json(
      {
        ok: true,
        record: await commercialMutation(
          actor,
          input as Record<string, unknown>,
        ),
      },
      { headers },
    )
  } catch (error) {
    return failure(error)
  }
}
