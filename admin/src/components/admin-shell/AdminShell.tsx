"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  BadgeCheck,
  BarChart3,
  CalendarClock,
  ClipboardList,
  Gauge,
  ReceiptText,
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
import { AdminShellProvider, useAdminShell } from "./AdminShellContext"

const NAV: Array<{ href: string; label: string; Icon: typeof LayoutDashboard; capability: Capability }> = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, capability: "projects.read" },
  { href: "/clients", label: "Clients", Icon: Users, capability: "clients.read" },
  { href: "/finance/invoices", label: "Invoices", Icon: ReceiptText, capability: "finance.read" },
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
  return <AdminShellProvider pathname={pathname}><AdminShellFrame pathname={pathname}>{children}</AdminShellFrame></AdminShellProvider>
}

function AdminShellFrame({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { isForgeRoute, focusMode, sidebarCollapsed, toggleSidebar, toggleFocusMode, ready } = useAdminShell()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [role, setRole] = useState<AdminRole | null>(null)

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

  async function handleSignOut() {
    try {
      await fetch("/api/security/logout", { method: "POST" })
    } finally {
      await signOut({ redirect: false })
      window.location.assign("/login")
    }
  }

  return (
    <div
      className="admin-shell"
      data-sidebar={ready && sidebarCollapsed ? "collapsed" : "expanded"}
      data-focus-mode={focusMode ? "true" : "false"}
      data-forge-route={isForgeRoute ? "true" : "false"}
    >
      <AdminSidebar
        collapsed={sidebarCollapsed}
        focusMode={focusMode}
        pathname={pathname}
        navigation={visibleNav}
        onCollapse={toggleSidebar}
        onSignOut={() => void handleSignOut()}
      />

      <AdminTopBar
        isForge={isForgeRoute}
        focusMode={focusMode}
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
        <button type="button" className="admin-nav-link mt-auto" onClick={() => void handleSignOut()}>
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
  const layerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const layer = layerRef.current
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const background = Array.from(document.body.children).filter((element) => element !== layer)
    const inertStates = background.map((element) => ({ element: element as HTMLElement, inert: (element as HTMLElement).inert }))
    for (const { element } of inertStates) element.inert = true

    const focusable = () => Array.from(layer?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true")
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== "Tab") return
      const controls = focusable()
      if (!controls.length) {
        event.preventDefault()
        layer?.focus()
        return
      }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || !layer?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(focusFrame)
      window.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      for (const { element, inert } of inertStates) element.inert = inert
      restoreFocusRef.current?.focus()
      restoreFocusRef.current = null
    }
  }, [onClose, open])

  if (!open) return null
  return createPortal(
    <div className="mobile-sheet-layer" ref={layerRef} tabIndex={-1}>
      <button type="button" className="mobile-sheet-backdrop" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`} tabIndex={-1} />
      <aside className="mobile-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="mobile-sheet-header">
          <h2 id={titleId} className="admin-topbar-title">{title}</h2>
          <button ref={closeButtonRef} type="button" className="admin-icon-button" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}
