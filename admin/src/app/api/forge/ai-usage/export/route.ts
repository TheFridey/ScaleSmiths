import { NextResponse } from "next/server"
import { auth } from "../../../../../../auth"
import { exportForgeAiUsageCsv } from "@/lib/server/forge-ai-usage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseProjectId(value: string | null) {
  if (!value) return null
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const url = new URL(request.url)
  const projectId = parseProjectId(url.searchParams.get("projectId"))
  const csv = await exportForgeAiUsageCsv(projectId)
  const suffix = projectId ? `project-${projectId}` : "all-projects"

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="forge-ai-usage-${suffix}.csv"`,
      "cache-control": "no-store",
    },
  })
}
