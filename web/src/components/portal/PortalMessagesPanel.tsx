"use client"

import { FormEvent, useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from "lucide-react"
import type { ClientPortalRequest, ClientPortalRequestMessage } from "@/lib/client-requests"

interface PortalMessagesPanelProps {
  clientId: string
  initialRequest: ClientPortalRequest | null
  initialMessages: ClientPortalRequestMessage[]
}

const FALLBACK_MAILTO = "hello@scalesmiths.co.uk"

export function PortalMessagesPanel({ clientId, initialRequest, initialMessages }: PortalMessagesPanelProps) {
  const [thread, setThread] = useState(initialRequest)
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showFallback, setShowFallback] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return

    setSaving(true)
    setError("")
    setShowFallback(false)

    try {
      const response = await fetch("/portal/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok || !json.message) {
        throw new Error(json.error || "Unable to send your message.")
      }

      setMessages((current) => [...current, json.message])
      if (!thread) {
        setThread({
          id: json.requestId,
          title: "Portal messages",
          description: "Direct messages between this client and ScaleSmiths.",
          category: "general_support",
          priority: "medium",
          status: "new",
          affectedUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          clientLastReadAt: new Date(),
        })
      }
      setBody("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send your message.")
      setShowFallback(true)
    } finally {
      setSaving(false)
    }
  }

  const mailtoHref = `mailto:${FALLBACK_MAILTO}?subject=${encodeURIComponent(`Portal message from ${clientId}`)}&body=${encodeURIComponent(body.trim() || "Hi ScaleSmiths,")}`

  return (
    <section className="rounded-2xl border border-b1 bg-s1 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-b2 bg-s2">
          <Mail size={18} className="text-acc" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-syne text-xl font-bold">Direct project message</h2>
          <p className="mt-1 font-dm text-sm text-t2">Send questions, approvals, content changes, or launch notes.</p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="mb-5 rounded-xl border border-dashed border-b2 bg-s2 p-5 font-dm text-sm text-t2">
          No messages yet. Send one below to start the thread.
        </div>
      ) : (
        <div className="mb-5 max-h-[420px] space-y-3 overflow-auto">
          {messages.map((message) => {
            const own = message.senderType === "client"
            return (
              <article key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[560px] rounded-2xl border px-4 py-3 ${own ? "border-acc/25 bg-acc/10" : "border-b1 bg-s2"}`}>
                  <div className="mb-1 flex flex-wrap items-center gap-2 font-dm text-[11px] text-t3">
                    <span className="font-semibold text-t2">{message.senderName}</span>
                    <span>{formatDateTime(message.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words font-dm text-sm leading-relaxed text-t1">{message.body}</p>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label htmlFor="portal-message-body" className="mb-1.5 block font-dm text-sm text-t2">
            Message
          </label>
          <textarea
            id="portal-message-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add the detail we need, links, decisions, or anything blocking progress."
            rows={5}
            maxLength={6000}
            className="w-full resize-y rounded-[10px] border border-b2 bg-s2 px-4 py-3 font-dm text-sm leading-relaxed text-t1 outline-none transition-colors focus:border-acc/50"
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red/25 bg-red/10 px-3 py-2 font-dm text-sm text-t1">
            <AlertCircle size={15} className="text-red" aria-hidden="true" />
            {error}
          </div>
        )}

        <button type="submit" disabled={saving || !body.trim()} className="btn-primary font-dm text-sm disabled:opacity-60">
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
          {saving ? "Sending..." : "Send Message"}
        </button>

        {showFallback && (
          <a href={mailtoHref} className="inline-flex items-center gap-2 font-dm text-xs text-t2 underline-offset-2 hover:underline">
            <CheckCircle2 size={13} aria-hidden="true" />
            If this keeps failing, email us directly instead.
          </a>
        )}
      </form>
    </section>
  )
}

function formatDateTime(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
