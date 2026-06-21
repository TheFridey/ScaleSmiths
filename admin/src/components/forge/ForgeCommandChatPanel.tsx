"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bot, CheckCircle2, Loader2, Send, Sparkles } from "lucide-react"
import { forgeCommandLabel, type ForgeCommandChatMessage, type ForgeCommandChatState } from "@/lib/forge-command-chat"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

const SUGGESTIONS = [
  "improve hero section",
  "regenerate homepage copy",
  "make design more premium",
  "add WhatsApp CTA",
  "run QA",
  "repair build errors",
  "generate proposal",
] as const

export function ForgeCommandChatPanel({
  projectId,
  initialChat,
  disabled = false,
}: {
  projectId: number
  initialChat: ForgeCommandChatState
  disabled?: boolean
}) {
  const router = useRouter()
  const [chat, setChat] = useState(initialChat)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const pendingConfirmation = useMemo(
    () => [...chat.messages].reverse().find((item) => item.role === "assistant" && item.requiresConfirmation),
    [chat.messages],
  )

  useEffect(() => {
    setChat(initialChat)
  }, [initialChat])

  async function sendCommand(value = message, confirmed = false) {
    const command = value.trim()
    if (!command || busy || disabled) return

    setBusy(true)
    setError("")
    if (!confirmed) setMessage("")

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/command-chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: command, confirmed }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(json.error || "Unable to route Forge command.")
      setChat(json.chat)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to route Forge command.")
      if (!confirmed) setMessage(command)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Bot size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Command Chat</h2>
            <Badge value="Control surface" tone="accent" />
          </div>
          <p className="max-w-[780px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Classifies project commands and routes them to approved Forge actions. Chat does not blindly edit generated files.
          </p>
        </div>
        {busy && (
          <div className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-dm text-sm" style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Routing command
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}
      {disabled && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:T.s2, borderColor:T.b2, color:T.t2 }}>
          Archived projects are locked from command chat actions.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => void sendCommand(suggestion)}
            disabled={busy || disabled}
            className="rounded-lg border px-3 py-2 font-dm text-xs disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div className="mb-4 max-h-[460px] space-y-3 overflow-auto rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
        {chat.messages.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4" style={{ borderColor:T.b2 }}>
            <Sparkles size={16} className="mb-3 text-acc" aria-hidden="true" />
            <p className="font-dm text-sm" style={{ color:T.t2 }}>No project commands yet. Start with a concrete production instruction.</p>
          </div>
        ) : (
          chat.messages.map((item) => <MessageBubble key={item.id} message={item} />)
        )}
      </div>

      {pendingConfirmation && (
        <div className="mb-4 rounded-lg border p-4" style={{ background:"rgba(245,158,11,.08)", borderColor:"rgba(245,158,11,.28)" }}>
          <div className="mb-2 flex items-center gap-2 font-dm text-sm font-semibold" style={{ color:T.amb }}>
            <AlertTriangle size={15} aria-hidden="true" /> Confirmation required
          </div>
          <p className="font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            This command can change generated workspace state. Confirm only if the approved artifacts are ready.
          </p>
          <button
            type="button"
            onClick={() => void sendCommand(lastUserCommand(chat.messages), true)}
            disabled={busy || disabled}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            <CheckCircle2 size={15} aria-hidden="true" /> Confirm and Run
          </button>
        </div>
      )}

      <form
        className="flex flex-col gap-2 md:flex-row"
        onSubmit={(event) => {
          event.preventDefault()
          void sendCommand()
        }}
      >
        <label className="sr-only" htmlFor="forge-command-chat">Forge command</label>
        <input
          id="forge-command-chat"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={busy || disabled}
          className="min-h-11 flex-1 rounded-lg border px-3 py-2 font-dm text-sm disabled:opacity-60"
          style={{ background:T.s2, borderColor:T.b1, color:T.t1 }}
          placeholder="Tell Forge what production action to route..."
        />
        <button
          type="submit"
          disabled={busy || disabled || !message.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background:T.acc }}
        >
          <Send size={15} aria-hidden="true" /> Send
        </button>
      </form>
    </section>
  )
}

function MessageBubble({ message }: { message: ForgeCommandChatMessage }) {
  const isUser = message.role === "user"
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[860px] rounded-lg border px-3 py-2" style={{ background:isUser ? T.s3 : T.s1, borderColor:T.b1 }}>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-dm text-[11px] font-semibold uppercase tracking-[.06em]" style={{ color:isUser ? T.acc : T.t3 }}>
            {isUser ? "Admin" : "Forge"}
          </span>
          {message.intent && <Badge value={forgeCommandLabel(message.intent)} tone="muted" />}
          {message.status && <Badge value={message.status} tone={message.status === "failed" ? "bad" : message.status === "needs_confirmation" ? "warn" : "good"} />}
          {message.taskId && <span className="font-dm text-[11px]" style={{ color:T.t3 }}>Task #{message.taskId}</span>}
        </div>
        <p className="whitespace-pre-wrap font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{message.content}</p>
      </div>
    </div>
  )
}

function Badge({ value, tone }: { value: string; tone: "accent" | "good" | "warn" | "bad" | "muted" }) {
  const color = tone === "accent" ? T.acc : tone === "good" ? T.grn : tone === "warn" ? T.amb : tone === "bad" ? T.red : T.t2
  return (
    <span className="inline-flex w-fit rounded px-2 py-0.5 font-dm text-[10px] font-semibold uppercase tracking-[.05em]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color }}>
      {value}
    </span>
  )
}

function lastUserCommand(messages: ForgeCommandChatMessage[]) {
  return [...messages].reverse().find((item) => item.role === "user")?.content ?? ""
}
