"use client"

import { FormEvent, useEffect, useState, type ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Archive, Save, Sparkles } from "lucide-react"
import Link from "next/link"
import { FORGE_PRIORITIES, type ForgePriority, type ForgeProjectStatus } from "@/lib/forge"

const T = { s1:"var(--s1)", s2:"var(--s2)", b1:"var(--b1)", b2:"var(--b2)", t1:"var(--t1)", t2:"var(--t2)", t3:"var(--t3)", acc:"var(--acc)", red:"var(--red)" }

export interface ForgeProjectFormValue {
  id?: number
  name: string
  businessName: string
  industry: string | null
  websiteUrl: string | null
  targetAudience: string | null
  primaryGoal: string | null
  budgetRange: string | null
  deadline: Date | string | null
  brandNotes: string | null
  priority: ForgePriority
  status?: ForgeProjectStatus
}

export function ForgeProjectForm({ project, mode }: { project?: ForgeProjectFormValue; mode: "create" | "edit" }) {
  const router = useRouter()
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [values, setValues] = useState(() => initialValues(project))
  const isArchived = project?.status === "archived"

  useEffect(() => {
    setValues(initialValues(project))
  }, [project])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const body = Object.fromEntries(new FormData(form))
    setBusy("save")
    setError("")

    try {
      const response = await fetch(mode === "create" ? "/api/forge/projects" : `/api/forge/projects/${project?.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...body }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to save Forge project.")
      }

      router.push(`/forge/${json.project.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save Forge project.")
    } finally {
      setBusy("")
    }
  }

  async function autofillFromUrl() {
    const websiteUrl = values.websiteUrl.trim()
    if (!websiteUrl) {
      setError("Add a website URL first.")
      return
    }

    setBusy("autofill")
    setError("")
    setNotice("")

    try {
      const response = await fetch("/api/forge/url-autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to autofill from that URL.")
      }

      const suggested = json.autofill?.project ?? {}
      let applied = 0
      setValues((current) => {
        const next = { ...current }
        for (const key of ["name", "businessName", "industry", "targetAudience", "primaryGoal", "brandNotes"] as const) {
          if (!next[key].trim() && typeof suggested[key] === "string" && suggested[key].trim()) {
            next[key] = suggested[key].trim()
            applied += 1
          }
        }
        return next
      })
      setNotice(applied > 0 ? `Autofilled ${applied} empty field${applied === 1 ? "" : "s"} from the website.` : "No empty project fields could be confidently autofilled.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to autofill from that URL.")
    } finally {
      setBusy("")
    }
  }

  function setField(key: keyof ProjectFormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setValues((current) => ({ ...current, [key]: event.target.value }))
    }
  }

  async function archiveProject() {
    if (!project?.id || isArchived) return
    setBusy("archive")
    setError("")

    try {
      const response = await fetch(`/api/forge/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      })
      const json = await response.json().catch(() => ({}))

      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Unable to archive Forge project.")
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to archive Forge project.")
    } finally {
      setBusy("")
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border p-5" style={{ background:T.s1, borderColor:T.b1 }}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={project?.id ? `/forge/${project.id}` : "/forge"} className="mb-3 inline-flex items-center gap-1.5 font-dm text-xs" style={{ color:T.t2 }}>
            <ArrowLeft size={13} aria-hidden="true" /> Forge
          </Link>
          <h1 className="font-syne text-2xl font-extrabold tracking-tight">{mode === "create" ? "New Forge Project" : "Edit Project Details"}</h1>
          <p className="mt-1 font-dm text-sm" style={{ color:T.t2 }}>Capture the project brief that will power later research, production tasks, and generated artifacts.</p>
        </div>
        {mode === "edit" && (
          <button
            type="button"
            onClick={archiveProject}
            disabled={busy === "archive" || isArchived}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 font-dm text-sm disabled:opacity-55"
            style={{ background:T.s2, borderColor:T.b2, color:isArchived ? T.t2 : T.red }}
          >
            <Archive size={14} aria-hidden="true" /> {isArchived ? "Archived" : busy === "archive" ? "Archiving..." : "Archive"}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(239,68,68,.08)", borderColor:"rgba(239,68,68,.3)", color:T.t1 }}>
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border px-4 py-3 font-dm text-sm" style={{ background:"rgba(34,211,238,.08)", borderColor:"rgba(34,211,238,.28)", color:T.t1 }}>
          {notice}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Project name" name="name" value={values.name} onChange={setField("name")} required />
        <Field label="Business name" name="businessName" value={values.businessName} onChange={setField("businessName")} required />
        <Field label="Industry" name="industry" value={values.industry} onChange={setField("industry")} />
        <label className="font-dm text-sm">
          <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Current website URL</span>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input name="websiteUrl" type="url" placeholder="https://example.com" value={values.websiteUrl} onChange={setField("websiteUrl")} />
            <button
              type="button"
              onClick={autofillFromUrl}
              disabled={busy === "autofill" || !values.websiteUrl.trim()}
              className="inline-flex h-[42px] items-center justify-center gap-1.5 rounded-[8px] border px-3 font-dm text-xs font-semibold disabled:opacity-55"
              style={{ background:T.s2, borderColor:T.b2, color:T.t1 }}
            >
              <Sparkles size={14} style={{ color:"#22d3ee" }} aria-hidden="true" />
              {busy === "autofill" ? "Reading..." : "Autofill"}
            </button>
          </div>
        </label>
        <Field label="Target audience" name="targetAudience" value={values.targetAudience} onChange={setField("targetAudience")} />
        <Field label="Primary goal" name="primaryGoal" value={values.primaryGoal} onChange={setField("primaryGoal")} />
        <Field label="Budget range" name="budgetRange" value={values.budgetRange} onChange={setField("budgetRange")} />
        <Field label="Deadline" name="deadline" type="date" value={values.deadline} onChange={setField("deadline")} />
        <label className="font-dm text-sm">
          <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Priority</span>
          <select name="priority" value={values.priority} onChange={setField("priority")}>
            {FORGE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}
          </select>
        </label>
        <div className="lg:col-span-2">
          <TextArea label="Brand notes" name="brandNotes" value={values.brandNotes} onChange={setField("brandNotes")} rows={5} />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button disabled={busy === "save" || busy === "autofill"} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>
          <Save size={15} aria-hidden="true" /> {busy === "save" ? "Saving..." : mode === "create" ? "Create Project" : "Save Changes"}
        </button>
      </div>
    </form>
  )
}

function Field({ label, name, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; name: string }) {
  return (
    <label className="font-dm text-sm">
      <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>{label}</span>
      <input name={name} {...props} />
    </label>
  )
}

function TextArea({ label, name, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; name: string }) {
  return (
    <label className="font-dm text-sm">
      <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>{label}</span>
      <textarea name={name} {...props} />
    </label>
  )
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toISOString().slice(0, 10)
}

type ProjectFormState = {
  name: string
  businessName: string
  industry: string
  websiteUrl: string
  targetAudience: string
  primaryGoal: string
  budgetRange: string
  deadline: string
  brandNotes: string
  priority: ForgePriority
}

function initialValues(project: ForgeProjectFormValue | undefined): ProjectFormState {
  return {
    name: project?.name ?? "",
    businessName: project?.businessName ?? "",
    industry: project?.industry ?? "",
    websiteUrl: project?.websiteUrl ?? "",
    targetAudience: project?.targetAudience ?? "",
    primaryGoal: project?.primaryGoal ?? "",
    budgetRange: project?.budgetRange ?? "",
    deadline: dateValue(project?.deadline),
    brandNotes: project?.brandNotes ?? "",
    priority: project?.priority ?? "medium",
  }
}

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
