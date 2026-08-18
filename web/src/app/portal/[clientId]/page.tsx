import {
  ClipboardList,
  Clock3,
  FileText,
  MessageSquare,
  Rocket,
  ShieldCheck,
} from "lucide-react"
import Link from "next/link"
import { and, desc, eq } from "drizzle-orm"
import { PortalNav } from "@/components/portal/PortalNav"
import { PortalMessageComposer } from "@/components/portal/PortalMessageComposer"
import { PortalOperatingHub } from "@/components/portal/PortalOperatingHub"
import { PortalRequestsPanel } from "@/components/portal/PortalRequestsPanel"
import { formatReportPeriod } from "@/lib/monthly-reports"
import { db } from "@/lib/db"
import { requireClientPortalAccess } from "@/lib/portal-session"
import { clientRequestMessages, clientRequests, monthlyReports } from "@/lib/schema"
import { listPortalInvoices } from "@/lib/portal-invoices"

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
  responseWindow: "See support agreement",
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
  const session = await requireClientPortalAccess(clientId)
  const resolvedSearchParams = await searchParams
  const tab = resolvedSearchParams.tab ?? "overview"
  const portalClientId = session.clientId
  const websiteName = deriveWebsiteName(portalClientId)
  const domain = deriveDomain(portalClientId)
  const planTier = SAFE_PLACEHOLDER_CLIENT.tier
  const [latestReport, recentMessages] = await Promise.all([
    loadLatestReport(portalClientId),
    loadRecentThreadMessages(portalClientId),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-bg text-t1 md:flex-row">
      <PortalNav
        clientId={portalClientId}
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
          <MessagesTab clientId={portalClientId} />
        ) : tab === "board" ? (
          <ProgressTab />
        ) : tab === "requests" ? (
          <RequestsTab clientId={portalClientId} />
        ) : tab === "reports" ? (
          <ReportsTab clientId={portalClientId} />
        ) : tab === "invoices" ? (
          <InvoicesTab clientId={portalClientId} />
        ) : (
          <OverviewTab
            clientId={portalClientId}
            websiteName={websiteName}
            domain={domain}
            planTier={planTier}
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
  return <section className="rounded-2xl border border-b1 bg-s1 p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-syne text-xl font-bold">Invoices</h2><p className="mt-1 font-dm text-sm text-t2">Published ScaleSmiths invoices and payment history.</p></div><div className="text-right"><div className="font-dm text-xs text-t3">Outstanding</div><strong>{gbp(outstanding)}</strong></div></div>{invoices.length?<div className="mt-6 overflow-x-auto"><table className="w-full text-left font-dm text-sm"><thead className="text-t3"><tr><th className="pb-3">Invoice</th><th>Date</th><th>Due</th><th>Status</th><th className="text-right">Total</th><th></th></tr></thead><tbody>{invoices.map(invoice=>{const overdue=invoice.status==="issued"&&new Date(invoice.dueDate)<new Date();return <tr key={invoice.invoiceNumber} className="border-t border-b1"><td className="py-3 font-semibold">{invoice.invoiceNumber}</td><td>{invoice.invoiceDate}</td><td>{invoice.dueDate}</td><td>{overdue?"OVERDUE":invoice.status.toUpperCase()}</td><td className="text-right">{gbp(invoice.total)}</td><td className="text-right"><Link className="text-acc" href={"/portal/"+clientId+"/invoices/"+encodeURIComponent(invoice.invoiceNumber)}>View</Link></td></tr>})}</tbody></table></div>:<div className="mt-6 rounded-xl border border-dashed border-b2 bg-s2 p-5 text-sm text-t2">No invoices have been published to your portal.</div>}</section>
}
function gbp(value:number){return new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(value/100)}

function OverviewTab({
  clientId,
  websiteName,
  domain,
  planTier,
  latestReport,
  recentMessages,
}: {
  clientId: string
  websiteName: string
  domain: string | null
  planTier: string | null
  latestReport: Awaited<ReturnType<typeof loadLatestReport>>
  recentMessages: Awaited<ReturnType<typeof loadRecentThreadMessages>>
}) {
  return (
    <PortalOperatingHub
      clientId={clientId}
      websiteName={websiteName}
      domain={domain}
      planTier={planTier}
      currentStatus={SAFE_PLACEHOLDER_CLIENT.status}
      supportEmail={SAFE_PLACEHOLDER_CLIENT.supportEmail}
      latestReport={latestReport}
      recentMessages={recentMessages}
    />
  )
}

async function loadLatestReport(clientId: string) {
  const [report] = await db
    .select({
      id: monthlyReports.id,
      month: monthlyReports.month,
      year: monthlyReports.year,
      title: monthlyReports.title,
      summary: monthlyReports.summary,
      publishedAt: monthlyReports.publishedAt,
    })
    .from(monthlyReports)
    .where(and(
      eq(monthlyReports.clientId, clientId),
      eq(monthlyReports.status, "published"),
    ))
    .orderBy(desc(monthlyReports.year), desc(monthlyReports.month), desc(monthlyReports.publishedAt))
    .limit(1)

  if (!report) return null

  return {
    id: report.id,
    title: report.title,
    summary: report.summary,
    periodLabel: formatReportPeriod(report.month, report.year),
    publishedAt: report.publishedAt?.toISOString() ?? null,
  }
}

async function loadRecentThreadMessages(clientId: string) {
  const rows = await db
    .select({
      id: clientRequestMessages.id,
      requestId: clientRequestMessages.requestId,
      requestTitle: clientRequests.title,
      senderType: clientRequestMessages.senderType,
      senderName: clientRequestMessages.senderName,
      body: clientRequestMessages.body,
      createdAt: clientRequestMessages.createdAt,
    })
    .from(clientRequestMessages)
    .innerJoin(clientRequests, eq(clientRequestMessages.requestId, clientRequests.id))
    .where(and(
      eq(clientRequests.clientId, clientId),
      eq(clientRequestMessages.visibility, "client_visible"),
    ))
    .orderBy(desc(clientRequestMessages.createdAt))
    .limit(6)

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }))
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
  return <PortalRequestsPanel clientId={clientId} />
}

async function ReportsTab({ clientId }: { clientId: string }) {
  const reports = await db
    .select({
      id: monthlyReports.id,
      month: monthlyReports.month,
      year: monthlyReports.year,
      title: monthlyReports.title,
      summary: monthlyReports.summary,
      publishedAt: monthlyReports.publishedAt,
    })
    .from(monthlyReports)
    .where(and(
      eq(monthlyReports.clientId, clientId),
      eq(monthlyReports.status, "published"),
    ))
    .orderBy(desc(monthlyReports.year), desc(monthlyReports.month), desc(monthlyReports.publishedAt))

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
