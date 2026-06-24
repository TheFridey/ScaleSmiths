"use client"

import { FormEvent, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react"
import type { ClientPortalRequest, ClientPortalRequestMessage } from "@/lib/client-requests"

interface PortalRequestThreadProps {
  request: ClientPortalRequest
  initialMessages: ClientPortalRequestMessage[]
}

export function PortalRequestThread({ request, initialMessages }: PortalRequestThreadProps) {
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return

    setSaving(true)
    setError("")
    setSent(false)

    try {
      const response = await fetch(`/portal/api/requests/${request.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok || !json.message) {
        throw new Error(json.error || "Unable to send your reply.")
      }

      setMessages((current) => [...current, json.message])
      setBody("")
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send your reply.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-h-[520px] rounded-2xl border border-b1 bg-s1 p-4 sm:p-6">
        <div className="flex min-h-[460px] flex-col">
          <div className="border-b border-b1 pb-4">
            <h2 className="font-syne text-xl font-bold">Request thread</h2>
            <p className="mt-1 font-dm text-sm text-t2">Replies here are shared with ScaleSmiths. Internal admin notes stay private.</p>
          </div>

          <div className="flex-1 space-y-4 py-5">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-b2 bg-s2 p-5 font-dm text-sm text-t2">
                No visible messages yet. Send a reply below to start the thread.
              </div>
            ) : (
              messages.map((message) => {
                const own = message.senderType === "client"
                return (
                  <article key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[760px] rounded-2xl border px-4 py-3 ${own ? "border-acc/25 bg-acc/10" : "border-b1 bg-s2"}`}>
                      <div className="mb-1 flex flex-wrap items-center gap-2 font-dm text-[11px] text-t3">
                        <span className="font-semibold text-t2">{message.senderName}</span>
                        <span>{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words font-dm text-sm leading-relaxed text-t1">{message.body}</p>
                    </div>
                  </article>
                )
              })
            )}
          </div>

          <form onSubmit={submit} className="border-t border-b1 pt-4">
            {sent && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-grn/25 bg-grn/10 px-3 py-2 font-dm text-sm text-t1">
                <CheckCircle2 size={15} className="text-grn" aria-hidden="true" />
                Reply sent.
              </div>
            )}
            {error && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-red/25 bg-red/10 px-3 py-2 font-dm text-sm text-t1">
                <AlertCircle size={15} className="text-red" aria-hidden="true" />
                {error}
              </div>
            )}
            <label className="block font-dm text-sm">
              <span className="mb-1.5 block text-t2">Reply</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                maxLength={6000}
                placeholder="Add an update, answer a question, or send extra context..."
                className="w-full resize-y rounded-[10px] border border-b2 bg-s2 px-4 py-3 leading-relaxed text-t1 outline-none transition-colors focus:border-acc/50"
                required
              />
            </label>
            <button type="submit" disabled={saving || !body.trim()} className="btn-primary mt-3 font-dm text-sm disabled:opacity-55">
              {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              {saving ? "Sending..." : "Send Reply"}
            </button>
          </form>
        </div>
      </section>

      <aside className="rounded-2xl border border-b1 bg-s1 p-5">
        <h2 className="font-syne text-xl font-bold">Request details</h2>
        <dl className="mt-5 space-y-3 font-dm text-sm">
          <Detail label="Status" value={labelize(request.status)} />
          <Detail label="Priority" value={labelize(request.priority)} />
          <Detail label="Category" value={labelize(request.category)} />
          <Detail label="Affected URL" value={request.affectedUrl || "Not provided"} />
          <Detail label="Created" value={formatDateTime(request.createdAt)} />
          <Detail label="Updated" value={formatDateTime(request.updatedAt)} />
        </dl>
      </aside>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-b1 bg-s2 p-3">
      <dt className="text-xs text-t3">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-t1">{value}</dd>
    </div>
  )
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDateTime(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
