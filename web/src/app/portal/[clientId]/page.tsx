import {
  ClipboardList,
  Clock3,
  FileText,
  MessageSquare,
  Rocket,
  ShieldCheck,
} from "lucide-react"
import { PortalNav } from "@/components/portal/PortalNav"
import { PortalMessageComposer } from "@/components/portal/PortalMessageComposer"
import { PortalOperatingHub } from "@/components/portal/PortalOperatingHub"
import { PortalRequestsPanel } from "@/components/portal/PortalRequestsPanel"

interface PortalPageProps {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}

const SAFE_PLACEHOLDER_CLIENT = {
  name: "Client Workspace",
  tier: null,
  price: "Active",
  status: "Portal active - website profile pending",
  phase: "Workspace setup",
  progress: 18,
  nextAction: "ScaleSmiths will publish your next milestone after onboarding.",
  keyDates: "Key dates will appear after the project schedule is agreed.",
  responseWindow: "One working day",
  supportEmail: "hello@scalesmiths.co.uk",
}

const milestones = [
  { title: "Workspace opened", status: "Complete", body: "Your private portal is ready for project communication.", Icon: ShieldCheck },
  { title: "Discovery and scope", status: "Current", body: "We confirm goals, content, assets, pages, integrations, and success criteria.", Icon: ClipboardList },
  { title: "Design direction", status: "Next", body: "Homepage direction, core UI patterns, and key content sections are prepared for review.", Icon: FileText },
  { title: "Build and review", status: "Pending", body: "Development, staging preview, feedback loops, and refinement.", Icon: Clock3 },
  { title: "Launch and handoff", status: "Pending", body: "Final checks, DNS/deployment, analytics, documentation, and aftercare plan.", Icon: Rocket },
]

export default async function PortalClientPage({ params, searchParams }: PortalPageProps) {
  const { clientId } = await params
  const resolvedSearchParams = await searchParams
  const tab = resolvedSearchParams.tab ?? "overview"
  const websiteName = deriveWebsiteName(clientId)
  const domain = deriveDomain(clientId)
  const planTier = SAFE_PLACEHOLDER_CLIENT.tier

  return (
    <div className="flex min-h-screen flex-col bg-bg text-t1 md:flex-row">
      <PortalNav
        clientId={clientId}
        clientName={websiteName}
        tier={planTier ?? "Plan pending"}
        price={SAFE_PLACEHOLDER_CLIENT.price}
      />

      <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Portal</span>
            <h1 className="mt-2 font-syne text-[clamp(32px,5vw,48px)] font-extrabold tracking-[-0.03em]">Operating hub</h1>
            <p className="mt-2 max-w-[700px] font-dm text-sm leading-relaxed text-t2">
              Track requests, support routes, website status, useful assets, and next-step guidance in one private ScaleSmiths workspace.
            </p>
          </div>
          <div className="rounded-xl border border-b1 bg-s1 px-4 py-3 lg:text-right">
            <div className="font-dm text-xs text-t2">Response window</div>
            <div className="mt-1 font-syne text-sm font-bold">{SAFE_PLACEHOLDER_CLIENT.responseWindow}</div>
          </div>
        </div>

        {tab === "files" ? (
          <DocumentsTab />
        ) : tab === "messages" ? (
          <MessagesTab clientId={clientId} />
        ) : tab === "board" ? (
          <ProgressTab />
        ) : tab === "requests" ? (
          <RequestsTab />
        ) : (
          <OverviewTab clientId={clientId} websiteName={websiteName} domain={domain} planTier={planTier} />
        )}
      </main>
    </div>
  )
}

function OverviewTab({
  clientId,
  websiteName,
  domain,
  planTier,
}: {
  clientId: string
  websiteName: string
  domain: string | null
  planTier: string | null
}) {
  return (
    <PortalOperatingHub
      clientId={clientId}
      websiteName={websiteName}
      domain={domain}
      planTier={planTier}
      currentStatus={SAFE_PLACEHOLDER_CLIENT.status}
      supportEmail={SAFE_PLACEHOLDER_CLIENT.supportEmail}
    />
  )
}

function ProgressTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <h2 className="font-syne text-xl font-bold">Build progress</h2>
        <p className="mt-2 font-dm text-sm leading-relaxed text-t2">
          This timeline shows where the project sits and what will happen next once live project milestones are published.
        </p>
        <div className="mt-6">
          <ProgressMeter value={SAFE_PLACEHOLDER_CLIENT.progress} />
        </div>
      </section>

      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <h2 className="font-syne text-xl font-bold">Milestones</h2>
        <div className="mt-6 space-y-4">
          {milestones.map(({ title, status, body, Icon }) => (
            <div key={title} className="flex gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-b2 bg-s2">
                <Icon size={17} className={status === "Complete" ? "text-grn" : status === "Current" ? "text-acc" : "text-t2"} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 border-b border-b1 pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-syne text-base font-bold">{title}</h3>
                  <span className="rounded border border-b2 bg-s2 px-2 py-0.5 font-dm text-[11px] text-t2">{status}</span>
                </div>
                <p className="mt-1 font-dm text-sm leading-relaxed text-t2">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function DocumentsTab() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <EmptyState
        Icon={FileText}
        title="Documents and assets"
        body="Shared documents, brand assets, handoff notes, staging links, and launch materials will appear here once they are ready for client review."
      />
      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <h2 className="font-syne text-xl font-bold">Useful links</h2>
        <div className="mt-5 grid gap-3">
          {["Staging preview", "Brand asset folder", "Launch checklist", "Handoff notes"].map((item) => (
            <div key={item} className="flex items-center justify-between rounded-xl border border-b1 bg-s2 p-4">
              <div className="font-dm text-sm text-t1">{item}</div>
              <span className="font-dm text-xs text-t3">Pending</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function MessagesTab({ clientId }: { clientId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
      <PortalMessageComposer clientName={SAFE_PLACEHOLDER_CLIENT.name} clientId={clientId} />
      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <MessageSquare size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Message history</h2>
        <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
          Structured project messages will appear here once the workspace is connected to live project updates. For now, the message composer opens a pre-filled email so nothing gets lost.
        </p>
        <div className="mt-6 rounded-xl border border-b1 bg-s2 p-4">
          <div className="font-dm text-xs text-t3">No published messages yet</div>
          <div className="mt-1 font-dm text-sm text-t2">Send questions, approvals, or change notes whenever you need.</div>
        </div>
      </section>
    </div>
  )
}

function RequestsTab() {
  return <PortalRequestsPanel />
}

function ProgressMeter({ value }: { value: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="font-dm text-xs uppercase tracking-[0.12em] text-t3">Overall progress</div>
        <div className="font-syne text-sm font-bold text-t1">{value}%</div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-s3">
        <div className="h-full rounded-full bg-acc" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function EmptyState({ title, body, Icon }: { title: string; body: string; Icon: typeof FileText }) {
  return (
    <section className="rounded-2xl border border-b1 bg-s1 p-8">
      <div className="flex max-w-[560px] flex-col items-start">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-b1 bg-s2">
          <Icon size={18} className="text-acc" aria-hidden="true" />
        </div>
        <h2 className="font-syne text-2xl font-bold">{title}</h2>
        <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{body}</p>
      </div>
    </section>
  )
}

function deriveWebsiteName(clientId: string) {
  const cleaned = clientId
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/.#?]/)[0]
    .replace(/[-_]+/g, " ")
    .trim()

  if (!cleaned) return SAFE_PLACEHOLDER_CLIENT.name
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function deriveDomain(clientId: string) {
  const cleaned = clientId.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim()
  return cleaned.includes(".") ? cleaned : null
}
