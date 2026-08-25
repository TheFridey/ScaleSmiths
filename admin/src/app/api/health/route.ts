import { NextResponse } from "next/server"
import { healthPayload, isValidHealthToken } from "@/lib/health"
import { db } from "@/lib/db"
import { sql } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function checkDatabase(): Promise<"ok" | "unreachable"> {
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ])
    return "ok"
  } catch {
    return "unreachable"
  }
}

export async function GET(request: Request) {
  if (!isValidHealthToken(request.headers.get("x-health-check-token"))) {
    return NextResponse.json({ status: "unavailable" }, { status: 401 })
  }

  const database = await checkDatabase()
  const payload = healthPayload()
  return NextResponse.json({
    ...payload,
    status: database === "ok" ? payload.status : "degraded",
    database,
  }, {
    headers: { "Cache-Control": "no-store" },
  })
}