"use client"

import { useDeferredValue, useMemo, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { EmptyState, MetricSummary, PageSection, ResponsiveDataTable, SegmentedControl, StatusBadge, WorkspaceHeader, WorkspaceShell } from "@/components/admin-shell/primitives"
import { formatGbp, invoiceDisplayStatus, invoiceLabel, invoiceMatchesFilter, invoiceSummary, type InvoiceFilter } from "@/lib/invoice-ui"
import type { FinanceInvoice } from "./finance-types"

const FILTERS: Array<{ value: InvoiceFilter; label: string }> = [
  { value: "all", label: "All" }, { value: "draft", label: "Draft" }, { value: "outstanding", label: "Outstanding" },
  { value: "overdue", label: "Overdue" }, { value: "paid", label: "Paid" }, { value: "void", label: "Void" },
]

export function InvoiceDashboard({ invoices, canWrite }: { invoices: FinanceInvoice[]; canWrite: boolean }) {
  const [filter, setFilter] = useState<InvoiceFilter>("all")
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const summary = useMemo(() => invoiceSummary(invoices), [invoices])
  const visible = useMemo(() => invoices.filter((invoice) => invoiceMatchesFilter(invoice, filter) && (!deferredSearch || `${invoice.invoiceNumber ?? "draft"} ${invoice.clientNameSnapshot}`.toLowerCase().includes(deferredSearch))), [deferredSearch, filter, invoices])

  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Finance" title="Invoices" description="Create, issue and track ScaleSmiths invoices." actions={<div className="flex flex-wrap gap-2"><Link href="/finance/catalogue" className="rounded-lg border border-b2 px-3 py-2 text-sm">Catalogue</Link><Link href="/finance/invoice-settings" className="rounded-lg border border-b2 px-3 py-2 text-sm">Invoice settings</Link>{canWrite ? <Link href="/finance/invoices/new" className="inline-flex items-center gap-2 rounded-lg bg-acc px-4 py-2 text-sm font-semibold text-white"><Plus size={16} /> New Invoice</Link> : null}</div>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <MetricSummary label="Outstanding" value={formatGbp(summary.outstanding)} detail="Issued and unpaid" tone="accent" />
      <MetricSummary label="Overdue" value={formatGbp(summary.overdue)} detail="Derived from due date" tone={summary.overdue ? "critical" : "default"} />
      <MetricSummary label="Paid" value={formatGbp(summary.paid)} detail={`${summary.paidCount} paid invoice${summary.paidCount === 1 ? "" : "s"}`} tone="positive" />
      <MetricSummary label="Drafts" value={summary.draftCount} detail="Not yet numbered" tone="warning" />
    </div>
    <PageSection raised>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SegmentedControl value={filter} options={FILTERS} onChange={setFilter} label="Invoice status" />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice or client" aria-label="Search invoices" className="min-w-64 rounded-lg border border-b2 bg-s2 px-3 py-2 text-sm" />
      </div>
      {invoices.length === 0 ? <EmptyState title="No invoices yet" description="Create the first draft invoice when you are ready." action={canWrite ? <Link href="/finance/invoices/new" className="rounded-lg bg-acc px-4 py-2 text-sm font-semibold text-white">Create your first invoice</Link> : undefined} /> : visible.length === 0 ? <EmptyState title="No matching invoices" description="Adjust the search or status filter." /> : <ResponsiveDataTable label="Invoices">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-b1 text-xs uppercase tracking-wide text-t2"><tr>{["Invoice", "Client", "Invoice date", "Due date", "Status", "Amount", "Actions"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
          <tbody>{visible.map((invoice) => { const display = invoiceDisplayStatus(invoice); return <tr key={invoice.id} className="border-b border-b1/70 last:border-0">
            <td className="px-4 py-3 font-mono font-semibold">{invoiceLabel(invoice.invoiceNumber)}</td>
            <td className="px-4 py-3"><strong className="font-medium">{invoice.clientNameSnapshot}</strong></td>
            <td className="px-4 py-3 text-t2">{date(invoice.invoiceDate)}</td><td className="px-4 py-3 text-t2">{date(invoice.dueDate)}</td>
            <td className="px-4 py-3"><StatusBadge tone={tone(display)}>{display.toUpperCase()}</StatusBadge></td>
            <td className="px-4 py-3 font-semibold">{formatGbp(invoice.total)}</td>
            <td className="px-4 py-3"><Link href={`/finance/invoices/${invoice.id}`} className="text-acc hover:underline">{invoice.status === "draft" && canWrite ? "Edit" : "View"}</Link></td>
          </tr> })}</tbody>
        </table>
      </ResponsiveDataTable>}
    </PageSection>
  </WorkspaceShell>
}

function date(value: Date | string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value)) }
function tone(status: string): "neutral" | "info" | "success" | "warning" | "danger" { return status === "paid" ? "success" : status === "overdue" || status === "void" ? "danger" : status === "issued" ? "info" : status === "draft" ? "warning" : "neutral" }
