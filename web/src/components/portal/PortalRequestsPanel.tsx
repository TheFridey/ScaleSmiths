"use client"

import { FormEvent, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, CheckCircle2, ClipboardList, Loader2, Send } from "lucide-react"
import {
  CLIENT_REQUEST_CATEGORIES,
  CLIENT_REQUEST_PRIORITIES,
  type ClientRequestCategory,
  type ClientRequestPriority,
  type ClientRequestStatus,
} from "@/lib/client-requests"

interface PortalRequestRow {
  id: number
  title: string
  category: ClientRequestCategory
  priority: ClientRequestPriority
  status: ClientRequestStatus
  createdAt: string | Date
  updatedAt: string | Date
}

interface PortalRequestsPanelProps {
  clientId: string
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

const PRIORITY_GUIDANCE: Record<ClientRequestPriority, string> = {
  low: "Minor text/image changes",
  medium: "Normal update or SEO request",
  high: "Important business-impacting issue",
  critical: "Site down, contact form broken, payment/domain/SSL issue",
}

const STATUS_LABELS: Record<ClientRequestStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In progress",
  waiting_client: "Waiting client",
  completed: "Completed",
  cancelled: "Cancelled",
}

export function PortalRequestsPanel({ clientId }: PortalRequestsPanelProps) {
  const [requests, setRequests] = useState<PortalRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [priority, setPriority] = useState<ClientRequestPriority>("medium")

  useEffect(() => {
    let mounted = true

    async function loadRequests() {
      setLoading(true)
      setError("")

      try {
        const response = await fetch("/portal/api/requests", { cache: "no-store" })
        const json = await response.json().catch(() => ({}))

        if (!response.ok || !json.ok) {
          throw new Error(json.error || "Unable to load requests.")
        }

        if (mounted) setRequests(Array.isArray(json.requests) ? json.requests : [])
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load requests.")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadRequests()

    return () => {
      mounted = false
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setSaving(true)
    setError("")
    setConfirmation("")

    try {
      const response = await fetch("/portal/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.get("category"),
          title: formData.get("title"),
          description: formData.get("description"),
          affectedUrl: formData.get("affectedUrl"),
          priority: formData.get("priority"),
        }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to submit request.")
      }

      if (json.request) setRequests((current) => [json.request, ...current])
      setConfirmation(typeof json.confirmation === "string"
        ? json.confirmation
        : "Request received. ScaleSmiths will triage it and reply within the usual portal response window.")
      form.reset()
      setPriority("medium")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit request.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <form onSubmit={submit} className="rounded-2xl border border-b1 bg-s1 p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-b2 bg-s2">
            <ClipboardList size={18} className="text-acc" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-syne text-xl font-bold">New Request</h2>
            <p className="mt-1 font-dm text-sm leading-relaxed text-t2">
              Send website updates, issues, new content, or support requests straight into your workspace.
            </p>
          </div>
        </div>

        {confirmation && (
          <div className="mb-4 rounded-xl border border-grn/25 bg-grn/10 p-4 font-dm text-sm leading-relaxed text-t1">
            <div className="mb-1 flex items-center gap-2 font-semibold text-grn">
              <CheckCircle2 size={15} aria-hidden="true" />
              Submitted
            </div>
            {confirmation}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red/25 bg-red/10 p-4 font-dm text-sm leading-relaxed text-t1">
            <div className="mb-1 flex items-center gap-2 font-semibold text-red">
              <AlertCircle size={15} aria-hidden="true" />
              Request issue
            </div>
            {error}
          </div>
        )}

        <div className="grid gap-4">
          <label className="font-dm text-sm">
            <span className="mb-1.5 block text-t2">Request type</span>
            <select name="category" defaultValue="general_support" required className="w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 text-t1 outline-none transition-colors focus:border-acc/50">
              {CLIENT_REQUEST_CATEGORIES.map((category) => (
                <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
              ))}
            </select>
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block text-t2">Title</span>
            <input
              name="title"
              required
              maxLength={180}
              placeholder="Homepage text change, contact form issue..."
              className="w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 text-t1 outline-none transition-colors focus:border-acc/50"
            />
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block text-t2">Description</span>
            <textarea
              name="description"
              required
              rows={7}
              placeholder="Tell us what needs changing, what is broken, or what outcome you need. Include any useful context."
              className="w-full resize-y rounded-[10px] border border-b2 bg-s2 px-4 py-3 leading-relaxed text-t1 outline-none transition-colors focus:border-acc/50"
            />
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block text-t2">Affected page or URL</span>
            <input
              name="affectedUrl"
              placeholder="https://example.com/contact"
              className="w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 text-t1 outline-none transition-colors focus:border-acc/50"
            />
          </label>

          <label className="font-dm text-sm">
            <span className="mb-1.5 block text-t2">Priority</span>
            <select
              name="priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value as ClientRequestPriority)}
              required
              className="w-full rounded-[10px] border border-b2 bg-s2 px-4 py-3 text-t1 outline-none transition-colors focus:border-acc/50"
            >
              {CLIENT_REQUEST_PRIORITIES.map((item) => (
                <option key={item} value={item}>{labelize(item)}</option>
              ))}
            </select>
            <span className="mt-2 block rounded-lg border border-b1 bg-s2 px-3 py-2 text-xs leading-relaxed text-t2">
              {labelize(priority)}: {PRIORITY_GUIDANCE[priority]}
            </span>
          </label>
        </div>

        <button type="submit" disabled={saving} className="btn-primary mt-5 font-dm text-sm disabled:opacity-55">
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          {saving ? "Submitting..." : "Submit Request"}
        </button>

        <div className="mt-4 rounded-xl border border-b1 bg-s2 p-4 font-dm text-xs leading-relaxed text-t2">
          <div className="font-semibold text-t1">Support routing</div>
          <p className="mt-1">
            Critical: site down, contact form broken, payment issue, domain issue, or SSL warning. Log it here for tracking, then use your agreed direct line or email hello@scalesmiths.co.uk with URGENT in the subject.
          </p>
          <p className="mt-2">
            Non-critical: text changes, image changes, SEO, blog/content, and new pages should be logged here and will be handled through the normal request queue.
          </p>
        </div>
      </form>

      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <h2 className="font-syne text-xl font-bold">My Requests</h2>
        <p className="mt-1 font-dm text-sm text-t2">Submitted work and support requests for this client workspace.</p>

        {loading ? (
          <div className="mt-6 rounded-xl border border-b1 bg-s2 p-4 font-dm text-sm text-t2">
            <Loader2 size={16} className="mb-3 animate-spin text-acc" aria-hidden="true" />
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-b2 bg-s2 p-5">
            <ClipboardList size={18} className="mb-3 text-acc" aria-hidden="true" />
            <div className="font-dm text-sm font-semibold text-t1">No requests yet</div>
            <p className="mt-1 font-dm text-sm leading-relaxed text-t2">New requests you submit will appear here with status and update dates.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {requests.map((request) => (
              <article key={request.id} className="rounded-xl border border-b1 bg-s2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-dm text-sm font-semibold text-t1">
                      <Link href={`/portal/${clientId}/requests/${request.id}`} className="underline-offset-2 hover:text-acc hover:underline">
                        {request.title}
                      </Link>
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge>{CATEGORY_LABELS[request.category]}</Badge>
                      <Badge>{labelize(request.priority)}</Badge>
                      <Badge>{STATUS_LABELS[request.status]}</Badge>
                    </div>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 font-dm text-xs text-t2 sm:grid-cols-2">
                  <div>
                    <dt className="text-t3">Created</dt>
                    <dd>{formatDate(request.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-t3">Updated</dt>
                    <dd>{formatDate(request.updatedAt)}</dd>
                  </div>
                </dl>
                <Link href={`/portal/${clientId}/requests/${request.id}`} className="mt-3 inline-flex font-dm text-xs font-semibold text-acc underline-offset-2 hover:underline">
                  Open thread
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-b2 bg-s1 px-2 py-0.5 font-dm text-[11px] text-t2">
      {children}
    </span>
  )
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
