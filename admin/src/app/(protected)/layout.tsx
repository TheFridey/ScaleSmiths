"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  ClipboardList,
  Gauge,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Target,
  Users,
  UserCog,
  ShieldCheck,
} from "lucide-react"
import { Logo } from "@/components/Logo"
import { isNavigationVisible, type Capability } from "@/lib/rbac"
import type { AdminRole } from "@/lib/admin-users"

const NAV: Array<{ href: string; label: string; Icon: typeof LayoutDashboard; capability: Capability }> = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, capability: "projects.read" },
  { href: "/clients", label: "Clients", Icon: Users, capability: "clients.read" },
  { href: "/requests", label: "Requests", Icon: ClipboardList, capability: "clients.read" },
  { href: "/prospects", label: "Pipeline", Icon: Target, capability: "leads.read" },
  { href: "/forge", label: "Forge", Icon: Gauge, capability: "forge.read" },
  { href: "/roadmap", label: "Roadmap", Icon: GitBranch, capability: "projects.read" },
  { href: "/messages", label: "Messages", Icon: MessageSquare, capability: "clients.read" },
  { href: "/users", label: "Admin users", Icon: UserCog, capability: "users.manage" },
  { href: "/security", label: "Security", Icon: ShieldCheck, capability: "settings.manage" },
]

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)
  const [compactViewport, setCompactViewport] = useState(false)
  const [role, setRole] = useState<AdminRole | null>(null)

  useEffect(() => {
    const updateViewport = () => setCompactViewport(window.innerWidth < 640)
    const stored = window.localStorage.getItem("scalesmiths-admin-sidebar")
    updateViewport()
    setCollapsed(stored ? stored === "collapsed" : window.innerWidth < 1024)
    window.addEventListener("resize", updateViewport)
    return () => window.removeEventListener("resize", updateViewport)
  }, [])

  useEffect(() => {
    let active = true
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => { if (active && session?.user?.role) setRole(session.user.role as AdminRole) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value
      window.localStorage.setItem("scalesmiths-admin-sidebar", next ? "collapsed" : "expanded")
      return next
    })
  }

  const logout = async () => {
    await signOut({ redirectTo: "/login" })
  }

  return (
    <div className="flex min-h-screen overflow-hidden">
      <aside
        className="sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden p-3 transition-[width] duration-200"
        style={{ width: collapsed ? compactViewport ? 56 : 72 : 220, background: "rgba(2,6,23,.72)", borderRight: "1px solid rgba(148,163,184,.14)", backdropFilter: "blur(18px)" }}
      >
        <div className={`mb-4 flex items-center gap-2 px-1 py-2 ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className={collapsed ? "w-8 overflow-hidden" : "min-w-0"}>
            <Logo size={collapsed ? 28 : 24} compact={collapsed} />
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
              style={{ background: "var(--s2)", borderColor: "var(--b1)", color: "var(--t2)" }}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="mb-3 inline-flex h-9 w-full items-center justify-center rounded-lg border"
            style={{ background: "var(--s2)", borderColor: "var(--b1)", color: "var(--t2)" }}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={15} aria-hidden="true" />
          </button>
        )}

        <nav className="flex flex-col gap-1.5">
          {NAV.filter((item) => role && isNavigationVisible(role, item.capability)).map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-10 items-center gap-2.5 rounded-lg font-dm text-[13px] transition-colors ${
                  collapsed ? "justify-center px-0" : "px-3"
                }`}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                title={collapsed ? label : undefined}
                style={{
                  background: active ? "rgba(15,23,42,.88)" : "none",
                  border: active ? "1px solid rgba(56,189,248,.22)" : "1px solid transparent",
                  fontWeight: active ? 500 : 400,
                  color: active ? "var(--t1)" : "var(--t2)",
                }}
              >
                <Icon size={15} style={{ color: active ? "#22d3ee" : "var(--t2)" }} aria-hidden="true" />
                {!collapsed && label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto pt-3">
          {!collapsed && (
            <div className="mb-3 rounded-lg p-3.5" style={{ background: "var(--acc-dim)", border: "1px solid var(--acc-b)" }}>
              <div className="mb-1 font-dm text-[11px]" style={{ color: "var(--t2)" }}>Monthly MRR</div>
              <div className="font-syne text-[22px] font-extrabold">GBP 3,500</div>
            </div>
          )}
          <button
            onClick={logout}
            className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg font-dm text-[13px] transition-colors ${
              collapsed ? "justify-center px-0" : "px-3"
            }`}
            style={{ color: "var(--t2)" }}
            aria-label={collapsed ? "Sign out" : undefined}
            title={collapsed ? "Sign out" : undefined}
          >
            <LogOut size={15} aria-hidden="true" /> {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <main className="h-screen min-w-0 flex-1 overflow-auto p-2 sm:p-3 lg:p-5">{children}</main>
    </div>
  )
}
