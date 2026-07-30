"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Bot, CheckCircle2, CircleDollarSign, Loader2, Send, Sparkles } from "lucide-react"
import { forgeCommandLabel, type ForgeCommandChatMessage, type ForgeCommandChatState } from "@/lib/forge-command-chat"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

type CommandSuggestion = { message: string; intent: string; enabled: boolean; reason: string | null }

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
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([])
  const pendingConfirmation = useMemo(
    () => {
      const latestAssistant = [...chat.messages].reverse().find((item) => item.role === "assistant")
      return latestAssistant?.requiresConfirmation ? latestAssistant : undefined
    },
    [chat.messages],
  )
  const activeJobIds = useMemo(
    () => Array.from(new Set(chat.messages
      .filter((item) => typeof item.jobId === "number" && (item.status === "queued" || item.status === "running"))
      .map((item) => item.jobId as number))),
    [chat.messages],
  )

  useEffect(() => {
    setChat(initialChat)
  }, [initialChat])

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/forge/projects/${projectId}/command-chat`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => { if (!cancelled && Array.isArray(json.suggestions)) setSuggestions(json.suggestions) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [projectId])

  useEffect(() => {
    if (!activeJobIds.length) return

    let cancelled = false
    const poll = async () => {
      const response = await fetch("/api/forge/health", { cache: "no-store" })
      const json = await response.json().catch(() => ({}))
      const visible = new Set(activeJobIds)
      const updates: Array<{ jobId: number; status: "queued" | "running" | "completed" | "failed" }> = response.ok && Array.isArray(json.jobs)
        ? json.jobs
          .filter((job: { id?: unknown }) => typeof job.id === "number" && visible.has(job.id))
          .map((job: { id: number; status?: unknown }) => ({
            jobId: job.id,
            status: job.status === "dead_letter" ? "failed" : job.status === "running" || job.status === "completed" || job.status === "failed" ? job.status : "queued",
          }))
        : []
      if (cancelled) return

      const statusByJob = new Map(
        updates
          .map((item): [number, "queued" | "running" | "completed" | "failed"] => [item.jobId, item.status]),
      )
      if (!statusByJob.size) return

      setChat((current) => ({
        ...current,
        messages: current.messages.map((item) => (
          typeof item.jobId === "number" && statusByJob.has(item.jobId)
            ? { ...item, status: statusByJob.get(item.jobId) ?? item.status }
            : item
        )),
        updatedAt: new Date().toISOString(),
      }))

      if ([...statusByJob.values()].some((status) => status === "completed" || status === "failed")) {
        router.refresh()
      }
    }

    void poll()
    const timer = window.setInterval(() => void poll(), 1800)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeJobIds, router])

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
      if (Array.isArray(json.suggestions)) setSuggestions(json.suggestions)
      if (json.ok === false && json.message?.content) setError(json.message.content)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to route Forge command.")
      if (!confirmed) setMessage(command)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex min-w-0 items-center gap-2">
            <Bot size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Command Chat</h2>
            <span className="hidden sm:inline-flex">
              <Badge value="Control surface" tone="accent" />
            </span>
          </div>
          <p className="max-w-[780px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Plans production work against the current run, validates it deterministically, and stops at approvals, budgets and release gates.
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
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.message}
            type="button"
            onClick={() => void sendCommand(suggestion.message)}
            disabled={busy || disabled || !suggestion.enabled}
            title={suggestion.enabled ? undefined : suggestion.reason ?? "Unavailable in the current run state"}
            className="max-w-full rounded-lg border px-3 py-2 text-left font-dm text-xs leading-4 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.s2, borderColor:T.b1, color:T.t2 }}
          >
            <span className="block">{suggestion.message}</span>
            {!suggestion.enabled && suggestion.reason && <span className="mt-1 block text-[10px]" style={{ color:T.t3 }}>{suggestion.reason}</span>}
          </button>
        ))}
      </div>

      <div className="mb-4 space-y-3 rounded-lg border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
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
          {pendingConfirmation.plan && <PlanCard plan={pendingConfirmation.plan} />}
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
          {message.action && <Badge value={forgeCommandLabel(message.action)} tone="muted" />}
          {message.status && <Badge value={statusLabel(message.status)} tone={statusTone(message.status)} />}
        </div>
        <p className="whitespace-pre-wrap font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{message.content}</p>
        {(message.runId || message.taskId || message.jobId) && <details className="mt-2 text-xs" style={{ color:T.t3 }}><summary className="cursor-pointer">Technical details</summary><div className="mt-1 flex flex-wrap gap-3">{message.runId && <span>Run #{message.runId}</span>}{message.taskId && <span>Task #{message.taskId}</span>}{message.jobId && <span>Job #{message.jobId}</span>}</div></details>}
      </div>
    </div>
  )
}

function PlanCard({ plan }: { plan: NonNullable<ForgeCommandChatMessage["plan"]> }) {
  return <div className="mt-3 grid gap-3 rounded-lg p-3" style={{ background:T.s1 }}>
    <div className="flex flex-wrap items-center justify-between gap-2"><strong className="font-dm text-sm">{plan.summary}</strong><span className="inline-flex items-center gap-1 text-xs" style={{ color:T.t2 }}><CircleDollarSign size={14} aria-hidden="true" />Estimated ${plan.estimatedCost.toFixed(4)}</span></div>
    <div><span className="font-dm text-[10px] font-semibold uppercase tracking-[.08em]" style={{ color:T.t3 }}>Affected stages</span><div className="mt-1 flex flex-wrap gap-1">{plan.affectedStages.map((stage) => <Badge key={stage} value={stage.replaceAll("_", " ")} tone="muted" />)}</div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><span className="font-dm text-[10px] font-semibold uppercase tracking-[.08em]" style={{ color:T.t3 }}>Plan</span><ol className="mt-1 list-inside list-decimal space-y-1 text-xs" style={{ color:T.t2 }}>{plan.steps.map((step) => <li key={step.id}>{step.summary}</li>)}</ol></div><div><span className="font-dm text-[10px] font-semibold uppercase tracking-[.08em]" style={{ color:T.t3 }}>Stop conditions</span><ul className="mt-1 list-inside list-disc space-y-1 text-xs" style={{ color:T.t2 }}>{plan.stopConditions.map((condition) => <li key={condition}>{condition}</li>)}</ul></div></div>
    {!!plan.requiredApprovals.length && <p className="text-xs" style={{ color:T.amb }}><strong>Approvals:</strong> {plan.requiredApprovals.join(", ")}</p>}
  </div>
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

function statusLabel(status: NonNullable<ForgeCommandChatMessage["status"]>) {
  if (status === "needs_confirmation") return "Needs confirmation"
  if (status === "needs_clarification") return "Needs clarification"
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusTone(status: NonNullable<ForgeCommandChatMessage["status"]>): "accent" | "good" | "warn" | "bad" | "muted" {
  if (status === "failed") return "bad"
  if (status === "needs_confirmation" || status === "needs_clarification" || status === "queued") return "warn"
  if (status === "running") return "accent"
  if (status === "completed") return "good"
  return "muted"
}
