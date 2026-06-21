"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Archive, Save } from "lucide-react"
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
  const isArchived = project?.status === "archived"

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Field label="Project name" name="name" defaultValue={project?.name ?? ""} required />
        <Field label="Business name" name="businessName" defaultValue={project?.businessName ?? ""} required />
        <Field label="Industry" name="industry" defaultValue={project?.industry ?? ""} />
        <Field label="Current website URL" name="websiteUrl" type="url" placeholder="https://example.com" defaultValue={project?.websiteUrl ?? ""} />
        <Field label="Target audience" name="targetAudience" defaultValue={project?.targetAudience ?? ""} />
        <Field label="Primary goal" name="primaryGoal" defaultValue={project?.primaryGoal ?? ""} />
        <Field label="Budget range" name="budgetRange" defaultValue={project?.budgetRange ?? ""} />
        <Field label="Deadline" name="deadline" type="date" defaultValue={dateValue(project?.deadline)} />
        <label className="font-dm text-sm">
          <span className="mb-1 block text-[11px]" style={{ color:T.t2 }}>Priority</span>
          <select name="priority" defaultValue={project?.priority ?? "medium"}>
            {FORGE_PRIORITIES.map((priority) => <option key={priority} value={priority}>{labelize(priority)}</option>)}
          </select>
        </label>
        <div className="lg:col-span-2">
          <TextArea label="Brand notes" name="brandNotes" defaultValue={project?.brandNotes ?? ""} rows={5} />
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button disabled={busy === "save"} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-dm text-sm font-medium text-white disabled:opacity-60" style={{ background:T.acc }}>
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

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}
