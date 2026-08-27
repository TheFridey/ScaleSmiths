"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ClipboardList,
  Clock3,
  ExternalLink,
  FileText,
  LifeBuoy,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import {
  type ClientRequestCategory,
  type ClientRequestPriority,
  type ClientRequestStatus,
} from "@/lib/client-requests"
import type { ClientPortalTimelineEvent } from "@/lib/client-timeline"
import { PortalTimeline } from "@/components/portal/PortalTimeline"

interface PortalRequestRow {
  id: number
  title: string
  category: ClientRequestCategory
  priority: ClientRequestPriority
  status: ClientRequestStatus
  createdAt: string | Date
  updatedAt: string | Date
}

type PortalTimelineRow = ClientPortalTimelineEvent & { createdAt: string | Date }

interface PortalOperatingHubProps {
  clientId: string
  websiteName: string
  planTier: string | null
  currentStatus: string
  supportEmail: string
  latestReport: {
    id: number
    title: string
    summary: string
    periodLabel: string
    publishedAt: string | Date | null
  } | null
  recentMessages: {
    id: number
    requestId: number
    requestTitle: string
    senderType: "client" | "admin" | "system"
    senderName: string
    body: string
    createdAt: string | Date
  }[]
}

const OPEN_STATUSES = new Set<ClientRequestStatus>(["new", "triaged", "in_progress"])

const STATUS_LABELS: Record<ClientRequestStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  waiting_client: "Waiting client",
  completed: "Completed",
  cancelled: "Cancelled",
}

const CATEGORY_LABELS: Record<ClientRequestCategory, string> = {
  website_update: "Website update",
  website_issue: "Website issue",
  form_issue: "Contact form problem",
  seo_request: "SEO request",
  new_page: "New page request",
  content_assets: "Content/images/assets",
  urgent_support: "Urgent support",
  general_support: "General support",
}

export function PortalOperatingHub({
  clientId,
  websiteName,
  planTier,
  currentStatus,
  supportEmail,
  latestReport,
  recentMessages,
}: PortalOperatingHubProps) {
  const [requests, setRequests] = useState<PortalRequestRow[]>([])
  const [timeline, setTimeline] = useState<PortalTimelineRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let mounted = true

    async function loadRequests() {
      setLoading(true)
      setError("")

      try {
        const [requestResponse, timelineResponse] = await Promise.all([
          fetch("/portal/api/requests", { cache: "no-store" }),
          fetch("/portal/api/timeline", { cache: "no-store" }),
        ])
        const json = await requestResponse.json().catch(() => ({}))
        const timelineJson = await timelineResponse.json().catch(() => ({}))

        if (!requestResponse.ok || !json.ok) {
          throw new Error(json.error || "Unable to load request summary.")
        }

        if (!timelineResponse.ok || !timelineJson.ok) {
          throw new Error(timelineJson.error || "Unable to load timeline.")
        }

        if (mounted) {
          setRequests(Array.isArray(json.requests) ? json.requests : [])
          setTimeline(Array.isArray(timelineJson.timeline) ? timelineJson.timeline : [])
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load request summary.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadRequests()

    return () => {
      mounted = false
    }
  }, [])

  const requestGroups = useMemo(() => {
    const open = requests.filter((request) => OPEN_STATUSES.has(request.status))
    const waiting = requests.filter((request) => request.status === "waiting_client")
    const completed = requests.filter((request) => request.status === "completed").slice(0, 3)
    const latestUpdated = requests
      .map((request) => new Date(request.updatedAt))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0]

    return { open, waiting, completed, latestUpdated }
  }, [requests])

  const requestWorkHref = `/portal/${clientId}?tab=requests`
  const nextAction = getNextRecommendedAction(requestGroups.waiting.length, requestGroups.open.length, latestReport)

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
      <section className="rounded-2xl border border-b1 bg-s1 p-6 xl:col-span-2">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">At a glance</div>
            <h2 className="mt-2 font-syne text-2xl font-bold">{websiteName}</h2>
            <p className="mt-2 max-w-[680px] font-dm text-sm leading-relaxed text-t2">
              A focused view of your active work, updates, and next step.
            </p>
          </div>
          <Link href={requestWorkHref} className="btn-primary shrink-0 font-dm text-sm">
            Request Work
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <InfoCard Icon={ClipboardList} label="Open requests" value={loading ? "Checking..." : String(requestGroups.open.length)} note={requestGroups.waiting.length ? `${requestGroups.waiting.length} waiting for you` : "Nothing waiting for you"} />
          <InfoCard
            Icon={Clock3}
            label="Latest activity"
            value={requestGroups.latestUpdated ? formatDate(requestGroups.latestUpdated) : "No tracked updates yet"}
            note="From your request workspace"
          />
          <InfoCard Icon={ShieldCheck} label="Partnership" value={planTier ?? "Setup in progress"} note={currentStatus} />
        </div>
      </section>

      <section id="request-centre" className="rounded-2xl border border-b1 bg-s1 p-6 xl:col-span-2">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-syne text-xl font-bold">Request centre</h2>
            <p className="mt-1 font-dm text-sm text-t2">A quick view of work, support, and follow-up items logged through your portal.</p>
          </div>
          <Link href={requestWorkHref} className="inline-flex w-fit items-center rounded-lg border border-b2 bg-s2 px-4 py-2 font-dm text-sm text-t1 transition-colors hover:border-acc/50">
            Request Work
          </Link>
        </div>

        {loading ? (
          <PanelNotice Icon={Loader2} title="Loading request summary" body="Checking your current request queue..." spin />
        ) : error ? (
          <PanelNotice Icon={AlertTriangle} title="Request summary unavailable" body={error} />
        ) : requests.length === 0 ? (
          <PanelNotice Icon={FileText} title="No requests yet" body="When you request work or support, open and completed items will appear here." />
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            <RequestWidget title="Open requests" requests={requestGroups.open} empty="No open requests right now." clientId={clientId} />
            <RequestWidget title="Waiting on client" requests={requestGroups.waiting} empty="Nothing is waiting on you." clientId={clientId} />
            <RequestWidget title="Completed recently" requests={requestGroups.completed} empty="Completed requests will appear here." clientId={clientId} />
          </div>
        )}
      </section>

      <section id="latest-report" className="rounded-2xl border border-b1 bg-s1 p-6">
        <MessageSquare size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Recent chat</h2>
        <p className="mt-1 font-dm text-sm text-t2">Latest client-visible replies from your request threads.</p>
        <div className="mt-5">
          {recentMessages.length === 0 ? (
            <PanelNotice Icon={MessageSquare} title="No thread replies yet" body="When ScaleSmiths replies to a request, the update will appear here and inside the request thread." />
          ) : (
            <div className="grid gap-3">
              {recentMessages.slice(0, 4).map((message) => (
                <article key={message.id} className="rounded-xl border border-b1 bg-s2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-dm text-xs font-semibold text-t1">{message.senderType === "admin" ? "ScaleSmiths" : message.senderName}</div>
                    <div className="font-dm text-[11px] text-t3">{formatDate(message.createdAt)}</div>
                  </div>
                  <p className="mt-2 line-clamp-3 font-dm text-sm leading-relaxed text-t2">{message.body}</p>
                  <Link href={`/portal/${clientId}/requests/${message.requestId}`} className="mt-3 inline-flex items-center gap-1 font-dm text-xs font-semibold text-acc underline-offset-2 hover:underline">
                    Open thread <ExternalLink size={12} aria-hidden="true" />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <FileText size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Latest monthly report</h2>
        <p className="mt-1 font-dm text-sm text-t2">Published ScaleSmiths overview of work, recommendations, and next steps.</p>
        {latestReport ? (
          <article className="mt-5 rounded-xl border border-b1 bg-s2 p-4">
            <div className="font-dm text-xs text-t3">{latestReport.periodLabel}</div>
            <h3 className="mt-1 font-syne text-lg font-bold">{latestReport.title}</h3>
            <p className="mt-2 line-clamp-4 font-dm text-sm leading-relaxed text-t2">{latestReport.summary}</p>
            <Link href={`/portal/${clientId}/reports/${latestReport.id}`} className="mt-3 inline-flex items-center gap-1 font-dm text-xs font-semibold text-acc underline-offset-2 hover:underline">
              Open report <ExternalLink size={12} aria-hidden="true" />
            </Link>
          </article>
        ) : (
          <div className="mt-5">
            <PanelNotice Icon={FileText} title="No report published yet" body="Your first monthly report will appear here once ScaleSmiths publishes it to the portal." />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-acc/20 bg-acc/10 p-6 xl:col-span-2">
        <Sparkles size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Next recommended action</h2>
        <p className="mt-2 max-w-[760px] font-dm text-sm leading-relaxed text-t2">{nextAction.body}</p>
        <Link href={nextAction.href} className="mt-4 inline-flex w-fit items-center rounded-lg bg-acc px-4 py-2 font-dm text-sm font-semibold text-white transition-opacity hover:opacity-90">
          {nextAction.label}
        </Link>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-b1 bg-s1 p-5 sm:flex-row sm:items-center sm:justify-between xl:col-span-2">
        <div className="flex items-start gap-3">
          <LifeBuoy size={18} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />
          <div>
            <h2 className="font-syne text-base font-bold">Need urgent support?</h2>
            <p className="mt-1 max-w-[760px] font-dm text-sm leading-relaxed text-t2">Log a critical request first. If your site is down or there is a security, payment, domain, or form issue, also email {supportEmail}.</p>
          </div>
        </div>
        <a href={`mailto:${supportEmail}?subject=URGENT%20client%20portal%20support`} className="shrink-0 font-dm text-sm font-semibold text-acc underline-offset-2 hover:underline">Email support</a>
      </section>

      <section className="rounded-2xl border border-b1 bg-s1 p-6 xl:col-span-2">
        <Clock3 size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Timeline</h2>
        <p className="mt-1 font-dm text-sm text-t2">Client-visible updates from requests, project progress, replies, and reports.</p>
        <div className="mt-5">
          <PortalTimeline events={timeline} emptyText="No timeline updates have been published yet." />
        </div>
      </section>

    </div>
  )
}

function getNextRecommendedAction(waitingCount: number, openCount: number, latestReport: PortalOperatingHubProps["latestReport"]) {
  if (waitingCount > 0) {
    return {
      label: "Review waiting requests",
      href: "#request-centre",
      body: `${waitingCount} request${waitingCount === 1 ? " is" : "s are"} waiting for your reply or approval. Clearing that keeps delivery moving.`,
    }
  }

  if (latestReport) {
    return {
      label: "Read latest report",
      href: `#latest-report`,
      body: "Review the latest monthly report for completed work, active improvements, and recommended next steps.",
    }
  }

  if (openCount > 0) {
    return {
      label: "Check open requests",
      href: "#request-centre",
      body: "Your open requests are being tracked. Check their current status and add details if anything has changed.",
    }
  }

  return {
    label: "Submit a request",
    href: "#request-centre",
    body: "Your workspace is clear. Add a request when you need a website change, support, or a new improvement reviewed.",
  }
}

function RequestWidget({ title, requests, empty, clientId }: { title: string; requests: PortalRequestRow[]; empty: string; clientId: string }) {
  return (
    <div className="rounded-xl border border-b1 bg-s2 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-syne text-base font-bold">{title}</h3>
        <span className="rounded border border-b2 bg-s1 px-2 py-0.5 font-dm text-[11px] text-t2">{requests.length}</span>
      </div>
      {requests.length === 0 ? (
        <p className="font-dm text-sm leading-relaxed text-t2">{empty}</p>
      ) : (
        <div className="grid gap-2">
          {requests.slice(0, 3).map((request) => (
            <article key={request.id} className="rounded-lg border border-b1 bg-s1 p-3">
              <h4 className="line-clamp-2 font-dm text-sm font-semibold text-t1">
                <Link href={`/portal/${clientId}/requests/${request.id}`} className="underline-offset-2 hover:text-acc hover:underline">
                  {request.title}
                </Link>
              </h4>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>{STATUS_LABELS[request.status]}</Badge>
                <Badge>{CATEGORY_LABELS[request.category]}</Badge>
              </div>
              <div className="mt-2 font-dm text-[11px] text-t3">Updated {formatDate(request.updatedAt)}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function InfoCard({ Icon, label, value, note }: { Icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-b1 bg-s2 p-4">
      <Icon size={16} className="mb-3 text-acc" aria-hidden="true" />
      <div className="font-dm text-xs text-t2">{label}</div>
      <div className="mt-1 break-words font-dm text-sm font-semibold leading-relaxed text-t1">{value}</div>
      <div className="mt-2 font-dm text-[11px] leading-relaxed text-t3">{note}</div>
    </div>
  )
}

function PanelNotice({ Icon, title, body, spin = false }: { Icon: LucideIcon; title: string; body: string; spin?: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-b2 bg-s2 p-5">
      <Icon size={18} className={`mb-3 text-acc ${spin ? "animate-spin" : ""}`} aria-hidden="true" />
      <div className="font-dm text-sm font-semibold text-t1">{title}</div>
      <p className="mt-1 font-dm text-sm leading-relaxed text-t2">{body}</p>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-b2 bg-s2 px-2 py-0.5 font-dm text-[11px] text-t2">
      {children}
    </span>
  )
}

function formatDate(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
