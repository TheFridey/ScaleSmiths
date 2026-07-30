"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  BadgeCheck,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Gauge,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Target,
  UserCog,
  Users,
  X,
} from "lucide-react"
import { Logo } from "@/components/Logo"
import type { AdminRole } from "@/lib/admin-users"
import { isNavigationVisible, type Capability } from "@/lib/rbac"

const SIDEBAR_KEY = "scalesmiths-admin-sidebar"
const FOCUS_KEY = "scalesmiths-forge-focus-mode"

const NAV: Array<{ href: string; label: string; Icon: typeof LayoutDashboard; capability: Capability }> = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, capability: "projects.read" },
  { href: "/clients", label: "Clients", Icon: Users, capability: "clients.read" },
  { href: "/requests", label: "Requests", Icon: ClipboardList, capability: "clients.read" },
  { href: "/prospects", label: "Pipeline", Icon: Target, capability: "leads.read" },
  { href: "/forge", label: "Forge", Icon: Gauge, capability: "forge.read" },
  { href: "/operations/brief", label: "Brief", Icon: CalendarClock, capability: "projects.read" },
  { href: "/operations/capacity", label: "Capacity", Icon: CalendarClock, capability: "projects.read" },
  { href: "/operations/experience-analytics", label: "Experience", Icon: BarChart3, capability: "leads.read" },
  { href: "/roadmap", label: "Roadmap", Icon: GitBranch, capability: "projects.read" },
  { href: "/messages", label: "Messages", Icon: MessageSquare, capability: "clients.read" },
  { href: "/users", label: "Admin users", Icon: UserCog, capability: "users.manage" },
  { href: "/security", label: "Security", Icon: ShieldCheck, capability: "settings.manage" },
  { href: "/claims", label: "Claims", Icon: BadgeCheck, capability: "claims.read" },
]

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isForge = pathname === "/forge" || pathname.startsWith("/forge/")
  const [collapsed, setCollapsed] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [role, setRole] = useState<AdminRole | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const storedSidebar = window.localStorage.getItem(SIDEBAR_KEY)
    const storedFocus = window.localStorage.getItem(FOCUS_KEY)
    setCollapsed(storedSidebar ? storedSidebar === "collapsed" : isForge)
    setFocusMode(isForge && storedFocus === "enabled")
    setReady(true)
  }, [isForge])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    let active = true
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((session) => {
        if (active && session?.user?.role) setRole(session.user.role as AdminRole)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  const visibleNav = useMemo(
    () => NAV.filter((item) => role && isNavigationVisible(role, item.capability)),
    [role],
  )

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded")
      return next
    })
  }

  function toggleFocusMode() {
    setFocusMode((current) => {
      const next = !current
      window.localStorage.setItem(FOCUS_KEY, next ? "enabled" : "disabled")
      return next
    })
  }

  return (
    <div
      className="admin-shell"
      data-sidebar={ready && collapsed ? "collapsed" : "expanded"}
      data-focus-mode={isForge && focusMode ? "true" : "false"}
      data-forge-route={isForge ? "true" : "false"}
    >
      <AdminSidebar
        collapsed={collapsed}
        focusMode={isForge && focusMode}
        pathname={pathname}
        navigation={visibleNav}
        onCollapse={toggleCollapsed}
        onSignOut={() => void signOut({ redirectTo: "/login" })}
      />

      <AdminTopBar
        isForge={isForge}
        focusMode={isForge && focusMode}
        onOpenNavigation={() => setMobileOpen(true)}
        onToggleFocus={toggleFocusMode}
      />

      <main id="admin-main-content" className="admin-main" tabIndex={-1}>
        {children}
      </main>

      <MobileSheet open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigation">
        <NavigationList
          collapsed={false}
          pathname={pathname}
          navigation={visibleNav}
          onNavigate={() => setMobileOpen(false)}
        />
        <button type="button" className="admin-nav-link mt-auto" onClick={() => void signOut({ redirectTo: "/login" })}>
          <LogOut size={18} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </MobileSheet>
    </div>
  )
}

export function AdminSidebar({
  collapsed,
  focusMode,
  pathname,
  navigation,
  onCollapse,
  onSignOut,
}: {
  collapsed: boolean
  focusMode: boolean
  pathname: string
  navigation: typeof NAV
  onCollapse: () => void
  onSignOut: () => void
}) {
  return (
    <aside className="admin-sidebar" aria-label="Primary navigation" aria-hidden={focusMode || undefined}>
      <div className="admin-sidebar-brand">
        <Logo size={collapsed ? 30 : 24} compact={collapsed} />
        <button
          type="button"
          className="admin-icon-button admin-tooltip"
          onClick={onCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          data-tooltip={collapsed ? "Expand sidebar" : undefined}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
        </button>
      </div>
      <NavigationList collapsed={collapsed} pathname={pathname} navigation={navigation} />
      <button
        type="button"
        className={`admin-nav-link mt-auto ${collapsed ? "is-collapsed admin-tooltip" : ""}`}
        onClick={onSignOut}
        aria-label={collapsed ? "Sign out" : undefined}
        data-tooltip={collapsed ? "Sign out" : undefined}
      >
        <LogOut size={18} aria-hidden="true" />
        {!collapsed && <span>Sign out</span>}
      </button>
    </aside>
  )
}

function NavigationList({
  collapsed,
  pathname,
  navigation,
  onNavigate,
}: {
  collapsed: boolean
  pathname: string
  navigation: typeof NAV
  onNavigate?: () => void
}) {
  return (
    <nav className="admin-navigation">
      {navigation.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`admin-nav-link ${collapsed ? "is-collapsed admin-tooltip" : ""} ${active ? "is-active" : ""}`}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? label : undefined}
            data-tooltip={collapsed ? label : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            {!collapsed && <span>{label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export function AdminTopBar({
  isForge,
  focusMode,
  onOpenNavigation,
  onToggleFocus,
}: {
  isForge: boolean
  focusMode: boolean
  onOpenNavigation: () => void
  onToggleFocus: () => void
}) {
  return (
    <header className="admin-topbar">
      <a className="skip-link" href="#admin-main-content">Skip to content</a>
      <button type="button" className="admin-icon-button admin-mobile-menu" onClick={onOpenNavigation} aria-label="Open navigation">
        <Menu size={20} aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <p className="admin-topbar-eyebrow">{isForge ? "Production workspace" : "ScaleSmiths"}</p>
        <p className="admin-topbar-title">{isForge ? "Forge" : "Operations"}</p>
      </div>
      {isForge && (
        <button
          type="button"
          className={`admin-focus-toggle ${focusMode ? "is-active" : ""}`}
          onClick={onToggleFocus}
          aria-pressed={focusMode}
        >
          {focusMode ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
          <span>{focusMode ? "Exit focus" : "Focus mode"}</span>
        </button>
      )}
    </header>
  )
}

export function MobileSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose, open])

  if (!open) return null
  return (
    <div className="mobile-sheet-layer">
      <button type="button" className="mobile-sheet-backdrop" onClick={onClose} aria-label="Close navigation" />
      <aside className="mobile-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mobile-sheet-header">
          <Logo size={24} />
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close navigation">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
    </div>
  )
}
