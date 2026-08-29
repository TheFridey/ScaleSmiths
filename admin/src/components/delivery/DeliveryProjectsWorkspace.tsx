"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { FolderKanban, Plus } from "lucide-react"
import { DELIVERY_PROJECT_PHASES } from "@/lib/delivery-projects"

interface ProjectRow {
  id: number; name: string; clientName: string; status: string; currentPhase: string; progress: number
  ownerName: string | null; targetEndDate: Date | string | null; updatedAt: Date | string
}

export function DeliveryProjectsWorkspace({ projects, clients }: { projects: ProjectRow[]; clients: { id: number; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("")
    const form = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || "Unable to create project.")
      router.push(`/projects/${json.project.id}`); router.refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create project.") } finally { setBusy(false) }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="text-xs font-semibold uppercase tracking-[0.14em] text-acc">Delivery</div><h1 className="mt-2 font-syne text-3xl font-bold">Client projects</h1><p className="mt-2 text-sm text-t2">Milestone-led delivery across admin, the client portal and Forge.</p></div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-acc px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> New project</button>
    </header>

    {open ? <form onSubmit={create} className="grid gap-4 rounded-2xl border border-b1 bg-s1 p-5 md:grid-cols-2">
      <Field label="Client"><select name="clientId" required defaultValue=""><option value="" disabled>Select client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></Field>
      <Field label="Project name"><input name="name" required maxLength={180} /></Field>
      <Field label="Current phase"><select name="currentPhase" defaultValue="discovery">{DELIVERY_PROJECT_PHASES.map((phase) => <option key={phase} value={phase}>{label(phase)}</option>)}</select></Field>
      <Field label="Target end"><input name="targetEndDate" type="date" /></Field>
      <label className="md:col-span-2"><span className="mb-1 block text-xs text-t2">Client-visible summary</span><textarea name="summary" rows={3} maxLength={2000} /></label>
      <label className="flex items-center gap-2 text-xs text-t2 md:col-span-2"><input name="clientVisible" type="checkbox" value="true" /> Publish this project to the client portal</label>
      {error ? <p className="text-sm text-red-300 md:col-span-2">{error}</p> : null}
      <div className="flex gap-2 md:col-span-2"><button disabled={busy} className="rounded-lg bg-acc px-4 py-2 text-sm font-semibold text-white">{busy ? "Creating…" : "Create project"}</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-b2 px-4 py-2 text-sm">Cancel</button></div>
    </form> : null}

    {projects.length ? <div className="grid gap-4 lg:grid-cols-2">{projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="rounded-2xl border border-b1 bg-s1 p-5 transition-colors hover:border-acc/60">
      <div className="flex items-start justify-between gap-4"><div><div className="text-xs text-t3">{project.clientName}</div><h2 className="mt-1 font-syne text-xl font-bold">{project.name}</h2></div><span className="rounded border border-b2 bg-s2 px-2 py-1 text-xs text-t2">{label(project.status)}</span></div>
      <div className="mt-5 flex items-center justify-between text-xs text-t2"><span>{label(project.currentPhase)} phase</span><strong className="text-t1">{project.progress}%</strong></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-s3"><div className="h-full bg-acc" style={{ width: `${project.progress}%` }} /></div>
      <div className="mt-4 flex justify-between text-xs text-t3"><span>{project.ownerName ?? "Unassigned"}</span><span>{project.targetEndDate ? `Target ${date(project.targetEndDate)}` : "No target date"}</span></div>
    </Link>)}</div> : <div className="rounded-2xl border border-dashed border-b2 bg-s1 p-10 text-center"><FolderKanban className="mx-auto text-acc" /><h2 className="mt-4 font-syne text-xl font-bold">No delivery projects yet</h2><p className="mt-2 text-sm text-t2">Create the first client project and publish milestones when they are ready.</p></div>}
  </div>
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1 block text-xs text-t2">{text}</span>{children}</label> }
function label(value: string) { return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()) }
function date(value: Date | string) { return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) }
