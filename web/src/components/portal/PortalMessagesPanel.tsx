"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from "lucide-react"
import type { ClientPortalRequest, ClientPortalRequestMessage } from "@/lib/client-requests"
import { PORTAL_MESSAGE_INBOX_LIMIT, type PortalMessageInboxThread } from "@/lib/portal-message-inbox"

interface PortalMessagesPanelProps {
  clientId: string
  threads: PortalMessageInboxThread[]
  truncated: boolean
  initialRequest: ClientPortalRequest | null
  initialMessages: ClientPortalRequestMessage[]
}

const FALLBACK_MAILTO = "hello@scalesmiths.co.uk"

export function PortalMessagesPanel({
  clientId,
  threads: initialThreads,
  truncated,
  initialRequest,
  initialMessages,
}: PortalMessagesPanelProps) {
  const router = useRouter()
  const [threads, setThreads] = useState(initialThreads)
  const [thread, setThread] = useState(initialRequest)
  const [messages, setMessages] = useState(initialMessages)
  const [body, setBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [showFallback, setShowFallback] = useState(false)

  const selectedId = thread?.id ?? null
  const selectedRequestId = initialRequest?.id ?? null

  useEffect(() => {
    setThreads(initialThreads)
    setThread(initialRequest)
    setMessages(initialMessages)
    setBody("")
    setError("")
    setShowFallback(false)
    // Keep same-thread composer state; only reset when the selected request changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedRequestId is the thread identity.
  }, [selectedRequestId])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = body.trim()
    if (!trimmed) return

    setSaving(true)
    setError("")
    setShowFallback(false)

    try {
      const endpoint = thread ? `/portal/api/requests/${thread.id}` : "/portal/api/messages"
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok || !json.message) {
        throw new Error(json.error || "Unable to send your message.")
      }

      const nextMessage = json.message as ClientPortalRequestMessage
      setMessages((current) => [...current, nextMessage])
      const nextThread = thread ?? {
        id: json.requestId as number,
        title: "Portal messages",
        description: "Direct messages between this client and ScaleSmiths.",
        category: "general_support" as const,
        priority: "medium" as const,
        status: "new" as const,
        affectedUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        clientLastReadAt: new Date(),
      }
      if (!thread) setThread(nextThread)
      setThreads((current) => upsertInboxThread(current, nextThread, nextMessage))
      setBody("")
      if (!thread && json.requestId) {
        router.replace(`/portal/${clientId}?tab=messages&thread=${json.requestId}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send your message.")
      setShowFallback(true)
    } finally {
      setSaving(false)
    }
  }

  const mailtoHref = `mailto:${FALLBACK_MAILTO}?subject=${encodeURIComponent(`Portal message from ${clientId}`)}&body=${encodeURIComponent(body.trim() || "Hi ScaleSmiths,")}`
  const composerHint = thread
    ? "Replies stay on this request thread. Internal ScaleSmiths notes never appear here."
    : "This starts your general support thread. Formal website work still goes through Requests."

  const selectedTitle = useMemo(() => thread?.title ?? "New conversation", [thread])

  return (
    <section className="rounded-2xl border border-b1 bg-s1 p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-b2 bg-s2">
          <Mail size={18} className="text-acc" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-syne text-xl font-bold">Messages</h2>
          <p className="mt-1 font-dm text-sm text-t2">
            Client-visible history from your request threads. New messages stay on the selected thread, or start a general support conversation.
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <aside className="rounded-xl border border-b1 bg-s2 p-4">
          <h3 className="font-syne text-base font-bold">Conversations</h3>
          <p className="mt-1 font-dm text-xs leading-relaxed text-t2">
            {truncated
              ? `Showing the ${PORTAL_MESSAGE_INBOX_LIMIT} most recently active threads. Older conversations remain under Requests.`
              : "Recent request threads with a client-visible reply."}
          </p>

          {threads.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-b2 bg-s1 p-4 font-dm text-sm text-t2">
              No conversations yet. Send a message to start one.
            </div>
          ) : (
            <ul className="mt-4 grid gap-2">
              {threads.map((item) => {
                const selected = item.requestId === selectedId
                return (
                  <li key={item.requestId}>
                    <Link
                      href={`/portal/${clientId}?tab=messages&thread=${item.requestId}`}
                      prefetch={false}
                      className={`block rounded-lg border px-3 py-3 transition-colors ${selected ? "border-acc/40 bg-acc/10" : "border-b1 bg-s1 hover:border-acc/40"}`}
                      aria-current={selected ? "page" : undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 font-dm text-sm font-semibold text-t1">{item.title}</div>
                        {item.unread ? (
                          <span className="shrink-0 rounded border border-acc/40 bg-acc/10 px-2 py-0.5 font-dm text-[11px] text-acc">Unread</span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 font-dm text-xs leading-relaxed text-t2">{item.lastMessage.body}</p>
                      <div className="mt-2 font-dm text-[11px] text-t3">{formatDateTime(item.lastMessage.createdAt)}</div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-syne text-lg font-bold">{selectedTitle}</h3>
              <p className="mt-1 font-dm text-sm text-t2">{composerHint}</p>
            </div>
            {thread ? (
              <Link href={`/portal/${clientId}/requests/${thread.id}`} className="font-dm text-xs font-semibold text-acc underline-offset-2 hover:underline">
                Open request details
              </Link>
            ) : null}
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
        </div>
      </div>
    </section>
  )
}

function upsertInboxThread(
  current: PortalMessageInboxThread[],
  request: ClientPortalRequest,
  message: ClientPortalRequestMessage,
): PortalMessageInboxThread[] {
  const next: PortalMessageInboxThread = {
    requestId: request.id,
    title: request.title,
    category: request.category,
    status: request.status,
    unread: false,
    lastMessage: {
      id: message.id,
      senderType: message.senderType,
      senderName: message.senderName,
      body: message.body,
      createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt),
    },
  }
  return [next, ...current.filter((item) => item.requestId !== request.id)].slice(0, PORTAL_MESSAGE_INBOX_LIMIT)
}

function formatDateTime(value: Date | string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not set"
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}
