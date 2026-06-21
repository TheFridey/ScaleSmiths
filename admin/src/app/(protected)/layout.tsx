"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { LayoutDashboard, Users, GitBranch, MessageSquare, LogOut, Target, Gauge } from "lucide-react"
import { Logo } from "@/components/Logo"

const NAV = [
  { href:"/dashboard", label:"Dashboard", Icon:LayoutDashboard },
  { href:"/clients",   label:"Clients",   Icon:Users           },
  { href:"/prospects", label:"Pipeline",  Icon:Target          },
  { href:"/forge",     label:"Forge",     Icon:Gauge           },
  { href:"/roadmap",   label:"Roadmap",   Icon:GitBranch       },
  { href:"/messages",  label:"Messages",  Icon:MessageSquare   },
]

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const logout = async () => {
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="flex min-h-screen" style={{ background:"var(--bg)" }}>
      <aside style={{ width:220, background:"var(--s1)", borderRight:"1px solid var(--b1)" }}
        className="flex flex-col p-3.5 shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="px-2.5 py-3 mb-6">
          <Logo size={24} />
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href
            return (
              <Link key={href} href={href}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-dm text-[13px] transition-colors"
                aria-current={active ? "page" : undefined}
                style={{
                  background: active ? "var(--s2)" : "none",
                  border:     active ? "1px solid var(--b2)" : "1px solid transparent",
                  fontWeight: active ? 500 : 400,
                  color:      active ? "var(--t1)" : "var(--t2)",
                }}>
                <Icon size={15} style={{ color: active ? "var(--acc)" : "var(--t2)" }} aria-hidden="true"/>
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="mt-auto">
          <div className="rounded-xl p-3.5 mb-3" style={{ background:"var(--acc-dim)", border:"1px solid var(--acc-b)" }}>
            <div className="font-dm text-[11px] mb-1" style={{ color:"var(--t2)" }}>Monthly MRR</div>
            <div className="font-syne text-[22px] font-extrabold">£3,500</div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg font-dm text-[13px] transition-colors"
            style={{ color:"var(--t2)" }}>
            <LogOut size={15} aria-hidden="true"/> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
