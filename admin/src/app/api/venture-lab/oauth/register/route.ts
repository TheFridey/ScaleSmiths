import { NextResponse } from "next/server"
import { registerCursorOauthClient, VentureOauthError } from "@/lib/server/venture-lab-oauth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new VentureOauthError(400, "invalid_client_metadata", "Dynamic client registration requires application/json.")
    }
    const body = await request.json().catch(() => null)
    const registration = registerCursorOauthClient(body)
    return NextResponse.json(registration, {
      status: 201,
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    })
  } catch (error) {
    if (error instanceof VentureOauthError) {
      return NextResponse.json(
        { error: error.code, error_description: error.safeMessage },
        { status: error.status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
      )
    }
    return NextResponse.json(
      { error: "server_error", error_description: "Unable to register OAuth client." },
      { status: 500, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
    )
  }
}
