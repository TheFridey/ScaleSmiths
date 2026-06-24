import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { generateForgeUrlAutofill } from "@/lib/server/forge-url-autofill"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const url = body && typeof body === "object" && !Array.isArray(body) && typeof body.websiteUrl === "string"
    ? body.websiteUrl
    : ""

  if (!url.trim()) {
    return NextResponse.json({ error: "Website URL is required." }, { status: 400 })
  }

  try {
    const autofill = await generateForgeUrlAutofill(url)
    return NextResponse.json({ ok: true, autofill })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to autofill from that URL."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
