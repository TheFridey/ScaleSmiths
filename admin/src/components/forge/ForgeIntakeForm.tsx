"use client"

import { FormEvent, useEffect, useMemo, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { Bot, CheckCircle2, ClipboardCheck, Loader2, Pencil, Save, Send, Sparkles } from "lucide-react"
import { FORGE_INTAKE_SECTIONS, type ForgeIntakeData, type ForgeIntakeFieldKey } from "@/lib/forge"
import { emptyForgeBuildBriefState, type ForgeBuildBriefState } from "@/lib/forge-intake-brief"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

interface IntakeMissingField {
  key: ForgeIntakeFieldKey
  label: string
  section: string
}

interface IntakeFormField {
  key: ForgeIntakeFieldKey
  label: string
  required: boolean
  multiline?: boolean
}

export interface ForgeIntakeState {
  intake: ForgeIntakeData
  completenessScore: number
  missingFields: IntakeMissingField[]
  status: "draft" | "completed"
  buildBrief?: ForgeBuildBriefState
}

const QUICK_REPLIES = ["skip", "use your judgement", "make it premium", "ask me less"] as const

export function ForgeIntakeForm({ projectId, initialIntake }: { projectId: number; initialIntake: ForgeIntakeState; websiteUrl?: string | null }) {
  const router = useRouter()
  const [draft, setDraft] = useState<ForgeIntakeData>(initialIntake.intake)
  const [buildBrief, setBuildBrief] = useState<ForgeBuildBriefState>(initialIntake.buildBrief ?? emptyForgeBuildBriefState())
  const [starterPrompt, setStarterPrompt] = useState(initialIntake.buildBrief?.starterPrompt ?? "")
  const [answer, setAnswer] = useState("")
  const [busy, setBusy] = useState<"" | "start" | "answer" | "generate" | "save" | "complete">("")
  const [error, setError] = useState("")
  const [score, setScore] = useState(initialIntake.completenessScore)
  const [missingFields, setMissingFields] = useState(initialIntake.missingFields)
  const [status, setStatus] = useState(initialIntake.status)
  const hasStarted = Boolean(buildBrief.starterPrompt || buildBrief.messages.length)
  const currentQuestion = [...buildBrief.messages].reverse().find((message) => message.role === "assistant")?.body
  const primaryMissing = missingFields.slice(0, 6)
  const briefSummary = useMemo(() => buildSummaryRows(draft), [draft])

  useEffect(() => {
    setDraft(initialIntake.intake)
    setBuildBrief(initialIntake.buildBrief ?? emptyForgeBuildBriefState())
    setStarterPrompt(initialIntake.buildBrief?.starterPrompt ?? "")
    setScore(initialIntake.completenessScore)
    setMissingFields(initialIntake.missingFields)
    setStatus(initialIntake.status)
  }, [initialIntake])

  async function postBrief(mode: "brief_start" | "brief_answer" | "brief_generate", payload: Record<string, string> = {}) {
    setBusy(mode === "brief_start" ? "start" : mode === "brief_answer" ? "answer" : "generate")
    setError("")

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...payload }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || "Unable to update guided intake.")
      applyIntakeResponse(json.intake)
      setAnswer("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update guided intake.")
    } finally {
      setBusy("")
    }
  }

  async function saveManual(event: FormEvent<HTMLFormElement>, action: "save" | "complete") {
    event.preventDefault()
    await saveManualForm(event.currentTarget, action)
  }

  async function saveManualForm(form: HTMLFormElement, action: "save" | "complete") {
    const body = Object.fromEntries(new FormData(form))
    setBusy(action)
    setError("")

    try {
      const response = await fetch(`/api/forge/projects/${projectId}/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, action }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) throw new Error(json.error || "Unable to save intake.")
      applyIntakeResponse(json.intake)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save intake.")
    } finally {
      setBusy("")
    }
  }

  function applyIntakeResponse(next: ForgeIntakeState) {
    setDraft(next.intake)
    setScore(next.completenessScore)
    setMissingFields(next.missingFields)
    setStatus(next.status)
    setBuildBrief(next.buildBrief ?? emptyForgeBuildBriefState())
    setStarterPrompt(next.buildBrief?.starterPrompt ?? starterPrompt)
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_380px]">
      <div className="rounded-[8px] border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Bot size={16} style={{ color:T.acc }} aria-hidden="true" />
              <h2 className="font-syne text-lg font-bold">Guided Build Brief</h2>
            </div>
            <p className="max-w-[780px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
              Start with one plain-English prompt. Forge fills the structured brief by asking only the next useful question.
            </p>
          </div>
          <BriefScore score={score} status={status} />
        </div>

        {error && (
          <div className="mb-4 rounded-[8px] border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
            {error}
          </div>
        )}

        {!hasStarted ? (
          <div className="rounded-[8px] border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
            <label className="font-dm text-sm">
              <span className="mb-2 block font-semibold text-white">What should Forge build?</span>
              <textarea
                value={starterPrompt}
                onChange={(event) => setStarterPrompt(event.target.value)}
                rows={4}
                className="w-full rounded-[8px] border px-3 py-3 font-dm text-sm outline-none"
                style={{ background:T.s3, borderColor:T.b2, color:T.t1 }}
                placeholder="Build a premium Minecraft server website for RTXGaming."
              />
            </label>
            <button
              type="button"
              onClick={() => void postBrief("brief_start", { prompt: starterPrompt })}
              disabled={busy === "start" || !starterPrompt.trim()}
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-[8px] px-4 py-2 font-dm text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background:T.acc }}
            >
              {busy === "start" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
              Start Guided Brief
            </button>
          </div>
        ) : (
          <div className="grid min-h-[540px] grid-rows-[1fr_auto] gap-4">
            <div className="space-y-3 overflow-auto rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              {buildBrief.messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[760px] rounded-[8px] border px-3 py-2" style={{ background:message.role === "user" ? T.s3 : T.s1, borderColor:T.b1 }}>
                    <div className="mb-1 font-dm text-[10px] font-semibold uppercase tracking-[.08em]" style={{ color:message.role === "user" ? T.acc : T.t3 }}>
                      {message.role === "user" ? "You" : "Forge"}
                    </div>
                    <p className="whitespace-pre-wrap font-dm text-sm leading-relaxed" style={{ color:T.t1 }}>{message.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
              <div className="mb-3 flex flex-wrap gap-2">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    type="button"
                    onClick={() => void postBrief("brief_answer", { answer: reply })}
                    disabled={busy !== "" || !buildBrief.currentQuestionId}
                    className="rounded-[8px] border px-3 py-2 font-dm text-xs font-semibold disabled:opacity-55"
                    style={{ background:T.s1, borderColor:T.b2, color:T.t2 }}
                  >
                    {reply}
                  </button>
                ))}
              </div>
              <form
                className="flex flex-col gap-2 md:flex-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  void postBrief("brief_answer", { answer })
                }}
              >
                <label className="sr-only" htmlFor="forge-brief-answer">Answer Forge question</label>
                <input
                  id="forge-brief-answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  disabled={busy !== "" || !buildBrief.currentQuestionId}
                  className="min-h-11 flex-1 rounded-[8px] border px-3 py-2 font-dm text-sm disabled:opacity-60"
                  style={{ background:T.s3, borderColor:T.b2, color:T.t1 }}
                  placeholder={currentQuestion ?? "Brief is ready to generate"}
                />
                <button
                  type="submit"
                  disabled={busy !== "" || !answer.trim() || !buildBrief.currentQuestionId}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] px-4 py-2 font-dm text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background:T.acc }}
                >
                  {busy === "answer" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
                  Send
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <section className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} style={{ color:T.acc }} aria-hidden="true" />
              <h2 className="font-syne text-lg font-bold">Current Brief</h2>
            </div>
            <span className="font-dm text-[11px]" style={{ color:T.t2 }}>{buildBrief.completedQuestionIds.length} answers</span>
          </div>
          <div className="space-y-2">
            {briefSummary.map((row) => (
              <div key={row.label} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                <div className="font-dm text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color:T.t3 }}>{row.label}</div>
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap font-dm text-xs leading-relaxed" style={{ color:row.value ? T.t1 : T.t2 }}>{row.value || "Not set yet"}</p>
              </div>
            ))}
          </div>
          {primaryMissing.length > 0 && (
            <div className="mt-3 rounded-[8px] border p-3" style={{ background:"rgba(245,158,11,.08)", borderColor:"rgba(245,158,11,.28)" }}>
              <div className="font-dm text-xs font-semibold" style={{ color:T.amb }}>Still useful to know</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {primaryMissing.map((field) => (
                  <span key={field.key} className="rounded px-2 py-1 font-dm text-[10px]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:T.t2 }}>
                    {field.label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void postBrief("brief_generate")}
            disabled={busy !== "" || (!hasStarted && score === 0)}
            className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] px-4 py-2 font-dm text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background:T.acc }}
          >
            {busy === "generate" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
            Generate from current brief
          </button>
        </section>

        <details className="rounded-[8px] border p-4" style={{ background:T.s1, borderColor:T.b1 }}>
          <summary className="flex cursor-pointer list-none items-center gap-2 font-dm text-sm font-semibold">
            <Pencil size={15} style={{ color:T.acc }} aria-hidden="true" />
            Manual edit final brief
          </summary>
          <form className="mt-4 space-y-4" onSubmit={(event) => void saveManual(event, "save")}>
            {FORGE_INTAKE_SECTIONS.map((section) => (
              <div key={section.key} className="rounded-[8px] border p-3" style={{ background:T.s2, borderColor:T.b1 }}>
                <h3 className="font-dm text-xs font-bold uppercase tracking-[.1em]" style={{ color:T.t2 }}>{section.label}</h3>
                <div className="mt-3 grid gap-3">
                  {(section.fields as readonly IntakeFormField[]).map((field) => {
                    const multiline = "multiline" in field && field.multiline
                    return (
                      <label key={field.key} className="font-dm text-xs">
                        <span className="mb-1 block" style={{ color:T.t2 }}>{field.label}{field.required ? " *" : ""}</span>
                        {multiline ? (
                          <textarea
                            name={field.key}
                            value={draft[field.key] ?? ""}
                            onChange={(event) => updateDraft(field.key, event)}
                            rows={3}
                          />
                        ) : (
                          <input
                            name={field.key}
                            value={draft[field.key] ?? ""}
                            onChange={(event) => updateDraft(field.key, event)}
                          />
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
            <div className="flex flex-wrap justify-end gap-2">
              <button disabled={busy === "save"} className="inline-flex items-center gap-1.5 rounded-[8px] border px-4 py-2 font-dm text-sm disabled:opacity-60" style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}>
                <Save size={15} aria-hidden="true" /> {busy === "save" ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  const form = event.currentTarget.form
                  if (form) void saveManualForm(form, "complete")
                }}
                disabled={busy === "complete"}
                className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 font-dm text-sm font-semibold text-white disabled:opacity-60"
                style={{ background:T.acc }}
              >
                <ClipboardCheck size={15} aria-hidden="true" /> Complete
              </button>
            </div>
          </form>
        </details>
      </aside>
    </section>
  )

  function updateDraft(key: ForgeIntakeFieldKey, event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setDraft((current) => ({ ...current, [key]: event.target.value }))
  }
}

function BriefScore({ score, status }: { score: number; status: "draft" | "completed" }) {
  return (
    <div className="min-w-full rounded-[8px] border p-3 sm:min-w-[220px]" style={{ background:T.s2, borderColor:T.b1 }}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Brief readiness</span>
        <span className="font-syne text-sm font-bold" style={{ color:score === 100 ? T.grn : score >= 70 ? T.amb : T.red }}>{score}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background:T.s3 }}>
        <div className="h-full rounded-full" style={{ width:`${score}%`, background:score === 100 ? T.grn : score >= 70 ? T.amb : T.red }} />
      </div>
      <div className="mt-2 font-dm text-[11px]" style={{ color:status === "completed" ? T.grn : T.t2 }}>{status === "completed" ? "Generated" : "Draft"}</div>
    </div>
  )
}

function buildSummaryRows(intake: ForgeIntakeData) {
  return [
    { label: "Site Type", value: intake.businessOverview || intake.coreServices },
    { label: "Audience", value: intake.idealCustomers },
    { label: "Goal", value: intake.primaryWebsiteGoal },
    { label: "Style", value: intake.visualStyle || intake.brandTone },
    { label: "Pages", value: intake.requiredPages },
    { label: "CTAs", value: intake.conversionActions },
    { label: "Links / Features", value: [intake.requiredIntegrations, intake.assetAccessNotes].filter(Boolean).join("\n") },
  ]
}
