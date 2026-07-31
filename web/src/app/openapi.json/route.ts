import { NextResponse } from "next/server"
import { buildOpenApiDocument } from "@/lib/agent-discovery"

export const dynamic = "force-static"

// Machine-readable description of the public API, referenced by /.well-known/api-catalog
// and by the homepage `service-desc` Link header.
export function GET() {
  return NextResponse.json(buildOpenApiDocument(), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
