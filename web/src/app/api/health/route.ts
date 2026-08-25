import { NextResponse } from "next/server"
import { webErrorMonitoringHealth } from "@/lib/server-monitoring"
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

export async function GET() {
  const database = await checkDatabase()
  return NextResponse.json({
    status: database === "ok" ? "ok" : "degraded",
    service: "scalesmiths-web",
    database,
    environment: process.env.NODE_ENV ?? "unknown",
    release: process.env.SS_RELEASE_ID || process.env.ERROR_MONITORING_RELEASE || undefined,
    monitoring: webErrorMonitoringHealth(),
  }, { headers: { "Cache-Control": "no-store" } })
}