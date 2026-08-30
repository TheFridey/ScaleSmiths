import { NextResponse } from "next/server"
import { guardApiCapability } from "@/lib/server/rbac"
import { executeConversion, previewConversion } from "@/lib/server/prospect-conversion"
import { conversionFailure, parseId } from "@/lib/server/prospect-conversion-http"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("leads.read")
    const { id } = await params
    return NextResponse.json({ ok: true, plan: await previewConversion(parseId(id), actor) })
  } catch (error) {
    return conversionFailure(error)
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("prospects.convert")
    const { id } = await params
    const body = await request.json().catch(() => null)
    const options = body && typeof body === "object" ? (body as Record<string, unknown>).options : undefined
    return NextResponse.json({ ok: true, conversion: await executeConversion(parseId(id), actor, options) })
  } catch (error) {
    return conversionFailure(error)
  }
}
