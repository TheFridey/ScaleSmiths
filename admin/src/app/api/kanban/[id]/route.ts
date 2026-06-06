import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { kanbanCards } from "@/lib/schema"

const COLUMNS = ["backlog", "progress", "review", "done"] as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = Number(rawId)
  const body = await request.json()
  const column = String(body.column ?? "")

  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid card id." }, { status: 400 })
  }

  if (!COLUMNS.includes(column as (typeof COLUMNS)[number])) {
    return NextResponse.json({ error: "Invalid column." }, { status: 400 })
  }

  await db
    .update(kanbanCards)
    .set({ column: column as (typeof COLUMNS)[number] })
    .where(eq(kanbanCards.id, id))

  return NextResponse.json({ ok: true })
}
