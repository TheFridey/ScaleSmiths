"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, FileText, Globe2, Loader2, Paperclip, Sparkles, WandSparkles } from "lucide-react"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { FORGE_INTAKE_SECTIONS, FORGE_PRIORITIES, type ForgeIntakeData, type ForgePriority } from "@/lib/forge"
import type { ForgeIntakeAsset, ForgeIntakeInterpretation, ForgeProjectIntakeInput } from "@/lib/forge-project-intake"
import { parseForgeIntakeDraft, serializeForgeIntakeDraft, type ForgeIntakeDraft } from "@/lib/forge-intake-draft"

const STORAGE_KEY = "scalesmiths:forge-project-intake:v1"
const SUMMARY_FIELDS: Array<{ key: keyof ForgeIntakeInterpretation["summary"]; label: string; rows?: number }> = [
  { key: "business", label: "Business", rows: 3 },
  { key: "projectType", label: "Project type" },
  { key: "primaryOutcome", label: "Primary outcome", rows: 2 },
  { key: "targetAudience", label: "Target audience", rows: 3 },
  { key: "proposedPages", label: "Proposed pages", rows: 5 },
  { key: "requiredFunctionality", label: "Required functionality", rows: 4 },
  { key: "designDirection", label: "Design direction", rows: 3 },
  { key: "integrations", label: "Integrations", rows: 3 },
  { key: "contentAssumptions", label: "Content assumptions", rows: 5 },
  { key: "exclusions", label: "Exclusions", rows: 3 },
  { key: "openQuestions", label: "Open questions", rows: 3 },
]

export function ForgeProjectIntake() {
  const router = useRouter()
  const hydrated = useRef(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [input, setInput] = useState<ForgeProjectIntakeInput>(() => emptyInput())
  const [interpretation, setInterpretation] = useState<ForgeIntakeInterpretation | null>(null)
  const [summary, setSummary] = useState<ForgeIntakeInterpretation["summary"] | null>(null)
  const [submissionKey, setSubmissionKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState<"interpret" | "approve" | "files" | "">("")
  const [error, setError] = useState("")
  const [recovery, setRecovery] = useState("")
  const [savedAt, setSavedAt] = useState("")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const draft = parseForgeIntakeDraft(stored)
        if (draft?.input && (draft.step === 1 || draft.step === 2)) {
          setInput(draft.input)
          setStep(draft.step)
          setInterpretation(draft.interpretation)
          setSummary(draft.summary)
          setSubmissionKey(draft.submissionKey || crypto.randomUUID())
          setSavedAt(draft.savedAt)
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    } finally {
      hydrated.current = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    const timeout = window.setTimeout(() => {
      const now = new Date().toISOString()
      const draft: ForgeIntakeDraft = { step, input, interpretation, summary, submissionKey, savedAt: now }
      try {
        localStorage.setItem(STORAGE_KEY, serializeForgeIntakeDraft(draft))
        setSavedAt(now)
      } catch {
        setError("This draft is too large for browser recovery. Remove one or more uploaded assets; your current page remains unchanged.")
      }
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [input, interpretation, step, submissionKey, summary])

  async function generateInterpretation() {
    setBusy("interpret")
    setError("")
    setRecovery("")
    try {
      const response = await fetch("/api/forge/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "interpret", input }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) {
        setRecovery(typeof json.recovery === "string" ? json.recovery : "")
        throw new Error(json.error || "Forge could not interpret this project.")
      }
      setInterpretation(json.interpretation)
      setSummary(json.interpretation.summary)
      setStep(2)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Forge could not interpret this project.")
    } finally {
      setBusy("")
    }
  }

  async function approveAndBuild() {
    if (!interpretation || !summary) return
    setBusy("approve")
    setError("")
    try {
      const response = await fetch("/api/forge/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", interpretation, summary, submissionKey }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok || !json.ok) {
        const missing = Array.isArray(json.missingCritical) ? ` ${json.missingCritical.map((item: { label?: string }) => item.label).filter(Boolean).join(", ")}` : ""
        throw new Error(`${json.error || "Unable to approve and start this build."}${missing}`)
      }
      localStorage.removeItem(STORAGE_KEY)
      router.push(json.redirectTo || `/forge/${json.project.id}?view=overview`)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to approve and start this build.")
    } finally {
      setBusy("")
    }
  }

  async function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 10)
    if (!files.length) return
    setBusy("files")
    setError("")
    try {
      const totalBytes = [...(input.assets ?? []), ...files].reduce((sum, asset) => sum + asset.size, 0)
      if (totalBytes > 3_000_000) throw new Error("Uploaded assets must remain under 3MB in total so the intake can recover safely after refresh.")
      const assets = await Promise.all(files.map(readAsset))
      setInput((current) => ({ ...current, assets: [...(current.assets ?? []), ...assets].slice(0, 10) }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read the selected files.")
    } finally {
      setBusy("")
      event.target.value = ""
    }
  }

  function updateAdvanced(key: keyof NonNullable<ForgeProjectIntakeInput["advanced"]>, value: string) {
    setInput((current) => ({ ...current, advanced: { ...current.advanced, [key]: value } }))
  }

  return (
    <main className="mx-auto w-full max-w-5xl pb-16">
      <Link href="/forge" className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm text-[var(--t2)] hover:text-white">
        <ArrowLeft size={16} aria-hidden="true" /> Back to Forge
      </Link>

      <header className="mb-8">
        <div className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[.14em] text-cyan-300">
          <span>Project intake</span><span aria-hidden="true">/</span><span>Step {step} of 3</span>
        </div>
        <h1 className="font-syne text-3xl font-bold tracking-tight sm:text-4xl">{step === 1 ? "Describe the project" : "Approve Forge’s interpretation"}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--t2)]">
          {step === 1
            ? "Give Forge a URL, a plain-English request, or both. Everything else is optional."
            : "Confirmed facts and assumptions are separated below. Edit any section directly before starting production."}
        </p>
        <p className="mt-2 text-xs text-[var(--t3)]" aria-live="polite">{savedAt ? `Draft saved locally ${formatSavedAt(savedAt)}.` : "Draft autosave will begin as you type."}</p>
      </header>

      {error && <Alert>{error}{recovery && <span className="mt-1 block text-[var(--t2)]">{recovery}</span>}</Alert>}

      {step === 1 ? (
        <section className="space-y-6 rounded-2xl bg-[var(--s1)] p-5 shadow-[0_20px_60px_rgba(0,0,0,.18)] sm:p-8">
          <Field label="Existing website URL" note="Optional. Forge will safely read public pages and use current factual content.">
            <div className="relative">
              <Globe2 className="pointer-events-none absolute left-3 top-3.5 text-[var(--t3)]" size={18} aria-hidden="true" />
              <input className="min-h-11 w-full pl-10" type="url" value={input.websiteUrl ?? ""} onChange={(event) => setInput((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://example.com" />
            </div>
          </Field>
          <Field label="What should Forge build?" note="Plain English is best. Include the business, desired outcome, audience, positioning and useful features when known.">
            <textarea className="min-h-40 w-full text-base leading-7" value={input.request ?? ""} onChange={(event) => setInput((current) => ({ ...current, request: event.target.value }))} placeholder="Build a premium lead-generation website for a Nottingham commercial roofing company. They want larger contracts, have weak branding and need enquiries sent by email and WhatsApp." />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Deadline" note="Optional"><input className="min-h-11 w-full" type="date" value={input.deadline ?? ""} onChange={(event) => setInput((current) => ({ ...current, deadline: event.target.value }))} /></Field>
            <Field label="Budget" note="Optional"><input className="min-h-11 w-full" value={input.budgetRange ?? ""} onChange={(event) => setInput((current) => ({ ...current, budgetRange: event.target.value }))} placeholder="£3,000–£5,000" /></Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="group flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl bg-[var(--s2)] p-4 text-center outline-none ring-cyan-400 focus-within:ring-2">
              <Paperclip size={21} className="mb-2 text-cyan-300" aria-hidden="true" />
              <span className="font-semibold">Add assets or documents</span>
              <span className="mt-1 text-xs text-[var(--t3)]">Up to 10 files, 2MB each</span>
              <input className="sr-only" type="file" multiple onChange={addFiles} disabled={busy === "files"} />
            </label>
            <Field label="Existing documents or content" note="Optional. Paste source copy, notes, constraints or content references.">
              <textarea className="min-h-28 w-full" value={input.existingContent ?? ""} onChange={(event) => setInput((current) => ({ ...current, existingContent: event.target.value }))} />
            </Field>
          </div>
          {!!input.assets?.length && <AssetList assets={input.assets} onRemove={(index) => setInput((current) => ({ ...current, assets: current.assets?.filter((_, itemIndex) => itemIndex !== index) }))} />}

          <details className="rounded-xl bg-[var(--s2)] p-4">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold">
              Advanced details <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p className="mb-5 mt-1 text-sm text-[var(--t3)]">The original structured project fields remain available. Forge only uses values you provide here to override its interpretation.</p>
            <div className="grid gap-4 md:grid-cols-2">
              {(["name", "businessName", "industry", "targetAudience", "primaryGoal"] as const).map((key) => (
                <Field key={key} label={labelize(key)}>
                  <input className="min-h-11 w-full" value={input.advanced?.[key] ?? ""} onChange={(event) => updateAdvanced(key, event.target.value)} />
                </Field>
              ))}
              <Field label="Priority">
                <select className="min-h-11 w-full" value={input.priority ?? "medium"} onChange={(event) => setInput((current) => ({ ...current, priority: event.target.value as ForgePriority }))}>
                  {FORGE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2"><Field label="Brand notes"><textarea className="min-h-24 w-full" value={input.advanced?.brandNotes ?? ""} onChange={(event) => updateAdvanced("brandNotes", event.target.value)} /></Field></div>
            </div>
          </details>

          <div className="flex justify-end">
            <button type="button" onClick={generateInterpretation} disabled={busy !== "" || (!input.request?.trim() && !input.websiteUrl?.trim())} className="forge-primary-action min-h-11 px-5">
              {busy === "interpret" ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
              {busy === "interpret" ? "Reading and interpreting…" : "Generate brief"}
            </button>
          </div>
        </section>
      ) : interpretation && summary ? (
        <section className="space-y-6">
          <div className="grid gap-4 rounded-2xl bg-[var(--s1)] p-5 sm:grid-cols-3 sm:p-6">
            <Signal label="Strategy" value={interpretation.strategyPack.label} />
            <Signal label="Confirmed" value={`${interpretation.confirmedFields.length} inputs`} />
            <Signal label="Assumptions" value={`${interpretation.assumedFields.length} editable`} />
          </div>

          {!!interpretation.missingCritical.length && <Alert>{interpretation.missingCritical.length} critical item{interpretation.missingCritical.length === 1 ? "" : "s"} still need confirmation: {interpretation.missingCritical.map((item) => item.label).join(", ")}.</Alert>}

          <div className="grid gap-4 lg:grid-cols-2">
            {SUMMARY_FIELDS.map(({ key, label, rows }) => (
              <Field key={key} label={label} note={interpretation.assumedFields.some((field) => label.toLowerCase().includes(field)) ? "Assumption — edit or confirm" : "Editable interpretation"}>
                {key === "projectType" ? (
                  <select className="min-h-11 w-full" value={summary.projectType} onChange={(event) => setSummary((current) => current ? { ...current, projectType: event.target.value as ForgeIntakeInterpretation["summary"]["projectType"] } : current)}>
                    <option value="new_build">New build</option><option value="redesign">Redesign</option><option value="migration">Migration</option>
                  </select>
                ) : (
                  <textarea className="w-full leading-6" rows={rows ?? 2} value={summary[key]} onChange={(event) => setSummary((current) => current ? { ...current, [key]: event.target.value } : current)} />
                )}
              </Field>
            ))}
          </div>

          <details className="rounded-xl bg-[var(--s1)] p-5">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between font-semibold">Manual structured brief <ChevronDown size={18} aria-hidden="true" /></summary>
            <p className="mb-5 mt-1 text-sm text-[var(--t3)]">All existing intake fields remain editable. These values feed the existing research, sitemap, copy and design agents.</p>
            <StructuredIntake intake={interpretation.intake} onChange={(intake) => setInterpretation((current) => current ? { ...current, intake } : current)} />
          </details>

          <div className="flex flex-wrap gap-2">
            <Choice onClick={() => setSummary((current) => current ? { ...current, openQuestions: "Use Forge judgement and the stated assumptions for all non-critical details." } : current)}>Use your judgement</Choice>
            <Choice onClick={() => setSummary((current) => current ? { ...current, openQuestions: "No further questions. Decide sensible defaults and flag only production blockers." } : current)}>Ask me less</Choice>
            <Choice onClick={() => setSummary((current) => current ? { ...current, contentAssumptions: `${current.contentAssumptions}\nUse current website content where accurate.` } : current)} disabled={!input.websiteUrl}>Use current website</Choice>
            <Choice onClick={() => setSummary((current) => current ? { ...current, openQuestions: "Skipped by operator; use sensible defaults." } : current)}>Skip</Choice>
            <Choice onClick={() => setSummary((current) => current ? { ...current, openQuestions: "Decide sensible defaults for all remaining non-critical details." } : current)}>Decide sensible defaults</Choice>
          </div>

          <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl bg-[rgba(13,17,23,.96)] p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => setStep(1)} className="min-h-11 rounded-lg px-4 text-sm font-semibold text-[var(--t2)] hover:bg-white/5 hover:text-white">Back to description</button>
            <button type="button" onClick={approveAndBuild} disabled={busy !== ""} className="forge-primary-action min-h-11 px-5">
              {busy === "approve" ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <WandSparkles size={18} aria-hidden="true" />}
              {busy === "approve" ? "Creating project and run…" : "Approve Brief and Build Draft"}
            </button>
          </div>
        </section>
      ) : null}
    </main>
  )
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 flex items-baseline justify-between gap-3 font-semibold"><span>{label}</span>{note && <span className="text-right text-xs font-normal text-[var(--t3)]">{note}</span>}</span>{children}</label>
}

function Alert({ children }: { children: React.ReactNode }) {
  return <div role="alert" className="mb-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-100 ring-1 ring-inset ring-red-400/25">{children}</div>
}

function Signal({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-xs uppercase tracking-[.12em] text-[var(--t3)]">{label}</span><strong className="mt-1 block text-base">{value}</strong></div>
}

function Choice({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className="min-h-10 rounded-lg bg-[var(--s2)] px-3 text-sm text-[var(--t2)] hover:text-white disabled:opacity-40" {...props}>{children}</button>
}

function AssetList({ assets, onRemove }: { assets: ForgeIntakeAsset[]; onRemove: (index: number) => void }) {
  return <ul className="space-y-2" aria-label="Selected assets">{assets.map((asset, index) => <li key={`${asset.name}-${index}`} className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-[var(--s2)] px-3"><span className="flex min-w-0 items-center gap-2 text-sm"><FileText size={15} className="shrink-0 text-cyan-300" aria-hidden="true" /><span className="truncate">{asset.name}</span><span className="text-xs text-[var(--t3)]">{formatBytes(asset.size)}</span></span><button type="button" className="rounded px-2 py-1 text-xs text-[var(--t2)] hover:text-white" onClick={() => onRemove(index)}>Remove</button></li>)}</ul>
}

function StructuredIntake({ intake, onChange }: { intake: ForgeIntakeData; onChange: (intake: ForgeIntakeData) => void }) {
  return <div className="space-y-7">{FORGE_INTAKE_SECTIONS.map((section) => <section key={section.key}><h3 className="mb-3 font-semibold">{section.label}</h3><div className="grid gap-4 md:grid-cols-2">{section.fields.map((field) => <Field key={field.key} label={field.label} note={field.required ? "Existing required field" : "Optional"}>{"multiline" in field && field.multiline ? <textarea className="min-h-24 w-full" value={intake[field.key]} onChange={(event) => onChange({ ...intake, [field.key]: event.target.value })} /> : <input className="min-h-11 w-full" value={intake[field.key]} onChange={(event) => onChange({ ...intake, [field.key]: event.target.value })} />}</Field>)}</div></section>)}</div>
}

async function readAsset(file: File): Promise<ForgeIntakeAsset> {
  if (file.size > 2_000_000) throw new Error(`${file.name} is larger than 2MB.`)
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`))
    reader.readAsDataURL(file)
  })
  return { name: file.name, type: file.type || "application/octet-stream", size: file.size, dataUrl }
}

function emptyInput(): ForgeProjectIntakeInput {
  return { websiteUrl: "", request: "", existingContent: "", deadline: "", budgetRange: "", priority: "medium", assets: [], advanced: {} }
}

function labelize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function formatSavedAt(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
function formatBytes(value: number) { return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB` }
