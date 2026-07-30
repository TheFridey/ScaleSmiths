import { useEffect, useRef } from "react"
import type { LucideIcon } from "lucide-react"
import { AlertCircle, Inbox, LoaderCircle, X } from "lucide-react"

export function WorkspaceShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`workspace-shell ${className}`}>{children}</div>
}

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
  leading,
  actions,
  meta,
}: {
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  leading?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
}) {
  return (
    <header className="workspace-header">
      <div className="workspace-heading">
        {leading}
        <div className="min-w-0">
          {eyebrow && <p className="workspace-eyebrow">{eyebrow}</p>}
          <h1 className="workspace-title">{title}</h1>
          {description && <div className="workspace-description">{description}</div>}
          {meta && <div className="workspace-meta">{meta}</div>}
        </div>
      </div>
      {actions && <div className="workspace-actions">{actions}</div>}
    </header>
  )
}

export function WorkspaceToolbar({ children, label = "Workspace tools" }: { children: React.ReactNode; label?: string }) {
  return <div className="workspace-toolbar" role="toolbar" aria-label={label}>{children}</div>
}

export function PageSection({
  title,
  description,
  actions,
  children,
  raised = false,
  className = "",
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  raised?: boolean
  className?: string
}) {
  return (
    <section className={`page-section ${raised ? "is-raised" : ""} ${className}`}>
      {(title || description || actions) && (
        <div className="page-section-header">
          <div>
            {title && <h2 className="page-section-title">{title}</h2>}
            {description && <div className="page-section-description">{description}</div>}
          </div>
          {actions && <div className="page-section-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function MetricSummary({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  tone?: "default" | "positive" | "warning" | "critical" | "accent"
}) {
  return (
    <div className={`metric-summary tone-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
    </div>
  )
}

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode
  tone?: "neutral" | "info" | "success" | "warning" | "danger"
}) {
  return <span className={`status-badge tone-${tone}`}>{children}</span>
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string; Icon?: LucideIcon }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="segmented-control" role="tablist" aria-label={label}>
      {options.map(({ value: option, label: optionLabel, Icon }) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          className={value === option ? "is-active" : ""}
          onClick={() => onChange(option)}
        >
          {Icon && <Icon size={16} aria-hidden="true" />}
          <span>{optionLabel}</span>
        </button>
      ))}
    </div>
  )
}

function Drawer({
  open,
  title,
  onClose,
  children,
  side,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  side: "left" | "right"
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose, open])

  if (!open) return null
  return (
    <div className="context-drawer-layer">
      <button type="button" className="context-drawer-backdrop" onClick={onClose} aria-label={`Close ${title}`} />
      <aside className={`context-drawer from-${side}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="context-drawer-header">
          <h2>{title}</h2>
          <button ref={closeButtonRef} type="button" className="admin-icon-button" onClick={onClose} aria-label={`Close ${title}`}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="context-drawer-body">{children}</div>
      </aside>
    </div>
  )
}

export function ContextDrawer(props: Omit<React.ComponentProps<typeof Drawer>, "side">) {
  return <Drawer {...props} side="left" />
}

export function DetailDrawer(props: Omit<React.ComponentProps<typeof Drawer>, "side">) {
  return <Drawer {...props} side="right" />
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="empty-state">
      <Inbox size={24} aria-hidden="true" />
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function InlineAlert({
  children,
  tone = "info",
}: {
  children: React.ReactNode
  tone?: "info" | "warning" | "danger" | "success"
}) {
  return (
    <div className={`inline-alert tone-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <AlertCircle size={18} aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}

export function CommandBar({ children }: { children: React.ReactNode }) {
  return <div className="command-bar">{children}</div>
}

export function ResponsiveDataTable({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="responsive-data-table" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  )
}
