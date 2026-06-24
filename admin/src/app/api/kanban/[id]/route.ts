import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { kanbanCards } from "@/lib/schema"

const COLUMNS = ["backlog", "progress", "review", "done"] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = Number(rawId)
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid card payload." }, { status: 400 })
  }

  const column = String(body.column ?? "")

  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid card id." }, { status: 400 })
  }

  if (!COLUMNS.includes(column as (typeof COLUMNS)[number])) {
    return NextResponse.json({ error: "Invalid column." }, { status: 400 })
  }

  const [updated] = await db
    .update(kanbanCards)
    .set({ column: column as (typeof COLUMNS)[number] })
    .where(eq(kanbanCards.id, id))
    .returning({ id: kanbanCards.id })

  if (!updated) {
    return NextResponse.json({ error: "Roadmap card not found." }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
