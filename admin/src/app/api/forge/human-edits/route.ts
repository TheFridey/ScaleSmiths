import { NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { AdminIdentityError } from "@/lib/admin-users"
import { guardApiCapability } from "@/lib/server/rbac"
import { loadForgeHumanEditReport } from "@/lib/server/forge-human-edits"

export async function GET(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  try {
    await guardApiCapability("audit.read")
    const url = new URL(request.url)
    const projectIdParam = url.searchParams.get("projectId")
    let projectId: number | undefined
    if (projectIdParam) {
      const parsedProjectId = Number(projectIdParam)
      if (!Number.isInteger(parsedProjectId) || parsedProjectId < 1) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 })
      projectId = parsedProjectId
    }
    return NextResponse.json(await loadForgeHumanEditReport(projectId))
  } catch (error) {
    if (error instanceof AdminIdentityError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    return NextResponse.json({ error: "Unable to load human edit report." }, { status: 500 })
  }
}
