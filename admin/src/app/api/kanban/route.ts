import { NextResponse } from "next/server"
import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { clients, kanbanCards } from "@/lib/schema"

export const dynamic = "force-dynamic"

export async function GET() {
  const rows = await db
    .select({
      id: kanbanCards.id,
      title: kanbanCards.title,
      col: kanbanCards.column,
      priority: kanbanCards.priority,
      tag: kanbanCards.tag,
      client: clients.name,
      position: kanbanCards.position,
    })
    .from(kanbanCards)
    .leftJoin(clients, eq(kanbanCards.clientId, clients.id))
    .orderBy(asc(kanbanCards.column), asc(kanbanCards.position), asc(kanbanCards.createdAt))

  return NextResponse.json({
    cards: rows.map((row) => ({
      id: row.id,
      title: row.title,
      col: row.col,
      priority: row.priority,
      tag: row.tag ?? "Task",
      client: row.client ?? "Unassigned",
      position: row.position,
    })),
  })
}
