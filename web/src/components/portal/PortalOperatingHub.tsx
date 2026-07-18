"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Folder,
  Globe2,
  HeartPulse,
  LifeBuoy,
  Loader2,
  MessageSquare,
  Search,
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
  domain: string | null
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
  domain,
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
      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Website overview</div>
            <h2 className="mt-2 font-syne text-2xl font-bold">{websiteName}</h2>
            <p className="mt-2 max-w-[680px] font-dm text-sm leading-relaxed text-t2">
              Your ScaleSmiths operating hub for support, requests, website health, content priorities, and shared delivery notes.
            </p>
          </div>
          <Link href={requestWorkHref} className="btn-primary shrink-0 font-dm text-sm">
            Request Work
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InfoCard Icon={Globe2} label="Domain" value={domain ?? "Domain not connected yet"} note={domain ? "Live website reference" : "Future website profile data"} />
          <InfoCard Icon={ShieldCheck} label="Plan / retainer" value={planTier ?? "Plan not assigned yet"} note="Confirmed plan will appear here" />
          <InfoCard Icon={HeartPulse} label="Current status" value={currentStatus} note="Operational portal status" />
          <InfoCard
            Icon={Clock3}
            label="Last updated"
            value={requestGroups.latestUpdated ? formatDate(requestGroups.latestUpdated) : "No tracked updates yet"}
            note="Based on portal request activity"
          />
          <InfoCard Icon={LifeBuoy} label="Support route" value="Log all work in Requests" note={`Critical issues: also email ${supportEmail}`} />
          <InfoCard Icon={MessageSquare} label="Response guidance" value="See support agreement" note="Urgency is triaged against the agreed support scope" />
        </div>
      </section>

      <section className="rounded-2xl border border-acc/20 bg-acc/10 p-6">
        <AlertTriangle size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Emergency support</h2>
        <div className="mt-4 grid gap-3">
          <GuidanceBlock
            title="Critical"
            body="Site down, contact form broken, payment issue, domain issue, or SSL/security warning."
            tone="critical"
          />
          <GuidanceBlock
            title="Non-critical"
            body="Text changes, image swaps, SEO/content requests, blog updates, new page requests, and normal website improvements."
            tone="normal"
          />
        </div>
        <p className="mt-4 font-dm text-sm leading-relaxed text-t2">
          For critical issues, log a request for tracking, then use your agreed direct line or email{" "}
          <a href={`mailto:${supportEmail}?subject=URGENT%20client%20portal%20support`} className="text-acc underline-offset-2 hover:underline">
            {supportEmail}
          </a>{" "}
          with URGENT in the subject.
        </p>
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

      <section className="rounded-2xl border border-b1 bg-s1 p-6 xl:col-span-2">
        <Clock3 size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Timeline</h2>
        <p className="mt-1 font-dm text-sm text-t2">Client-visible updates from requests, project progress, replies, and reports.</p>
        <div className="mt-5">
          <PortalTimeline events={timeline} emptyText="No timeline updates have been published yet." />
        </div>
      </section>

      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <Search size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">SEO and content</h2>
        <div className="mt-5 grid gap-3">
          <InfoLine label="Current SEO focus" value="Not connected yet" note="Future Search Console/content plan integration." />
          <InfoLine label="Recent content activity" value={recentContentActivity(requests)} note="Based on portal requests for now." />
          <InfoLine label="Upcoming recommendations" value="Coming soon" note="Recommendations will appear once live review data is connected." />
        </div>
      </section>

      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <Folder size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Documents and assets</h2>
        <div className="mt-5 grid gap-3">
          <InfoLine label="Uploaded assets" value="No assets uploaded yet" note="Asset upload/library integration is not live yet." />
          <InfoLine label="Brand notes" value="Pending" note="Logo, colours, tone of voice, and reusable notes will appear here." />
          <InfoLine label="Handoff documents" value="Coming soon" note="Launch notes and operating docs will be added when published." />
        </div>
      </section>

      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <LifeBuoy size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Contact and support routes</h2>
        <div className="mt-5 grid gap-3">
          <SupportRoute title="Request work" body="Best for tracked changes, fixes, content, and approvals." href={requestWorkHref} label="Open requests" />
          <SupportRoute title="Email support" body={`Best for critical backup communication: ${supportEmail}`} href={`mailto:${supportEmail}`} label="Email ScaleSmiths" />
          <SupportRoute title="Reports" body="Review published monthly summaries and next-step recommendations." href={`/portal/${clientId}?tab=reports`} label="Open reports" />
        </div>
      </section>

      <section className="rounded-2xl border border-b1 bg-s1 p-6 xl:col-span-2">
        <Sparkles size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Performance and health</h2>
        <p className="mt-2 max-w-[760px] font-dm text-sm leading-relaxed text-t2">
          No fake analytics here. These cards show what is live now and what will become automated as integrations are connected.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HealthCard label="Portal access" value="Active" tone="good" note="Secure client login is live." />
          <HealthCard label="Request tracking" value="Active" tone="good" note="Requests are logged and statused." />
          <HealthCard label="Uptime monitoring" value="Coming soon" tone="soon" note="No live monitor connected yet." />
          <HealthCard label="Analytics snapshot" value="Coming soon" tone="soon" note="Traffic metrics will show after integration." />
        </div>
      </section>
    </div>
  )
}

function SupportRoute({ title, body, href, label }: { title: string; body: string; href: string; label: string }) {
  return (
    <div className="rounded-xl border border-b1 bg-s2 p-4">
      <div className="font-dm text-sm font-semibold text-t1">{title}</div>
      <p className="mt-1 font-dm text-sm leading-relaxed text-t2">{body}</p>
      <Link href={href} className="mt-3 inline-flex font-dm text-xs font-semibold text-acc underline-offset-2 hover:underline">
        {label}
      </Link>
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

function InfoLine({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-b1 bg-s2 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-dm text-xs text-t2">{label}</div>
          <div className="mt-1 font-dm text-sm font-semibold text-t1">{value}</div>
        </div>
        <span className="w-fit rounded border border-b2 bg-s1 px-2 py-0.5 font-dm text-[11px] text-t3">Future data</span>
      </div>
      <p className="mt-2 font-dm text-xs leading-relaxed text-t2">{note}</p>
    </div>
  )
}

function HealthCard({ label, value, tone, note }: { label: string; value: string; tone: "good" | "soon"; note: string }) {
  return (
    <div className="rounded-xl border border-b1 bg-s2 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-dm text-xs text-t2">{label}</div>
        <span className={tone === "good" ? "text-grn" : "text-t3"}>
          {tone === "good" ? <CheckCircle2 size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
        </span>
      </div>
      <div className="mt-3 font-syne text-lg font-bold">{value}</div>
      <p className="mt-1 font-dm text-xs leading-relaxed text-t2">{note}</p>
    </div>
  )
}

function GuidanceBlock({ title, body, tone }: { title: string; body: string; tone: "critical" | "normal" }) {
  return (
    <div className={tone === "critical" ? "rounded-xl border border-red/25 bg-red/10 p-4" : "rounded-xl border border-b1 bg-s1/70 p-4"}>
      <div className={tone === "critical" ? "font-dm text-sm font-semibold text-red" : "font-dm text-sm font-semibold text-t1"}>{title}</div>
      <p className="mt-1 font-dm text-sm leading-relaxed text-t2">{body}</p>
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

function recentContentActivity(requests: PortalRequestRow[]) {
  const contentRequests = requests.filter((request) => ["seo_request", "content_assets", "new_page", "website_update"].includes(request.category))
  if (contentRequests.length === 0) return "No recent content activity logged"
  return `${contentRequests.length} related request${contentRequests.length === 1 ? "" : "s"} logged`
}

function formatDate(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
