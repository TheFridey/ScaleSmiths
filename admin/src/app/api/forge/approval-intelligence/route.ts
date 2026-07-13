import { NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { AdminIdentityError } from "@/lib/admin-users"
import { guardApiCapability } from "@/lib/server/rbac"
import { loadForgeApprovalIntelligenceReport } from "@/lib/server/forge-approval-intelligence"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  try {
    await guardApiCapability("audit.read")
    const url = new URL(request.url)
    const projectIdParam = url.searchParams.get("projectId")
    let projectId: number | undefined
    if (projectIdParam) {
      const parsed = Number(projectIdParam)
      if (!Number.isInteger(parsed) || parsed < 1) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 })
      projectId = parsed
    }
    return NextResponse.json(await loadForgeApprovalIntelligenceReport(projectId))
  } catch (error) {
    if (error instanceof AdminIdentityError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    return NextResponse.json({ error: "Unable to load approval intelligence report." }, { status: 500 })
  }
}
