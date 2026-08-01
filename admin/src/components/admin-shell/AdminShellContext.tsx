"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

const SIDEBAR_KEY = "scalesmiths-admin-sidebar"
const FOCUS_KEY = "scalesmiths-forge-focus-mode"

interface AdminShellContextValue {
  isForgeRoute: boolean
  focusMode: boolean
  enterFocusMode: () => void
  exitFocusMode: () => void
  toggleFocusMode: () => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  ready: boolean
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null)

export function AdminShellProvider({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const isForgeRoute = pathname === "/forge" || pathname.startsWith("/forge/")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [focusPreference, setFocusPreference] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const storedSidebar = window.localStorage.getItem(SIDEBAR_KEY)
    const storedFocus = window.localStorage.getItem(FOCUS_KEY)
    setSidebarCollapsed(storedSidebar ? storedSidebar === "collapsed" : isForgeRoute)
    setFocusPreference(storedFocus === "enabled")
    setReady(true)
  }, [isForgeRoute])

  const setPersistedFocus = useCallback((enabled: boolean) => {
    setFocusPreference(enabled)
    window.localStorage.setItem(FOCUS_KEY, enabled ? "enabled" : "disabled")
  }, [])

  const enterFocusMode = useCallback(() => setPersistedFocus(true), [setPersistedFocus])
  const exitFocusMode = useCallback(() => setPersistedFocus(false), [setPersistedFocus])
  const toggleFocusMode = useCallback(() => setFocusPreference((current) => {
    const next = !current
    window.localStorage.setItem(FOCUS_KEY, next ? "enabled" : "disabled")
    return next
  }), [])
  const toggleSidebar = useCallback(() => setSidebarCollapsed((current) => {
    const next = !current
    window.localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "expanded")
    return next
  }), [])

  const value = useMemo<AdminShellContextValue>(() => ({
    isForgeRoute,
    focusMode: isForgeRoute && focusPreference,
    enterFocusMode,
    exitFocusMode,
    toggleFocusMode,
    sidebarCollapsed,
    toggleSidebar,
    ready,
  }), [enterFocusMode, exitFocusMode, focusPreference, isForgeRoute, ready, sidebarCollapsed, toggleFocusMode, toggleSidebar])

  return <AdminShellContext.Provider value={value}>{children}</AdminShellContext.Provider>
}

export function useAdminShell() {
  const context = useContext(AdminShellContext)
  if (!context) throw new Error("useAdminShell must be used within AdminShellProvider")
  return context
}
