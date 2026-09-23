import { NextResponse } from "next/server"
import { ventureProtectedResourceMetadata } from "@/lib/server/venture-lab-oauth"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(ventureProtectedResourceMetadata(), {
    headers: { "Cache-Control": "public, max-age=300" },
  })
}
