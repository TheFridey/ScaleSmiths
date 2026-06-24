"use client"

import { useEffect, useState } from "react"
import { Plus, MoreHorizontal } from "lucide-react"

const T = {s1:"var(--s1)",s2:"var(--s2)",s3:"var(--s3)",b1:"var(--b1)",b2:"var(--b2)",t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",acc:"var(--acc)",accDim:"var(--acc-dim)",accB:"var(--acc-b)",grn:"var(--grn)",amb:"var(--amb)",red:"var(--red)"}

const COLS = [
  { id:"backlog",  label:"Backlog",     color:"#383838" },
  { id:"progress", label:"In Progress", color:"#2563EB" },
  { id:"review",   label:"In Review",   color:"#f59e0b" },
  { id:"done",     label:"Done",        color:"#10b981" },
] as const

type Column = (typeof COLS)[number]["id"]
type Priority = "high" | "med" | "low"

interface Card {
  id: number
  col: Column
  title: string
  client: string
  priority: Priority
  tag: string
  position?: number
}

const PRIORITY_COLOR = { high:T.red, med:T.amb, low:T.grn }

function normalizePriority(priority: string): Priority {
  return priority === "high" || priority === "low" ? priority : "med"
}

function normalizeColumn(column: string): Column {
  return COLS.some((col) => col.id === column) ? column as Column : "backlog"
}

export function Kanban() {
  const [cards, setCards] = useState<Card[]>([])
  const [dragging, setDragging] = useState<Card | null>(null)
  const [over, setOver] = useState<Column | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadCards() {
      setLoading(true)
      setError("")

      try {
        const res = await fetch("/api/kanban")
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          throw new Error(json.error || "Unable to load roadmap cards.")
        }

        if (mounted) {
          const rows = Array.isArray(json.cards) ? json.cards : []
          setCards(rows.map((card: Card & { priority: string; col: string }) => ({
            ...card,
            col: normalizeColumn(card.col),
            priority: normalizePriority(card.priority),
          })))
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load roadmap cards.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadCards()

    return () => {
      mounted = false
    }
  }, [])

  const onDragStart = (c: Card) => setDragging(c)
  const onDragOver = (e: React.DragEvent, col: Column) => {
    e.preventDefault()
    setOver(col)
  }
  const onDrop = async (col: Column) => {
    const card = dragging

    setDragging(null)
    setOver(null)

    if (!card || card.col === col) return

    const previous = cards
    setCards((prev) => prev.map((c) => c.id === card.id ? { ...c, col } : c))
    setError("")

    try {
      const res = await fetch(`/api/kanban/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column: col }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Unable to update card.")
      }
    } catch (err) {
      setCards(previous)
      setError(err instanceof Error ? err.message : "Unable to update card.")
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">Project Roadmap</h1>
          <p className="font-dm text-sm mt-0.5" style={{color:T.t2}}>Drag cards between columns to update status</p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg font-dm text-sm font-medium text-white bg-acc">
          <Plus size={13}/> Add Task
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: T.t1 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border p-6 font-dm text-sm" style={{ background: T.s1, borderColor: T.b1, color: T.t2 }}>
          Loading roadmap...
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[920px] grid-cols-4 gap-3">
          {COLS.map(col => (
            <div
              key={col.id}
              onDragOver={e => onDragOver(e, col.id)}
              onDrop={() => onDrop(col.id)}
              className={over === col.id ? "drag-over" : ""}
              style={{
                background: T.s1,
                border: `1px solid ${over === col.id ? T.accB : T.b1}`,
                borderRadius: 12, padding: 14, minHeight: 420,
                transition: "all .2s",
              }}
            >
              <div className="flex items-center gap-2 mb-3.5">
                <div style={{width:8,height:8,borderRadius:"50%",background:col.color,boxShadow:`0 0 8px ${col.color}55`}} aria-hidden="true"/>
                <span className="font-dm text-[13px] font-semibold">{col.label}</span>
                <span className="ml-auto font-syne text-[12px] font-bold px-1.5 py-0.5 rounded text-t3" style={{background:T.s3}}>
                  {cards.filter(c => c.col === col.id).length}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {cards.filter(c => c.col === col.id).map(card => (
                  <div
                    key={card.id}
                    draggable
                    aria-grabbed={dragging?.id === card.id}
                    onDragStart={() => onDragStart(card)}
                    onDragEnd={() => { setDragging(null); setOver(null) }}
                    style={{
                      background: dragging?.id === card.id ? T.s3 : T.s2,
                      border: `1px solid ${T.b2}`, borderRadius: 10, padding: 14,
                      opacity: dragging?.id === card.id ? 0.45 : 1,
                      transition: "all .15s", cursor: "grab",
                    }}
                    role="button"
                    aria-label={`${card.title} - ${card.client}`}
                  >
                    <div className="flex justify-between gap-2 mb-2.5">
                      <span className="font-dm text-[13px] leading-snug flex-1">{card.title}</span>
                      <MoreHorizontal size={14} style={{color:T.t3,flexShrink:0,marginTop:2}} aria-hidden="true"/>
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-dm text-[11px] px-2 py-0.5 rounded" style={{color:T.t2,background:T.s1,border:`1px solid ${T.b1}`}}>
                        {card.client}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-dm text-[10px] px-1.5 py-0.5 rounded" style={{color:T.t3,background:T.s1,border:`1px solid ${T.b1}`}}>
                          {card.tag}
                        </span>
                        <div style={{width:6,height:6,borderRadius:"50%",background:PRIORITY_COLOR[card.priority]}} aria-hidden="true"/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="w-full mt-2.5 py-2 rounded-lg font-dm text-xs flex items-center justify-center gap-1 transition-colors"
                style={{border:`1px dashed ${T.b1}`,color:T.t3,background:"none"}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=T.b2;(e.currentTarget as HTMLElement).style.color=T.t2}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=T.b1;(e.currentTarget as HTMLElement).style.color=T.t3}}
                aria-label={`Add task to ${col.label}`}
              >
                <Plus size={12}/> Add task
              </button>
            </div>
          ))}
        </div>
        </div>
      )}
    </div>
  )
}
