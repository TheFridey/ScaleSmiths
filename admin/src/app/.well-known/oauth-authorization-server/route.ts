import { NextResponse } from "next/server"
import { ventureAuthorizationServerMetadata } from "@/lib/server/venture-lab-oauth"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(ventureAuthorizationServerMetadata(), {
    headers: { "Cache-Control": "public, max-age=300" },
  })
}
