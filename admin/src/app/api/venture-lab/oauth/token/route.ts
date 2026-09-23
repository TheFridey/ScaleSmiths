import { NextResponse } from "next/server"
import { exchangeCursorOauthToken, VentureOauthError } from "@/lib/server/venture-lab-oauth"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (!contentType.toLowerCase().includes("application/x-www-form-urlencoded")) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Token requests must use application/x-www-form-urlencoded." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }
    const form = new URLSearchParams(await request.text())
    const token = await exchangeCursorOauthToken(form)
    return NextResponse.json(token, {
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    })
  } catch (error) {
    if (error instanceof VentureOauthError) {
      return NextResponse.json(
        { error: error.code, error_description: error.safeMessage },
        { status: error.status, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
      )
    }
    return NextResponse.json(
      { error: "server_error", error_description: "Unable to issue OAuth token." },
      { status: 500, headers: { "Cache-Control": "no-store", Pragma: "no-cache" } },
    )
  }
}
