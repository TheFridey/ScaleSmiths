"use client"

import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { ClipboardList, FileText, Folder, LayoutDashboard, LogOut, MessageSquare, Columns3 } from "lucide-react"
import { Logo } from "@/components/Logo"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard },
  { id: "board", label: "Board", Icon: Columns3 },
  { id: "files", label: "Files", Icon: Folder },
  { id: "messages", label: "Messages", Icon: MessageSquare },
  { id: "requests", label: "Requests", Icon: ClipboardList },
  { id: "reports", label: "Reports", Icon: FileText },
  { id: "invoices", label: "Invoices", Icon: FileText },
]

interface PortalNavProps {
  clientId: string
  clientName: string
  tier: string
  price: string
}

export function PortalNav({ clientId, clientName, tier, price }: PortalNavProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const active = searchParams.get("tab") ?? "overview"

  async function logout() {
    await fetch("/portal/api/logout", { method: "POST" })
    router.push("/portal/login")
    router.refresh()
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-b1 bg-s1 p-4 md:min-h-screen md:w-[260px] md:border-b-0 md:border-r">
      <div className="px-2 py-3">
        <Logo size={25} href="/" />
        <div className="mt-7">
          <div className="font-dm text-xs uppercase tracking-[0.12em] text-t3">Client</div>
          <div className="mt-1 font-syne text-xl font-bold text-t1">{clientName}</div>
        </div>
      </div>

      <nav className="mt-7 flex gap-1 overflow-x-auto md:flex-col md:overflow-visible" aria-label="Portal navigation">
        {TABS.map(({ id, label, Icon }) => {
          const selected = active === id
          return (
            <Link
              key={id}
              href={`/portal/${clientId}?tab=${id}`}
              prefetch={false}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2.5 font-dm text-[13px] transition-colors",
                selected
                  ? "border-b2 bg-s2 text-t1"
                  : "border-transparent text-t2 hover:border-b1 hover:bg-s2/50 hover:text-t1",
              )}
              aria-current={selected ? "page" : undefined}
            >
              <Icon size={15} className={selected ? "text-acc" : "text-t2"} aria-hidden="true" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 md:mt-auto">
        <div className="rounded-xl border border-acc/20 bg-acc/10 p-4">
          <div className="font-dm text-[11px] text-t2">Retainer</div>
          <div className="mt-1 font-syne text-base font-bold text-t1">{tier}</div>
          <div className="mt-2 font-syne text-2xl font-extrabold text-acc">{price}</div>
        </div>
        <button
          onClick={logout}
          className="mt-3 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 font-dm text-[13px] text-t2 transition-colors hover:bg-s2 hover:text-t1"
        >
          <LogOut size={15} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
