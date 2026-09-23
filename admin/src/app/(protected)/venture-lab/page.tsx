import type { ReactNode } from "react"
import { VentureLabControls } from "@/components/VentureLabControls"
import { formatGbpMinor } from "@/lib/venture-lab/money"
import { getVentureLabDashboardSnapshot } from "@/lib/server/venture-lab-dashboard"
import { requireCurrentAdminUser } from "@/lib/server/admin-session"
import { hasCapability } from "@/lib/rbac"

export const dynamic = "force-dynamic"

export default async function VentureLabPage() {
  const [snapshot, actor] = await Promise.all([getVentureLabDashboardSnapshot(), requireCurrentAdminUser()])

  if (!snapshot) {
    return (
      <main className="p-6">
        <h1 className="text-3xl font-semibold text-zinc-950">Nova Venture Lab</h1>
        <p className="mt-3 text-sm text-red-700">Experiment #000 has not been initialized in PostgreSQL.</p>
      </main>
    )
  }

  const { experiment, runtime, treasury, opportunities, evidence, proposals, approvals, ledger, audit, control, services } = snapshot

  return (
    <main className="space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Nova Venture Lab · persisted state</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-950">{experiment.name}</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600">PostgreSQL is the source of truth. Chat history, model memory and external content are not authority.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${runtime.paused ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"}`}>
            {runtime.paused ? "EMERGENCY STOP" : `${experiment.mode} · ${experiment.status}`}
          </span>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Simulated founding capital" value={formatGbpMinor(treasury.foundingCapitalMinor)} />
        <Metric label="Protected reserve" value={formatGbpMinor(treasury.protectedReserve?.allocatedMinor ?? 0)} detail="Not spendable" />
        <Metric
          label="Experiment allocation"
          value={formatGbpMinor(treasury.experimentBudget?.allocatedMinor ?? 0)}
          detail={`${formatGbpMinor(treasury.experimentBudget?.reservedMinor ?? 0)} reserved · ${formatGbpMinor(treasury.experimentBudget?.spentMinor ?? 0)} spent`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Current blocker">
          <p className="text-sm leading-relaxed text-zinc-700">{control.currentBlocker}</p>
        </Panel>
        <Panel title="Next human decision">
          <p className="text-sm leading-relaxed text-zinc-700">{control.nextDecision}</p>
        </Panel>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Opportunities" value={String(opportunities.length)} />
        <Metric label="Evidence records" value={String(evidence.length)} />
        <Metric label="Pending proposals" value={String(proposals.filter((item) => item.status === "PENDING").length)} />
        <Metric label="Approval requests" value={String(approvals.length)} />
      </section>

      <VentureLabControls
        paused={runtime.paused}
        approvals={approvals.map((item) => ({
          id: item.id,
          action: item.action,
          amountMinor: item.amountMinor,
          target: item.target,
          purpose: item.purpose,
          status: item.status,
        }))}
        services={services.map((item) => ({
          id: item.id,
          displayName: item.displayName,
          active: item.active,
          revokedAt: item.revokedAt?.toISOString() ?? null,
        }))}
        canApprove={hasCapability(actor.role, "venture.finance.approve")}
        canStop={hasCapability(actor.role, "venture.emergency_stop")}
        canRevoke={hasCapability(actor.role, "venture.integration.manage")}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Portfolio / opportunities">
          <Table
            headers={["Opportunity", "State", "Created"]}
            rows={opportunities.map((item) => [item.title, item.status, formatDate(item.createdAt)])}
            empty="No opportunities have been persisted yet."
          />
        </Panel>
        <Panel title="Evidence">
          <Table
            headers={["Claim", "Type", "Observed"]}
            rows={evidence.map((item) => [item.claim, item.evidenceType, formatDate(item.observedAt)])}
            empty="No evidence has been persisted yet."
          />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Approvals">
          <Table
            headers={["Action", "Amount", "Status"]}
            rows={approvals.map((item) => [item.action, formatGbpMinor(item.amountMinor), item.status])}
            empty="No approval requests."
          />
        </Panel>
        <Panel title="Ledger">
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Metric label="Debits" value={formatGbpMinor(ledger.debitMinor)} compact />
            <Metric label="Credits" value={formatGbpMinor(ledger.creditMinor)} compact />
          </div>
          <Table
            headers={["Journal", "State", "Created"]}
            rows={ledger.journals.map((item) => [item.description, item.sealed ? "SEALED" : "OPEN", formatDate(item.createdAt)])}
            empty="No ledger journals."
          />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Service identities">
          <Table
            headers={["Service", "Status", "Token version"]}
            rows={services.map((item) => [item.displayName, item.active && !item.revokedAt ? "ACTIVE" : "REVOKED", String(item.tokenVersion)])}
            empty="No Venture Lab service identities."
          />
        </Panel>
        <Panel title="Audit history">
          <Table
            headers={["Actor", "Action", "Created"]}
            rows={audit.slice(0, 20).map((item) => [`${item.actorType}:${item.actorKey}`, item.action, formatDate(item.createdAt)])}
            empty="No audit history."
          />
        </Panel>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-950">External execution boundary</h2>
        <p className="mt-1 text-sm text-red-900">
          Grok is not connected. Payment credentials, real £100 capital and autonomous spending remain disabled. The restricted MCP surface may be built and tested, but connection requires the next Nova + Trev gate.
        </p>
      </section>
    </main>
  )
}

function Metric({ label, value, detail, compact = false }: { label: string; value: string; detail?: string; compact?: boolean }) {
  return (
    <article className={`rounded-xl border border-zinc-200 bg-white ${compact ? "p-3" : "p-5"}`}>
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-2 font-semibold text-zinc-950 ${compact ? "text-lg" : "text-2xl"}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}
    </article>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-zinc-200 bg-white p-5"><h2 className="mb-4 text-lg font-semibold text-zinc-950">{title}</h2>{children}</section>
}

function Table({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-zinc-500">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-zinc-500"><tr>{headers.map((header) => <th key={header} className="px-2 py-2 font-medium">{header}</th>)}</tr></thead>
        <tbody className="divide-y divide-zinc-100">{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-2 text-zinc-700">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
}
