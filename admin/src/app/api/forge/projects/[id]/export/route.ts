import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeExportError, runForgeExport } from "@/lib/server/forge-export-agent"
import type { ForgeExportKind } from "@/lib/forge-export"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function parseKind(value: unknown): ForgeExportKind | null {
  return value === "site" || value === "proposal" || value === "audit" || value === "handover" ? value : null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const body = await request.json().catch(() => ({})) as { kind?: unknown }
  const kind = parseKind(body.kind)

  if (!kind) {
    return NextResponse.json({ error: "Invalid export kind." }, { status: 400 })
  }

  try {
    const result = await runForgeExport(projectId, sessionActor(session), kind)
    return new NextResponse(new Uint8Array(result.body), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Content-Length": String(result.body.length),
        "X-Forge-Export-Files": String(result.fileCount),
        "X-Forge-Export-Excluded": String(result.excludedCount),
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof ForgeExportError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to export." }, { status: 500 })
  }
}
