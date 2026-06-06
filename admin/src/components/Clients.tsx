"use client"

import { useState } from "react"
import Link from "next/link"
import { Plus, Users } from "lucide-react"

const T = { s1:"var(--s1)",s2:"var(--s2)",s3:"var(--s3)",b1:"var(--b1)",b2:"var(--b2)",t1:"var(--t1)",t2:"var(--t2)",t3:"var(--t3)",grn:"var(--grn)",amb:"var(--amb)" }

interface ClientRow {
  id: number
  name: string
  contactName: string | null
  tier: string | null
  mrr: number
  status: string
  progress: number
}

const STATUS_STYLE: Record<string,{bg:string;color:string;border:string}> = {
  active:  { bg:"rgba(16,185,129,.1)",  color:"var(--grn)", border:"rgba(16,185,129,.2)" },
  build:   { bg:"var(--acc-dim)",       color:"var(--acc)", border:"var(--acc-b)" },
  review:  { bg:"rgba(245,158,11,.1)",  color:"var(--amb)", border:"rgba(245,158,11,.2)" },
  prospect:{ bg:"rgba(255,255,255,.04)",color:"var(--t2)",  border:"var(--b1)" },
}

export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">Clients</h1>
          <p className="mt-1 font-dm text-sm" style={{ color: T.t2 }}>Live client records from the database.</p>
        </div>
        <Link href="/clients/new" className="flex items-center gap-1.5 rounded-lg bg-acc px-4 py-2 font-dm text-sm font-medium text-white">
          <Plus size={15} /> Add Client
        </Link>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-2xl border p-8" style={{ background: T.s1, borderColor: T.b1 }}>
          <Users size={20} className="mb-4 text-acc" aria-hidden="true" />
          <h2 className="font-syne text-xl font-bold">No clients yet</h2>
          <p className="mt-2 max-w-[520px] font-dm text-sm leading-relaxed" style={{ color: T.t2 }}>
            Add the first client to start tracking retainers, status, and delivery progress in the dashboard.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border" style={{ background: T.s1, borderColor: T.b1 }}>
          <div className="grid gap-0 border-b px-6 py-3" style={{ gridTemplateColumns:"2fr 1.2fr .9fr .9fr 1.8fr", borderColor:T.b1, background:T.s2 }}>
            {["Client","Tier","MRR","Progress","Status"].map((h) => (
              <div key={h} className="font-dm text-[11px] font-semibold uppercase tracking-[.07em]" style={{ color:T.t2 }}>{h}</div>
            ))}
          </div>
          {clients.map((client, index) => {
            const style = STATUS_STYLE[client.status] ?? STATUS_STYLE.prospect

            return (
              <div
                key={client.id}
                className="grid items-center px-6 py-4 transition-colors"
                style={{
                  gridTemplateColumns:"2fr 1.2fr .9fr .9fr 1.8fr",
                  borderBottom:index < clients.length - 1 ? `1px solid ${T.b1}` : "none",
                  background:hovered === client.id ? T.s2 : "transparent",
                }}
                onMouseEnter={() => setHovered(client.id)}
                onMouseLeave={() => setHovered(null)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-syne text-[13px] font-bold" style={{ background:T.s3, color:T.t2 }}>
                    {client.name[0]}
                  </div>
                  <div>
                    <div className="font-dm text-sm font-medium">{client.name}</div>
                    <div className="font-dm text-[11px]" style={{ color:T.t2 }}>{client.contactName ?? "No contact set"}</div>
                  </div>
                </div>
                <div className="font-dm text-sm" style={{ color:T.t2 }}>{client.tier ?? "No tier set"}</div>
                <div className="font-syne text-sm font-bold" style={{ color:client.mrr > 0 ? T.grn : T.t3 }}>
                  {client.mrr > 0 ? `GBP ${client.mrr}` : "Build"}
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background:T.s3 }}>
                    <div className="h-full rounded-full" style={{ width:`${client.progress}%`, background:client.status === "active" ? T.grn : client.status === "build" ? "var(--acc)" : T.amb }} />
                  </div>
                  <span className="shrink-0 font-dm text-[11px]" style={{ color:T.t2 }}>{client.progress}%</span>
                </div>
                <div>
                  <span className="rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:style.bg, color:style.color, border:`1px solid ${style.border}` }}>
                    {client.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
