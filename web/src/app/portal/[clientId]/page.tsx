import {
  FileText,
  MessageSquare,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"
import { PortalNav } from "@/components/portal/PortalNav"
import { PortalMessageComposer } from "@/components/portal/PortalMessageComposer"
import { PortalOperatingHub } from "@/components/portal/PortalOperatingHub"
import { PortalRequestsPanel } from "@/components/portal/PortalRequestsPanel"
import { formatReportPeriod } from "@/lib/monthly-reports"
import { requireClientPortalAccess } from "@/lib/portal-session"
import { listRecentPortalThreadMessages } from "@/lib/portal-client-requests"
import { listPortalInvoices } from "@/lib/portal-invoices"
import { INVOICE_STATUS_LABELS } from "@/lib/invoice-status"
import { loadPortalClientProfile } from "@/lib/portal-client-profile"
import { listPortalProjectProgress } from "@/lib/portal-projects"
import { getLatestPublishedPortalReport, listPublishedPortalReports } from "@/lib/portal-reports"

interface PortalPageProps {
  params: Promise<{ clientId: string }>
  searchParams: Promise<{ tab?: string }>
}

const SAFE_PLACEHOLDER_CLIENT = {
  supportEmail: "hello@scalesmiths.co.uk",
}

export default async function PortalClientPage({ params, searchParams }: PortalPageProps) {
  const { clientId } = await params
  const session = await requireClientPortalAccess(clientId)
  const resolvedSearchParams = await searchParams
  const tab = resolvedSearchParams.tab ?? "overview"
  const portalClientId = session.clientId
  const [profile, latestReport, recentMessages] = await Promise.all([
    loadPortalClientProfile(portalClientId),
    getLatestPublishedPortalReport(portalClientId),
    listRecentPortalThreadMessages(portalClientId),
  ])

  if (!profile) {
    throw new Error("The portal account is not linked to an active client workspace.")
  }

  const planTier = profile.tier

  return (
    <div className="flex min-h-screen flex-col bg-bg text-t1 md:flex-row">
      <PortalNav
        clientId={portalClientId}
        clientName={profile.portalName}
      />

      <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
        <div className="mb-8">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">{profile.portalName}</span>
            <h1 className="mt-2 font-syne text-[clamp(32px,5vw,48px)] font-extrabold tracking-[-0.03em]">
              Welcome back{profile.contactFirstName ? `, ${profile.contactFirstName}` : ""}!
            </h1>
            <p className="mt-2 max-w-[700px] font-dm text-sm leading-relaxed text-t2">
              Here is what needs your attention and the latest activity from ScaleSmiths.
            </p>
          </div>
        </div>

        {tab === "files" ? (
          <DocumentsTab clientId={portalClientId} />
        ) : tab === "messages" ? (
          <MessagesTab clientId={portalClientId} clientName={profile.companyName} />
        ) : tab === "board" ? (
          <ProgressTab clientId={portalClientId} />
        ) : tab === "requests" ? (
          <RequestsTab clientId={portalClientId} />
        ) : tab === "reports" ? (
          <ReportsTab clientId={portalClientId} />
        ) : tab === "invoices" ? (
          <InvoicesTab clientId={portalClientId} />
        ) : (
          <OverviewTab
            clientId={portalClientId}
            websiteName={profile.companyName}
            planTier={planTier}
            clientStatus={profile.status}
            latestReport={latestReport}
            recentMessages={recentMessages}
          />
        )}
      </main>
    </div>
  )
}

async function InvoicesTab({clientId}:{clientId:string}) {
  const invoices=await listPortalInvoices(clientId)
  const outstanding=invoices.filter(invoice=>invoice.status==="issued").reduce((sum,invoice)=>sum+invoice.total,0)
  return <section className="rounded-2xl border border-b1 bg-s1 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-syne text-xl font-bold">Invoices</h2><p className="mt-1 font-dm text-sm text-t2">Published ScaleSmiths invoices and payment history.</p></div><div className="text-right"><div className="font-dm text-xs text-t3">Outstanding</div><strong>{gbp(outstanding)}</strong></div></div>{invoices.length?<div className="mt-6 overflow-x-auto"><table className="w-full text-left font-dm text-sm"><thead className="text-t3"><tr><th className="pb-3">Invoice</th><th>Date</th><th>Due</th><th>Status</th><th className="text-right">Total</th><th></th></tr></thead><tbody>{invoices.map(invoice=>{const overdue=invoice.status==="issued"&&new Date(invoice.dueDate)<new Date();return <tr key={invoice.invoiceNumber} className="border-t border-b1"><td className="py-3 font-semibold">{invoice.invoiceNumber}</td><td>{invoice.invoiceDate}</td><td>{invoice.dueDate}</td><td>{overdue?"Overdue":INVOICE_STATUS_LABELS[invoice.status]}</td><td className="text-right">{gbp(invoice.total)}</td><td className="text-right"><Link className="text-acc" href={"/portal/"+clientId+"/invoices/"+encodeURIComponent(invoice.invoiceNumber)}>View</Link></td></tr>})}</tbody></table></div>:<div className="mt-6 rounded-xl border border-dashed border-b2 bg-s2 p-5 text-sm text-t2">No invoices have been published to your portal.</div>}</section>
}
function gbp(value:number){return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(value/100)}

function OverviewTab({
  clientId,
  websiteName,
  planTier,
  clientStatus,
  latestReport,
  recentMessages,
}: {
  clientId: string
  websiteName: string
  planTier: string | null
  clientStatus: string
  latestReport: Awaited<ReturnType<typeof getLatestPublishedPortalReport>>
  recentMessages: Awaited<ReturnType<typeof listRecentPortalThreadMessages>>
}) {
  return (
    <PortalOperatingHub
      clientId={clientId}
      websiteName={websiteName}
      planTier={planTier}
      currentStatus={clientStatus === "active" ? "Active workspace" : clientStatus}
      supportEmail={SAFE_PLACEHOLDER_CLIENT.supportEmail}
      latestReport={latestReport}
      recentMessages={recentMessages}
    />
  )
}

async function ProgressTab({ clientId }: { clientId: string }) {
  const projects = await listPortalProjectProgress(clientId)
  if (!projects.length) return <EmptyState Icon={FileText} title="No project published yet" body="Your delivery plan will appear here once ScaleSmiths publishes the first client-visible milestone." />
  return (
    <div className="space-y-5">{projects.map((project) => <section key={project.id} className="rounded-2xl border border-b1 bg-s1 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="font-dm text-xs font-semibold uppercase tracking-[0.12em] text-acc">{project.currentPhase.replaceAll("_", " ")} phase</div><h2 className="mt-2 font-syne text-2xl font-bold">{project.name}</h2><p className="mt-2 max-w-3xl font-dm text-sm leading-relaxed text-t2">{project.summary || "Delivery milestones and progress for this project."}</p></div><span className="rounded border border-b2 bg-s2 px-2 py-1 font-dm text-xs text-t2">{project.status}</span></div>
      <div className="mt-6"><ProgressMeter value={project.progress} /></div>
      <div className="mt-7 space-y-4">{project.milestones.map((milestone) => <div key={milestone.id} className="flex gap-4"><div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${milestone.status === "completed" ? "bg-grn" : milestone.status === "active" ? "bg-acc" : milestone.status === "blocked" ? "bg-red-400" : "bg-s3"}`} /><div className="min-w-0 flex-1 border-b border-b1 pb-4"><div className="flex flex-wrap items-center gap-2"><h3 className="font-syne text-base font-bold">{milestone.title}</h3><span className="rounded border border-b2 bg-s2 px-2 py-0.5 font-dm text-[11px] text-t2">{milestone.status.replaceAll("_", " ")}</span></div>{milestone.description ? <p className="mt-1 font-dm text-sm text-t2">{milestone.description}</p> : null}{milestone.targetDate ? <div className="mt-2 font-dm text-xs text-t3">Target {formatPortalDate(milestone.targetDate)}</div> : null}</div></div>)}</div>
      {project.decisions.some((decision) => decision.status === "open") ? <div className="mt-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4"><h3 className="font-syne text-base font-bold">Decisions required</h3>{project.decisions.filter((decision) => decision.status === "open").map((decision) => <div key={decision.id} className="mt-3"><strong className="font-dm text-sm">{decision.title}</strong>{decision.description ? <p className="mt-1 font-dm text-sm text-t2">{decision.description}</p> : null}</div>)}</div> : null}
    </section>)}</div>
  )
}

async function DocumentsTab({ clientId }: { clientId: string }) {
  const projects = await listPortalProjectProgress(clientId)
  const resources = projects.flatMap((project) => project.resources.map((resource) => ({ ...resource, projectName: project.name })))
  return (
    <section className="rounded-2xl border border-b1 bg-s1 p-6"><FileText size={18} className="mb-4 text-acc" aria-hidden="true" /><h2 className="font-syne text-xl font-bold">Documents and links</h2><p className="mt-1 font-dm text-sm text-t2">Files, previews and handoff resources published by ScaleSmiths.</p>{resources.length ? <div className="mt-6 grid gap-3 lg:grid-cols-2">{resources.map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-xl border border-b1 bg-s2 p-4 hover:border-acc/60"><div><div className="font-dm text-xs text-t3">{resource.projectName}</div><div className="mt-1 font-dm text-sm font-semibold text-t1">{resource.title}</div></div><ExternalLink size={15} className="text-acc" /></a>)}</div> : <div className="mt-6 rounded-xl border border-dashed border-b2 bg-s2 p-5 font-dm text-sm text-t2">No project files or links have been published yet.</div>}</section>
  )
}

function MessagesTab({ clientId, clientName }: { clientId: string; clientName: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
      <PortalMessageComposer clientName={clientName} clientId={clientId} />
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
  return <PortalRequestsPanel clientId={clientId} />
}

async function ReportsTab({ clientId }: { clientId: string }) {
  const reports = await listPublishedPortalReports(clientId)

  return (
    <section className="rounded-2xl border border-b1 bg-s1 p-6">
      <FileText size={18} className="mb-4 text-acc" aria-hidden="true" />
      <h2 className="font-syne text-xl font-bold">Monthly reports</h2>
      <p className="mt-1 font-dm text-sm text-t2">Published ScaleSmiths reports for your website and support activity.</p>
      {reports.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-b2 bg-s2 p-5">
          <div className="font-dm text-sm font-semibold text-t1">No reports published yet</div>
          <p className="mt-1 font-dm text-sm leading-relaxed text-t2">Reports will appear here once ScaleSmiths publishes them to your portal.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          {reports.map((report) => (
            <article key={report.id} className="rounded-xl border border-b1 bg-s2 p-4">
              <div className="font-dm text-xs text-t3">{formatReportPeriod(report.month, report.year)}</div>
              <h3 className="mt-1 font-syne text-lg font-bold">{report.title}</h3>
              <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{report.summary}</p>
              <Link href={`/portal/${clientId}/reports/${report.id}`} className="mt-3 inline-flex font-dm text-xs font-semibold text-acc underline-offset-2 hover:underline">
                Open report
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
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

function formatPortalDate(value: Date | string) { return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) }
