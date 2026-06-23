"use client"

import { FormEvent, useEffect, useMemo, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { ClipboardCheck, Save } from "lucide-react"
import { FORGE_INTAKE_SECTIONS, type ForgeIntakeData, type ForgeIntakeFieldKey } from "@/lib/forge"

const T = { s1:"var(--s1)", s2:"var(--s2)", s3:"var(--s3)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", grn:"var(--grn)", amb:"var(--amb)", red:"var(--red)" }

interface IntakeMissingField {
  key: ForgeIntakeFieldKey
  label: string
  section: string
}

type IntakeSectionKey = (typeof FORGE_INTAKE_SECTIONS)[number]["key"]

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
}

export function ForgeIntakeForm({ projectId, initialIntake }: { projectId: number; initialIntake: ForgeIntakeState }) {
  const router = useRouter()
  const [draft, setDraft] = useState<ForgeIntakeData>(initialIntake.intake)
  const [activeSectionKey, setActiveSectionKey] = useState<IntakeSectionKey>(FORGE_INTAKE_SECTIONS[0].key)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [score, setScore] = useState(initialIntake.completenessScore)
  const [missingFields, setMissingFields] = useState(initialIntake.missingFields)
  const [status, setStatus] = useState(initialIntake.status)
  const missingByKey = useMemo(() => new Set(missingFields.map((field) => field.key)), [missingFields])
  const activeSection = FORGE_INTAKE_SECTIONS.find((section) => section.key === activeSectionKey) ?? FORGE_INTAKE_SECTIONS[0]
  const activeFields = activeSection.fields as readonly IntakeFormField[]
  const allFields = FORGE_INTAKE_SECTIONS.flatMap((section) => [...section.fields]) as IntakeFormField[]
  const hiddenFields = allFields.filter((field) => !activeFields.some((activeField) => activeField.key === field.key))

  useEffect(() => {
    setDraft(initialIntake.intake)
    setScore(initialIntake.completenessScore)
    setMissingFields(initialIntake.missingFields)
    setStatus(initialIntake.status)
  }, [initialIntake])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await saveForm(event.currentTarget, "save")
  }

  async function saveForm(form: HTMLFormElement, action: "save" | "complete") {
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

      if (!response.ok || !json.ok) {
        if (Array.isArray(json.missingFields)) setMissingFields(json.missingFields)
        if (typeof json.completenessScore === "number") setScore(json.completenessScore)
        throw new Error(json.error || "Unable to save intake.")
      }

      setScore(json.intake.completenessScore)
      setMissingFields(json.intake.missingFields)
      setStatus(json.intake.status)
      setDraft(json.intake.intake)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save intake.")
    } finally {
      setBusy("")
    }
  }

  return (
    <form className="rounded-xl border p-4 sm:p-5" style={{ background:T.s1, borderColor:T.b1 }} onSubmit={submit}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <ClipboardCheck size={16} style={{ color:T.acc }} aria-hidden="true" />
            <h2 className="font-syne text-lg font-bold">Intake</h2>
          </div>
          <p className="max-w-[720px] font-dm text-sm leading-relaxed" style={{ color:T.t2 }}>
            Structured client brief for future research, sitemap, copy, design, build, and integration agents.
          </p>
        </div>
        <div className="min-w-full rounded-lg border p-3 sm:min-w-[220px]" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-dm text-[11px] uppercase tracking-[.08em]" style={{ color:T.t3 }}>Completeness</span>
            <span className="font-syne text-sm font-bold" style={{ color:score === 100 ? T.grn : score >= 70 ? T.amb : T.red }}>{score}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background:T.s3 }}>
            <div className="h-full rounded-full" style={{ width:`${score}%`, background:score === 100 ? T.grn : score >= 70 ? T.amb : T.red }} />
          </div>
          <div className="mt-2 font-dm text-[11px]" style={{ color:status === "completed" ? T.grn : T.t2 }}>{status === "completed" ? "Completed" : "Draft"}</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {missingFields.length > 0 && (
        <div className="mb-5 rounded-lg border p-4" style={{ background:"rgba(245,158,11,.08)", borderColor:"rgba(245,158,11,.26)" }}>
          <div className="font-dm text-sm font-semibold" style={{ color:T.t1 }}>Missing information</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {missingFields.map((field) => (
              <span key={field.key} className="rounded px-2 py-1 font-dm text-[11px]" style={{ background:T.s2, border:`1px solid ${T.b2}`, color:T.amb }}>
                {field.section}: {field.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {hiddenFields.map((field) => (
        <input key={field.key} type="hidden" name={field.key} value={draft[field.key] ?? ""} />
      ))}

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className="min-w-0 rounded-lg border p-2" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="flex gap-1 overflow-x-auto xl:flex-col xl:overflow-visible">
            {FORGE_INTAKE_SECTIONS.map((section, index) => {
              const active = section.key === activeSection.key
              const missingCount = section.fields.filter((field) => missingByKey.has(field.key)).length
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSectionKey(section.key)}
                  className="flex min-h-10 shrink-0 items-center justify-between gap-3 rounded-[7px] px-3 text-left font-dm text-xs transition-colors xl:w-full"
                  style={{ background:active ? T.s3 : "transparent", color:active ? T.t1 : T.t2 }}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-syne text-[11px] font-extrabold" style={{ color:active ? T.acc : T.t3 }}>{String(index + 1).padStart(2, "0")}</span>
                    <span>{section.label}</span>
                  </span>
                  {missingCount > 0 && (
                    <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background:"rgba(245,158,11,.1)", color:T.amb }}>
                      {missingCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <section className="min-w-0 rounded-xl border p-4" style={{ background:T.s2, borderColor:T.b1 }}>
          <div className="mb-4">
            <h3 className="font-syne text-[15px] font-bold">{activeSection.label}</h3>
            <p className="mt-1 font-dm text-xs leading-relaxed" style={{ color:T.t2 }}>{activeSection.description}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {activeFields.map((field) => {
              const missing = missingByKey.has(field.key)
              const value = draft[field.key] ?? ""
              const multiline = "multiline" in field && field.multiline
              const common = {
                name: field.key,
                value,
                "aria-invalid": missing || undefined,
                onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                  setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                },
              }

              return (
                <label key={field.key} className={multiline ? "font-dm text-sm md:col-span-2" : "font-dm text-sm"}>
                  <span className="mb-1 flex items-center gap-1.5 text-[11px]" style={{ color:missing ? T.amb : T.t2 }}>
                    {field.label}{field.required ? " *" : ""}
                  </span>
                  {multiline ? (
                    <textarea rows={4} {...common} />
                  ) : (
                    <input {...common} />
                  )}
                </label>
              )
            })}
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 -mx-4 mt-5 flex flex-wrap justify-end gap-2 border-t px-4 pt-4 sm:-mx-5 sm:px-5" style={{ background:T.s1, borderColor:T.b1 }}>
        <button disabled={busy === "save"} className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 font-dm text-sm disabled:opacity-60" style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}>
          <Save size={15} aria-hidden="true" /> {busy === "save" ? "Saving..." : "Save Draft"}
        </button>
        <button
          type="button"
          onClick={(event) => {
            if (event.currentTarget.form) void saveForm(event.currentTarget.form, "complete")
          }}
          disabled={busy === "complete"}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60"
          style={{ background:T.acc }}
        >
          <ClipboardCheck size={15} aria-hidden="true" /> {busy === "complete" ? "Completing..." : "Complete Intake"}
        </button>
      </div>
    </form>
  )
}
