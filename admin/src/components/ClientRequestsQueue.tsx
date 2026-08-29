"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Copy,
  FileText,
  Loader2,
  LockKeyhole,
  MessageSquare,
  RotateCcw,
  Save,
  Search,
  Send,
  Sparkles,
} from "lucide-react"
import {
  CATEGORY_LABELS,
  CLIENT_REQUEST_CATEGORIES,
  CLIENT_REQUEST_PRIORITIES,
  CLIENT_REQUEST_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  type ClientRequestCategory,
  type ClientRequestPriority,
  type ClientRequestStatus,
} from "@/lib/client-requests"
import { MONTHLY_REPORT_STATUS_LABELS } from "@/lib/monthly-reports"
import { useRequestMonthlyReports } from "@/components/client-requests/useRequestMonthlyReports"

const T = {
  s1: "var(--s1)",
  s2: "var(--s2)",
  s3: "var(--s3)",
  b1: "var(--b1)",
  b2: "var(--b2)",
  t1: "var(--t1)",
  t2: "var(--t2)",
  t3: "var(--t3)",
  acc: "var(--acc)",
  grn: "var(--grn)",
  amb: "var(--amb)",
  red: "var(--red)",
}

export interface AdminClientRequestRow {
  id: number
  clientId: string
  title: string
  description: string
  category: ClientRequestCategory
  priority: ClientRequestPriority
  status: ClientRequestStatus
  affectedUrl: string | null
  pageUrl: string | null
  internalNotes: string | null
  forgeSummary: string | null
  forgeSuggestedActions: string | null
  forgeSuggestedReply: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
  adminLastReadAt: string | null
  messages: AdminRequestMessage[]
  timelineEvents: AdminTimelineEvent[]
}

export interface AdminRequestMessage {
  id: number
  requestId: number
  senderType: "client" | "admin" | "system"
  senderName: string
  body: string
  visibility: "client_visible" | "internal"
  createdAt: string
  updatedAt: string | null
}

export interface AdminTimelineEvent {
  id: number
  clientId: string
  requestId: number | null
  projectId: number | null
  type: string
  title: string
  description: string
  visibility: "client_visible" | "internal"
  createdBy: string
  createdAt: string
}

export interface AdminMonthlyReport {
  id: number
  clientId: string
  month: number
  year: number
  title: string
  summary: string
  htmlContent: string
  status: "draft" | "published"
  generatedBy: "forge" | "manual"
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

interface Props {
  initialRequests: AdminClientRequestRow[]
  loadError: string | null
  initialSelectedId?: number | null
}

type FilterValue<TValue extends string> = "all" | TValue

const OPEN_STATUSES = new Set<ClientRequestStatus>(["new", "triaged", "in_progress", "waiting_client"])

const PRIORITY_STYLE: Record<ClientRequestPriority, { color: string; border: string; bg: string }> = {
  low: { color: T.t2, border: T.b1, bg: "rgba(255,255,255,.035)" },
  medium: { color: T.acc, border: "var(--acc-b)", bg: "var(--acc-dim)" },
  high: { color: T.amb, border: "rgba(245,158,11,.24)", bg: "rgba(245,158,11,.1)" },
  critical: { color: T.red, border: "rgba(239,68,68,.26)", bg: "rgba(239,68,68,.1)" },
}

const STATUS_STYLE: Record<ClientRequestStatus, { color: string; border: string; bg: string }> = {
  new: { color: T.acc, border: "var(--acc-b)", bg: "var(--acc-dim)" },
  triaged: { color: T.amb, border: "rgba(245,158,11,.24)", bg: "rgba(245,158,11,.1)" },
  in_progress: { color: "#22d3ee", border: "rgba(34,211,238,.24)", bg: "rgba(34,211,238,.09)" },
  waiting_client: { color: T.amb, border: "rgba(245,158,11,.24)", bg: "rgba(245,158,11,.1)" },
  completed: { color: T.grn, border: "rgba(16,185,129,.24)", bg: "rgba(16,185,129,.1)" },
  cancelled: { color: T.t2, border: T.b1, bg: "rgba(255,255,255,.035)" },
}

function formatDate(value: string | null) {
  if (!value) return "Not set"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatDateTime(value: string | null) {
  if (!value) return "Not set"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function compactText(value: string | null | undefined) {
  return value?.trim() || "Not populated yet."
}

// Only treat client-supplied URLs as clickable when they are http(s) or root-relative.
// Prevents stored javascript:/data: values from becoming executable admin links.
function safeHref(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("/")) return trimmed
  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

function isThisMonth(value: string | null) {
  if (!value) return false
  const date = new Date(value)
  const now = new Date()
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
}

function hasUnreadClientMessage(request: AdminClientRequestRow) {
  const lastRead = request.adminLastReadAt ? new Date(request.adminLastReadAt).getTime() : 0
  return request.messages.some((message) => message.senderType === "client" && new Date(message.createdAt).getTime() > lastRead)
}

function Badge({ children, style }: { children: React.ReactNode; style: { color: string; border: string; bg: string } }) {
  return (
    <span
      className="inline-flex min-h-6 items-center rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]"
      style={{ color: style.color, border: `1px solid ${style.border}`, background: style.bg }}
    >
      {children}
    </span>
  )
}

function SummaryCard({ label, value, sub, tone = T.acc }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="flex min-h-[106px] flex-col justify-between rounded-[8px] border p-4" style={{ background: T.s1, borderColor: T.b1 }}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-dm text-xs" style={{ color: T.t2 }}>{label}</span>
        <span className="h-2 w-2 rounded-full" style={{ background: tone }} aria-hidden="true" />
      </div>
      <div>
        <div className="font-syne text-[22px] font-extrabold">{value}</div>
        <div className="mt-1 line-clamp-2 font-dm text-[11px]" style={{ color: T.t3 }}>{sub}</div>
      </div>
    </div>
  )
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[8px] border p-6" style={{ background: T.s1, borderColor: T.b1 }}>
      <ClipboardList size={20} className="mb-3 text-acc" aria-hidden="true" />
      <h2 className="font-syne text-lg font-bold">{title}</h2>
      <p className="mt-2 max-w-[580px] font-dm text-sm leading-relaxed" style={{ color: T.t2 }}>{text}</p>
    </div>
  )
}

export function ClientRequestsQueue({ initialRequests, loadError, initialSelectedId = null }: Props) {
  const [requests, setRequests] = useState(initialRequests)
  const [selectedId, setSelectedId] = useState<number | null>(
    initialSelectedId && initialRequests.some((request) => request.id === initialSelectedId)
      ? initialSelectedId
      : initialRequests[0]?.id ?? null,
  )
  const [statusFilter, setStatusFilter] = useState<FilterValue<ClientRequestStatus>>("all")
  const [priorityFilter, setPriorityFilter] = useState<FilterValue<ClientRequestPriority>>("all")
  const [categoryFilter, setCategoryFilter] = useState<FilterValue<ClientRequestCategory>>("all")
  const [clientFilter, setClientFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [draft, setDraft] = useState<{
    status: ClientRequestStatus
    priority: ClientRequestPriority
    category: ClientRequestCategory
  } | null>(null)
  const [internalNote, setInternalNote] = useState("")
  const [clientReply, setClientReply] = useState("")
  const [timelineTitle, setTimelineTitle] = useState("")
  const [timelineDescription, setTimelineDescription] = useState("")
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const clients = useMemo(() => Array.from(new Set(requests.map((request) => request.clientId))).sort(), [requests])

  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false
      if (priorityFilter !== "all" && request.priority !== priorityFilter) return false
      if (categoryFilter !== "all" && request.category !== categoryFilter) return false
      if (clientFilter !== "all" && request.clientId !== clientFilter) return false
      if (!needle) return true

      return [
        request.title,
        request.description,
        request.clientId,
        request.affectedUrl ?? "",
        request.pageUrl ?? "",
      ].some((value) => value.toLowerCase().includes(needle))
    })
  }, [categoryFilter, clientFilter, priorityFilter, requests, search, statusFilter])

  const selected = requests.find((request) => request.id === selectedId) ?? filteredRequests[0] ?? requests[0] ?? null
  const {
    reportMonth, setReportMonth, reportYear, setReportYear,
    monthlyReports, activeReport, reportDraft, setReportDraft, selectReport,
    generateMonthlyReport, saveReport, publishReport,
  } = useRequestMonthlyReports({ selected, setRequests, setBusyAction, setActionError })

  useEffect(() => {
    if (!selected) {
      setDraft(null)
      return
    }

    setDraft({
      status: selected.status,
      priority: selected.priority,
      category: selected.category,
    })
    setInternalNote("")
    setClientReply("")
    setTimelineTitle("")
    setTimelineDescription("")
    setActionError(null)
  }, [selected])

  useEffect(() => {
    const current = requests.find((request) => request.id === selectedId)
    if (!current || !hasUnreadClientMessage(current)) return

    void fetch(`/api/client-requests/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markRead" }),
    }).then((response) => response.json()).then((json) => {
      if (json?.ok && json.request) {
        setRequests((current) => current.map((request) => (request.id === json.request.id ? { ...request, adminLastReadAt: json.request.adminLastReadAt } : request)))
      }
    }).catch(() => undefined)
  }, [selectedId])

  const summary = useMemo(() => {
    const openRequests = requests.filter((request) => OPEN_STATUSES.has(request.status))
    const oldest = openRequests.reduce<AdminClientRequestRow | null>((current, request) => {
      if (!current) return request
      return new Date(request.createdAt).getTime() < new Date(current.createdAt).getTime() ? request : current
    }, null)

    return {
      criticalOpen: openRequests.filter((request) => request.priority === "critical").length,
      newRequests: requests.filter((request) => request.status === "new").length,
      inProgress: requests.filter((request) => request.status === "in_progress").length,
      waitingClient: requests.filter((request) => request.status === "waiting_client").length,
      completedThisMonth: requests.filter((request) => request.status === "completed" && isThisMonth(request.completedAt)).length,
      oldest,
    }
  }, [requests])

  async function updateRequest(payload: Record<string, unknown>, actionLabel: string) {
    if (!selected) return

    setBusyAction(actionLabel)
    setActionError(null)

    try {
      const response = await fetch(`/api/client-requests/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await response.json().catch(() => null)

      if (!response.ok || !json?.ok) {
        throw new Error(json?.error ?? "Unable to update this request.")
      }

      const updated = json.request as AdminClientRequestRow
      const timelineEvent = json.timelineEvent as AdminTimelineEvent | null | undefined
      setRequests((current) => current.map((request) => (
        request.id === updated.id
          ? {
            ...request,
            ...updated,
            messages: request.messages,
            timelineEvents: timelineEvent ? [...request.timelineEvents, timelineEvent] : request.timelineEvents,
          }
          : request
      )))
      setSelectedId(updated.id)
      setInternalNote("")
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update this request.")
    } finally {
      setBusyAction(null)
    }
  }

  function saveChanges() {
    if (!draft) return
    return updateRequest({
      action: "update",
      status: draft.status,
      priority: draft.priority,
      category: draft.category,
    }, "save")
  }

  async function sendRequestMessage(visibility: AdminRequestMessage["visibility"], messageBody: string, actionLabel: string) {
    if (!selected) return
    const trimmed = messageBody.trim()
    if (!trimmed) return

    setBusyAction(actionLabel)
    setActionError(null)

    try {
      const response = await fetch(`/api/client-requests/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility, body: trimmed }),
      })
      const json = await response.json().catch(() => null)

      if (!response.ok || !json?.ok || !json.message || !json.request) {
        throw new Error(json?.error ?? "Unable to send this message.")
      }

      const message = json.message as AdminRequestMessage
      const updated = json.request as AdminClientRequestRow
      const timelineEvent = json.timelineEvent as AdminTimelineEvent | null | undefined

      setRequests((current) => current.map((request) => (
        request.id === selected.id
          ? {
            ...request,
            ...updated,
            messages: [...request.messages, message],
            timelineEvents: timelineEvent ? [...request.timelineEvents, timelineEvent] : request.timelineEvents,
          }
          : request
      )))
      setSelectedId(selected.id)
      if (visibility === "client_visible") setClientReply("")
      if (visibility === "internal") setInternalNote("")
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to send this message.")
    } finally {
      setBusyAction(null)
    }
  }

  async function addTimelineUpdate(visibility: AdminTimelineEvent["visibility"], actionLabel: string) {
    if (!selected) return

    setBusyAction(actionLabel)
    setActionError(null)

    try {
      const response = await fetch(`/api/client-requests/${selected.id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: timelineTitle,
          description: timelineDescription,
          visibility,
        }),
      })
      const json = await response.json().catch(() => null)

      if (!response.ok || !json?.ok || !json.timelineEvent) {
        throw new Error(json?.error ?? "Unable to add this timeline update.")
      }

      const timelineEvent = json.timelineEvent as AdminTimelineEvent
      setRequests((current) => current.map((request) => (
        request.id === selected.id
          ? { ...request, timelineEvents: [...request.timelineEvents, timelineEvent], updatedAt: timelineEvent.createdAt }
          : request
      )))
      setTimelineTitle("")
      setTimelineDescription("")
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to add this timeline update.")
    } finally {
      setBusyAction(null)
    }
  }

  async function copySuggestion(label: string, value: string | null) {
    const text = value?.trim()
    if (!text) return

    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(label)
      setTimeout(() => setCopiedField(null), 1500)
    } catch {
      setActionError("Unable to copy to clipboard.")
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 rounded-[8px] border p-3 sm:p-4 lg:p-5" style={{ background: "rgba(2,6,23,.58)", borderColor: "rgba(56,189,248,.18)", boxShadow: "0 24px 80px rgba(0,0,0,.28)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">Client Requests</h1>
          <p className="mt-1 max-w-[720px] font-dm text-sm leading-relaxed" style={{ color: T.t2 }}>
            Admin queue for client work requests, support issues, and internal triage notes.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-[8px] border px-3 py-2 font-dm text-xs" style={{ background: T.s1, borderColor: T.b1, color: T.t2 }}>
          <Clock3 size={14} aria-hidden="true" />
          {requests.length} total
        </div>
      </div>

      {loadError ? (
        <div className="rounded-[8px] border p-5" style={{ background: "rgba(239,68,68,.08)", borderColor: "rgba(239,68,68,.24)" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} style={{ color: T.red }} aria-hidden="true" />
            <div>
              <h2 className="font-syne text-lg font-bold">Request queue unavailable</h2>
              <p className="mt-1 font-dm text-sm leading-relaxed" style={{ color: T.t2 }}>{loadError}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard label="Critical open" value={String(summary.criticalOpen)} sub="Open requests marked critical" tone={T.red} />
            <SummaryCard label="New" value={String(summary.newRequests)} sub="Awaiting first triage" tone={T.acc} />
            <SummaryCard label="In progress" value={String(summary.inProgress)} sub="Currently being worked" tone="#22d3ee" />
            <SummaryCard label="Waiting client" value={String(summary.waitingClient)} sub="Needs a client reply" tone={T.amb} />
            <SummaryCard label="Completed month" value={String(summary.completedThisMonth)} sub="Completed this calendar month" tone={T.grn} />
            <SummaryCard
              label="Oldest unresolved"
              value={summary.oldest ? formatDate(summary.oldest.createdAt) : "None"}
              sub={summary.oldest?.title ?? "No unresolved requests"}
              tone={summary.oldest ? T.amb : T.grn}
            />
          </div>

          {requests.length === 0 ? (
            <EmptyPanel title="No client requests yet" text="Requests submitted from the client portal will appear here for triage and follow-up." />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,.75fr)]">
              <section className="min-w-0 rounded-[8px] border" style={{ background: T.s1, borderColor: T.b1 }}>
                <div className="border-b p-3 sm:p-4" style={{ borderColor: T.b1 }}>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_.9fr_.9fr_1fr_1fr]">
                    <label className="relative block">
                      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.t3 }} aria-hidden="true" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search requests"
                        className="pl-9"
                        aria-label="Search by title, description, client, or URL"
                      />
                    </label>
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterValue<ClientRequestStatus>)} aria-label="Filter by status">
                      <option value="all">All statuses</option>
                      {CLIENT_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                    </select>
                    <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as FilterValue<ClientRequestPriority>)} aria-label="Filter by priority">
                      <option value="all">All priorities</option>
                      {CLIENT_REQUEST_PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
                    </select>
                    <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as FilterValue<ClientRequestCategory>)} aria-label="Filter by category">
                      <option value="all">All categories</option>
                      {CLIENT_REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
                    </select>
                    <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} aria-label="Filter by client">
                      <option value="all">All clients</option>
                      {clients.map((clientId) => <option key={clientId} value={clientId}>{clientId}</option>)}
                    </select>
                  </div>
                </div>

                {filteredRequests.length === 0 ? (
                  <div className="p-4">
                    <EmptyPanel title="No matching requests" text="Adjust the filters or search term to widen the queue." />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <div className="min-w-[1060px]">
                      <div className="grid border-b px-4 py-3 font-dm text-[11px] font-semibold uppercase tracking-[.07em]" style={{ gridTemplateColumns: "1.2fr 1.65fr 1.15fr .85fr 1fr .8fr .8fr", borderColor: T.b1, background: T.s2, color: T.t2 }}>
                        <div>Client / Business</div>
                        <div>Title</div>
                        <div>Category</div>
                        <div>Priority</div>
                        <div>Status</div>
                        <div>Created</div>
                        <div>Updated</div>
                      </div>
                      {filteredRequests.map((request, index) => {
                        const active = selected?.id === request.id
                        return (
                          <button
                            key={request.id}
                            type="button"
                            onClick={() => setSelectedId(request.id)}
                            className="grid w-full items-center px-4 py-4 text-left transition-colors"
                            style={{
                              gridTemplateColumns: "1.2fr 1.65fr 1.15fr .85fr 1fr .8fr .8fr",
                              borderBottom: index < filteredRequests.length - 1 ? `1px solid ${T.b1}` : "none",
                              background: active ? "rgba(37,99,235,.1)" : "transparent",
                            }}
                          >
                            <div className="min-w-0 pr-3 font-dm text-sm font-medium">
                              <div className="flex items-center gap-1.5 truncate">
                                {request.clientId}
                                {hasUnreadClientMessage(request) && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: T.acc }} aria-label="Unread client message" />}
                              </div>
                              <div className="mt-0.5 truncate text-[11px]" style={{ color: T.t3 }}>Client ID</div>
                            </div>
                            <div className="min-w-0 pr-3">
                              <div className="truncate font-dm text-sm font-medium">{request.title}</div>
                              <div className="mt-0.5 truncate font-dm text-[11px]" style={{ color: T.t2 }}>{request.description}</div>
                            </div>
                            <div className="pr-3 font-dm text-sm" style={{ color: T.t2 }}>{CATEGORY_LABELS[request.category]}</div>
                            <div><Badge style={PRIORITY_STYLE[request.priority]}>{PRIORITY_LABELS[request.priority]}</Badge></div>
                            <div><Badge style={STATUS_STYLE[request.status]}>{STATUS_LABELS[request.status]}</Badge></div>
                            <div className="font-dm text-xs" style={{ color: T.t2 }}>{formatDate(request.createdAt)}</div>
                            <div className="font-dm text-xs" style={{ color: T.t2 }}>{formatDate(request.updatedAt)}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>

              <aside className="min-w-0 rounded-[8px] border p-4" style={{ background: T.s1, borderColor: T.b1 }}>
                {!selected || !draft ? (
                  <EmptyPanel title="Select a request" text="Choose a request from the queue to view details and update admin-only fields." />
                ) : (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="font-dm text-xs uppercase tracking-[.07em]" style={{ color: T.t2 }}>Request #{selected.id}</div>
                        <h2 className="mt-1 break-words font-syne text-xl font-bold">{selected.title}</h2>
                        <p className="mt-1 font-dm text-sm" style={{ color: T.t2 }}>{selected.clientId}</p>
                      </div>
                      <Badge style={STATUS_STYLE[selected.status]}>{STATUS_LABELS[selected.status]}</Badge>
                    </div>

                    {selected.priority === "critical" && selected.status !== "completed" && selected.status !== "cancelled" && (
                      <div className="rounded-[8px] border p-3" style={{ background: "rgba(239,68,68,.08)", borderColor: "rgba(239,68,68,.24)" }}>
                        <div className="flex items-start gap-2">
                          <AlertTriangle size={16} style={{ color: T.red }} aria-hidden="true" />
                          <div>
                            <div className="font-dm text-sm font-semibold" style={{ color: T.t1 }}>Critical request</div>
                            <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color: T.t2 }}>
                              Check site availability, forms, payments, domain, and SSL first. If this blocks enquiries or revenue, use the agreed direct support route as well as portal tracking.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
                        <div className="font-dm text-[11px]" style={{ color: T.t2 }}>Created</div>
                        <div className="mt-1 font-dm text-sm">{formatDateTime(selected.createdAt)}</div>
                      </div>
                      <div className="rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
                        <div className="font-dm text-[11px]" style={{ color: T.t2 }}>Updated</div>
                        <div className="mt-1 font-dm text-sm">{formatDateTime(selected.updatedAt)}</div>
                      </div>
                    </div>

                    <section>
                      <h3 className="mb-2 font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Client Details</h3>
                      <div className="rounded-[8px] border p-3 font-dm text-sm leading-relaxed" style={{ background: T.s2, borderColor: T.b1 }}>
                        <div><span style={{ color: T.t2 }}>Client / business:</span> {selected.clientId}</div>
                        <div className="mt-1 break-all">
                          <span style={{ color: T.t2 }}>Affected URL:</span>{" "}
                          {(() => {
                            const affected = selected.affectedUrl ?? selected.pageUrl
                            const href = safeHref(affected)
                            if (href) {
                              return (
                                <a href={href} target="_blank" rel="noreferrer" className="text-acc underline-offset-2 hover:underline">
                                  {affected}
                                </a>
                              )
                            }
                            return affected?.trim() ? affected : "Not provided"
                          })()}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-2 font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Description</h3>
                      <p className="whitespace-pre-wrap rounded-[8px] border p-3 font-dm text-sm leading-relaxed" style={{ background: T.s2, borderColor: T.b1 }}>
                        {selected.description}
                      </p>
                    </section>

                    <section>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Request Thread</h3>
                        <span className="font-dm text-[11px]" style={{ color: T.t3 }}>{selected.messages.length} message{selected.messages.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="max-h-[360px] space-y-3 overflow-auto rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
                        {selected.messages.length === 0 ? (
                          <p className="font-dm text-sm" style={{ color: T.t3 }}>No thread messages yet.</p>
                        ) : (
                          selected.messages.map((message) => (
                            <article
                              key={message.id}
                              className="rounded-[8px] border p-3"
                              style={{
                                background: message.visibility === "internal" ? "rgba(245,158,11,.08)" : T.s1,
                                borderColor: message.visibility === "internal" ? "rgba(245,158,11,.24)" : T.b1,
                              }}
                            >
                              <div className="mb-1 flex flex-wrap items-center gap-2 font-dm text-[11px]" style={{ color: T.t3 }}>
                                {message.visibility === "internal" ? <LockKeyhole size={13} aria-hidden="true" /> : <MessageSquare size={13} aria-hidden="true" />}
                                <span style={{ color: T.t2 }}>{message.senderName}</span>
                                <span>{message.senderType}</span>
                                <span>{message.visibility === "internal" ? "Internal note" : "Client-visible"}</span>
                                <span>{formatDateTime(message.createdAt)}</span>
                              </div>
                              <p className="whitespace-pre-wrap break-words font-dm text-sm leading-relaxed">{message.body}</p>
                            </article>
                          ))
                        )}
                      </div>
                    </section>

                    <section>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h3 className="font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Timeline</h3>
                        <span className="font-dm text-[11px]" style={{ color: T.t3 }}>{selected.timelineEvents.length} event{selected.timelineEvents.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="max-h-[320px] space-y-3 overflow-auto rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
                        {selected.timelineEvents.length === 0 ? (
                          <p className="font-dm text-sm" style={{ color: T.t3 }}>No timeline events yet.</p>
                        ) : (
                          selected.timelineEvents.map((event) => (
                            <article
                              key={event.id}
                              className="rounded-[8px] border p-3"
                              style={{
                                background: event.visibility === "internal" ? "rgba(245,158,11,.08)" : T.s1,
                                borderColor: event.visibility === "internal" ? "rgba(245,158,11,.24)" : T.b1,
                              }}
                            >
                              <div className="mb-1 flex flex-wrap items-center gap-2 font-dm text-[11px]" style={{ color: T.t3 }}>
                                {event.visibility === "internal" ? <LockKeyhole size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}
                                <span>{event.visibility === "internal" ? "Internal event" : "Client-visible"}</span>
                                <span>{event.createdBy}</span>
                                <span>{formatDateTime(event.createdAt)}</span>
                              </div>
                              <h4 className="font-dm text-sm font-semibold">{event.title}</h4>
                              <p className="mt-1 whitespace-pre-wrap break-words font-dm text-sm leading-relaxed" style={{ color: T.t2 }}>{event.description}</p>
                            </article>
                          ))
                        )}
                      </div>
                    </section>

                    <section className="grid gap-3">
                      <div className="rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
                        <div className="mb-2 flex items-center gap-2">
                          <MessageSquare size={15} style={{ color: T.acc }} aria-hidden="true" />
                          <h3 className="font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Reply to client</h3>
                        </div>
                        <textarea
                          className="min-h-[112px]"
                          value={clientReply}
                          onChange={(event) => setClientReply(event.target.value)}
                          placeholder="This reply will appear in the client portal thread."
                        />
                        <button
                          type="button"
                          onClick={() => void sendRequestMessage("client_visible", clientReply, "client-reply")}
                          disabled={Boolean(busyAction) || !clientReply.trim()}
                          className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-3 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.acc }}
                        >
                          {busyAction === "client-reply" ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                          Send Reply
                        </button>
                      </div>

                      <div className="rounded-[8px] border p-3" style={{ background: "rgba(245,158,11,.08)", borderColor: "rgba(245,158,11,.24)" }}>
                        <div className="mb-2 flex items-center gap-2">
                          <LockKeyhole size={15} style={{ color: T.amb }} aria-hidden="true" />
                          <h3 className="font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Internal note</h3>
                        </div>
                        <textarea
                          className="min-h-[112px]"
                          value={internalNote}
                          onChange={(event) => setInternalNote(event.target.value)}
                          placeholder="Visible to admins only. Never shown in the client portal."
                        />
                        <button
                          type="button"
                          onClick={() => void sendRequestMessage("internal", internalNote, "internal-note")}
                          disabled={Boolean(busyAction) || !internalNote.trim()}
                          className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border px-3 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.s1, borderColor: "rgba(245,158,11,.24)", color: T.t1 }}
                        >
                          {busyAction === "internal-note" ? <Loader2 size={15} className="animate-spin" /> : <LockKeyhole size={15} />}
                          Add Internal Note
                        </button>
                      </div>
                    </section>

                    <section className="rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
                      <h3 className="font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Manual timeline update</h3>
                      <div className="mt-3 grid gap-2">
                        <input
                          value={timelineTitle}
                          onChange={(event) => setTimelineTitle(event.target.value)}
                          placeholder="Timeline title"
                          aria-label="Timeline title"
                        />
                        <textarea
                          className="min-h-[96px]"
                          value={timelineDescription}
                          onChange={(event) => setTimelineDescription(event.target.value)}
                          placeholder="Timeline description"
                          aria-label="Timeline description"
                        />
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => void addTimelineUpdate("client_visible", "timeline-public")}
                          disabled={Boolean(busyAction) || !timelineTitle.trim() || !timelineDescription.trim()}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-3 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.acc }}
                        >
                          {busyAction === "timeline-public" ? <Loader2 size={15} className="animate-spin" /> : <Clock3 size={15} />}
                          Publish Update
                        </button>
                        <button
                          type="button"
                          onClick={() => void addTimelineUpdate("internal", "timeline-internal")}
                          disabled={Boolean(busyAction) || !timelineTitle.trim() || !timelineDescription.trim()}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border px-3 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.s1, borderColor: T.b1, color: T.t1 }}
                        >
                          {busyAction === "timeline-internal" ? <Loader2 size={15} className="animate-spin" /> : <LockKeyhole size={15} />}
                          Add Internal Update
                        </button>
                      </div>
                    </section>

                    <section className="rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <FileText size={15} style={{ color: T.acc }} aria-hidden="true" />
                            <h3 className="font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Monthly report</h3>
                          </div>
                          <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color: T.t2 }}>
                            Generate a branded client report from portal requests, visible timeline updates, and safe summaries.
                          </p>
                        </div>
                        {activeReport && <Badge style={STATUS_STYLE[activeReport.status === "published" ? "completed" : "triaged"]}>{MONTHLY_REPORT_STATUS_LABELS[activeReport.status]}</Badge>}
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[.7fr_.8fr_1fr]">
                        <label className="font-dm text-xs" style={{ color: T.t2 }}>
                          Month
                          <input
                            className="mt-1"
                            type="number"
                            min="1"
                            max="12"
                            value={reportMonth}
                            onChange={(event) => setReportMonth(Number(event.target.value))}
                          />
                        </label>
                        <label className="font-dm text-xs" style={{ color: T.t2 }}>
                          Year
                          <input
                            className="mt-1"
                            type="number"
                            min="2020"
                            max="2100"
                            value={reportYear}
                            onChange={(event) => setReportYear(Number(event.target.value))}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => void generateMonthlyReport()}
                          disabled={Boolean(busyAction)}
                          className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-3 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.acc }}
                        >
                          {busyAction === "generate-report" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                          Generate Report
                        </button>
                      </div>

                      {monthlyReports.length > 0 && (
                        <label className="mt-3 block font-dm text-xs" style={{ color: T.t2 }}>
                          Recent reports
                          <select
                            className="mt-1"
                            value={activeReport?.id ?? ""}
                            onChange={(event) => {
                              const report = monthlyReports.find((item) => item.id === Number(event.target.value)) ?? null
                              selectReport(report)
                            }}
                          >
                            {monthlyReports.map((report) => (
                              <option key={report.id} value={report.id}>
                                {report.month}/{report.year} - {MONTHLY_REPORT_STATUS_LABELS[report.status]}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}

                      {activeReport && reportDraft && (
                        <div className="mt-4 space-y-3">
                          <label className="block font-dm text-xs" style={{ color: T.t2 }}>
                            Title
                            <input
                              className="mt-1"
                              value={reportDraft.title}
                              onChange={(event) => setReportDraft((current) => current && { ...current, title: event.target.value })}
                            />
                          </label>
                          <label className="block font-dm text-xs" style={{ color: T.t2 }}>
                            Summary
                            <textarea
                              className="mt-1 min-h-[84px]"
                              value={reportDraft.summary}
                              onChange={(event) => setReportDraft((current) => current && { ...current, summary: event.target.value })}
                            />
                          </label>
                          <div className="overflow-hidden rounded-[8px] border" style={{ borderColor: T.b1, background: T.s1 }}>
                            <iframe
                              title="Monthly report preview"
                              srcDoc={reportDraft.htmlContent}
                              className="h-[460px] w-full bg-white"
                              sandbox=""
                            />
                          </div>
                          <label className="block font-dm text-xs" style={{ color: T.t2 }}>
                            HTML content
                            <textarea
                              className="mt-1 min-h-[220px] font-mono text-xs"
                              value={reportDraft.htmlContent}
                              onChange={(event) => setReportDraft((current) => current && { ...current, htmlContent: event.target.value })}
                            />
                          </label>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => void saveReport()}
                              disabled={Boolean(busyAction)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border px-3 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                              style={{ background: T.s1, borderColor: T.b1, color: T.t1 }}
                            >
                              {busyAction === "save-report" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                              Save Draft
                            </button>
                            <button
                              type="button"
                              onClick={() => void publishReport()}
                              disabled={Boolean(busyAction) || activeReport.status === "published"}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-3 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                              style={{ background: T.grn }}
                            >
                              {busyAction === "publish-report" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                              Publish to Portal
                            </button>
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="space-y-3">
                      <h3 className="font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Admin Actions</h3>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                        <label className="font-dm text-xs" style={{ color: T.t2 }}>
                          Status
                          <select className="mt-1" value={draft.status} onChange={(event) => setDraft((current) => current && { ...current, status: event.target.value as ClientRequestStatus })}>
                            {CLIENT_REQUEST_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                          </select>
                        </label>
                        <label className="font-dm text-xs" style={{ color: T.t2 }}>
                          Priority
                          <select className="mt-1" value={draft.priority} onChange={(event) => setDraft((current) => current && { ...current, priority: event.target.value as ClientRequestPriority })}>
                            {CLIENT_REQUEST_PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_LABELS[priority]}</option>)}
                          </select>
                        </label>
                        <label className="font-dm text-xs" style={{ color: T.t2 }}>
                          Category
                          <select className="mt-1" value={draft.category} onChange={(event) => setDraft((current) => current && { ...current, category: event.target.value as ClientRequestCategory })}>
                            {CLIENT_REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
                          </select>
                        </label>
                      </div>
                      {actionError && <div className="rounded-[8px] border p-3 font-dm text-sm" style={{ background: "rgba(239,68,68,.08)", borderColor: "rgba(239,68,68,.24)", color: T.red }}>{actionError}</div>}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                        <button
                          type="button"
                          onClick={saveChanges}
                          disabled={Boolean(busyAction)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] px-3 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.acc }}
                        >
                          {busyAction === "save" ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRequest({ action: "markCompleted" }, "complete")}
                          disabled={Boolean(busyAction) || selected.status === "completed"}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border px-3 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.s2, borderColor: T.b1, color: T.t1 }}
                        >
                          {busyAction === "complete" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRequest({ action: "reopen" }, "reopen")}
                          disabled={Boolean(busyAction) || selected.status !== "completed"}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border px-3 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.s2, borderColor: T.b1, color: T.t1 }}
                        >
                          {busyAction === "reopen" ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}
                          Reopen
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRequest({ action: "regenerateTriage" }, "triage")}
                          disabled={Boolean(busyAction)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border px-3 py-2 font-dm text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                          style={{ background: T.s2, borderColor: T.b1, color: T.t1 }}
                        >
                          {busyAction === "triage" ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                          Triage
                        </button>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-2 font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Internal Notes</h3>
                      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded-[8px] border p-3 font-dm text-sm leading-relaxed" style={{ background: T.s2, borderColor: T.b1, color: selected.internalNotes ? T.t1 : T.t3 }}>
                        {selected.internalNotes?.trim() || "No internal notes yet."}
                      </pre>
                    </section>

                    <section>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-syne text-[13px] font-bold uppercase tracking-[.07em]" style={{ color: T.t2 }}>Forge Suggestions</h3>
                        <span className="font-dm text-[11px]" style={{ color: T.t3 }}>Admin assist only - not sent automatically</span>
                      </div>
                      <div className="space-y-2">
                        {([
                          ["Summary", selected.forgeSummary],
                          ["Suggested checklist", selected.forgeSuggestedActions],
                          ["Suggested client reply", selected.forgeSuggestedReply],
                        ] as Array<[string, string | null]>).map(([label, value]) => (
                          <div key={label} className="rounded-[8px] border p-3" style={{ background: T.s2, borderColor: T.b1 }}>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="font-dm text-[11px]" style={{ color: T.t2 }}>{label}</div>
                              <button
                                type="button"
                                onClick={() => void copySuggestion(label, value)}
                                disabled={!value?.trim()}
                                className="inline-flex min-h-8 items-center gap-1.5 rounded-[8px] border px-2.5 py-1 font-dm text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ background: T.s3, borderColor: T.b1, color: T.t1 }}
                              >
                                {copiedField === label ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                                {copiedField === label ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap font-dm text-sm leading-relaxed" style={{ color: value ? T.t1 : T.t3 }}>{compactText(value)}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  )
}
