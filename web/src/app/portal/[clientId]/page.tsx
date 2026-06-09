import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileText,
  LifeBuoy,
  Link as LinkIcon,
  MessageSquare,
  Rocket,
  ShieldCheck,
} from "lucide-react"
import { PortalNav } from "@/components/portal/PortalNav"
import { PortalMessageComposer } from "@/components/portal/PortalMessageComposer"

interface PortalPageProps {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}

const SAFE_PLACEHOLDER_CLIENT = {
  name: "Client Workspace",
  tier: "Project Portal",
  price: "Active",
  status: "Discovery / delivery setup",
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

const requests = [
  "Brand assets: logo files, colours, fonts, tone notes, photography, and existing guidelines.",
  "Access: domain/DNS provider, analytics, forms, booking tools, Stripe, or email marketing logins where needed.",
  "Content: final copy, pricing, service descriptions, FAQs, legal pages, and team details.",
  "Decisions: approvals, stakeholder feedback, feature priorities, and any launch blockers.",
]

const launchChecks = [
  "SEO titles and descriptions",
  "Contact forms and quote routing",
  "Responsive checks",
  "Performance pass",
  "Analytics and event tracking",
  "Backup and rollback plan",
]

export default async function PortalClientPage({ params, searchParams }: PortalPageProps) {
  const { clientId } = await params
  const resolvedSearchParams = await searchParams
  const tab = resolvedSearchParams.tab ?? "overview"

  return (
    <div className="flex min-h-screen flex-col bg-bg text-t1 md:flex-row">
      <PortalNav
        clientId={clientId}
        clientName={SAFE_PLACEHOLDER_CLIENT.name}
        tier={SAFE_PLACEHOLDER_CLIENT.tier}
        price={SAFE_PLACEHOLDER_CLIENT.price}
      />

      <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Portal</span>
            <h1 className="mt-2 font-syne text-[clamp(32px,5vw,48px)] font-extrabold tracking-[-0.03em]">Project workspace</h1>
            <p className="mt-2 max-w-[700px] font-dm text-sm leading-relaxed text-t2">
              Track progress, send direct project messages, review decisions, and keep useful launch information in one private place.
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
          <RequestsTab clientId={clientId} />
        ) : (
          <OverviewTab clientId={clientId} />
        )}
      </main>
    </div>
  )
}

function OverviewTab({ clientId }: { clientId: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-syne text-xl font-bold">Project status</h2>
            <p className="mt-1 font-dm text-sm text-t2">{SAFE_PLACEHOLDER_CLIENT.status}</p>
          </div>
          <ShieldCheck size={22} className="text-acc" aria-hidden="true" />
        </div>

        <ProgressMeter value={SAFE_PLACEHOLDER_CLIENT.progress} />

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[
            { label: "Current phase", value: SAFE_PLACEHOLDER_CLIENT.phase, Icon: ClipboardCheck },
            { label: "Next action", value: SAFE_PLACEHOLDER_CLIENT.nextAction, Icon: CalendarDays },
            { label: "Key dates", value: SAFE_PLACEHOLDER_CLIENT.keyDates, Icon: CalendarDays },
            { label: "Recent updates", value: "No updates have been published yet.", Icon: MessageSquare },
            { label: "Documents", value: "No shared documents yet.", Icon: FileText },
            { label: "Client ID", value: clientId, Icon: LinkIcon },
          ].map(({ label, value, Icon }) => (
            <InfoTile key={label} label={label} value={value} Icon={Icon} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-acc/20 bg-acc/10 p-6">
        <LifeBuoy size={18} className="mb-4 text-acc" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Need support?</h2>
        <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
          Use Messages for project decisions and Requests for assets, access, or changes. For urgent issues, email ScaleSmiths and reference your project name.
        </p>
        <a href={`mailto:${SAFE_PLACEHOLDER_CLIENT.supportEmail}`} className="btn-primary mt-6 inline-flex font-dm text-sm">
          Contact Support
        </a>
      </section>
    </div>
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

function RequestsTab({ clientId }: { clientId: string }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <h2 className="font-syne text-xl font-bold">What you can add here</h2>
        <p className="mt-2 font-dm text-sm leading-relaxed text-t2">
          Use this as the project intake checklist. Send anything that affects scope, content, launch readiness, or approvals.
        </p>
        <div className="mt-6 grid gap-3">
          {requests.map((request) => (
            <div key={request} className="flex gap-3 rounded-xl border border-b1 bg-s2 p-4">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />
              <p className="font-dm text-sm leading-relaxed text-t2">{request}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-b1 bg-s1 p-6">
        <AlertCircle size={18} className="mb-4 text-amb" aria-hidden="true" />
        <h2 className="font-syne text-xl font-bold">Launch readiness</h2>
        <div className="mt-5 grid gap-2">
          {launchChecks.map((check) => (
            <div key={check} className="flex items-center justify-between rounded-lg border border-b1 bg-s2 px-3 py-2.5">
              <span className="font-dm text-sm text-t2">{check}</span>
              <span className="font-dm text-[11px] text-t3">Pending</span>
            </div>
          ))}
        </div>
        <a
          href={`mailto:${SAFE_PLACEHOLDER_CLIENT.supportEmail}?subject=${encodeURIComponent(`Portal request for ${SAFE_PLACEHOLDER_CLIENT.name}`)}&body=${encodeURIComponent(`Client ID: ${clientId}\n\nHi ScaleSmiths,\n\nI would like to add:`)}`}
          className="btn-primary mt-6 inline-flex font-dm text-sm"
        >
          Add Request
        </a>
      </section>
    </div>
  )
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

function InfoTile({ label, value, Icon }: { label: string; value: string; Icon: typeof FileText }) {
  return (
    <div className="rounded-xl border border-b1 bg-s2 p-4">
      <Icon size={16} className="mb-3 text-acc" aria-hidden="true" />
      <div className="font-dm text-xs text-t2">{label}</div>
      <div className="mt-1 break-words font-dm text-sm leading-relaxed text-t1">{value}</div>
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
