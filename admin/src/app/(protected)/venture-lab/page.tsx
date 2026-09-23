import { formatGbpMinor } from "@/lib/venture-lab/money"
import { loadVentureLabDashboard } from "@/lib/server/venture-lab-access"

export const dynamic = "force-dynamic"

export default async function VentureLabPage() {
  const snapshot = await loadVentureLabDashboard()
  const reserve = snapshot.envelopes.find((item) => item.kind === "protected_reserve")
  const allocation = snapshot.envelopes.find((item) => item.kind === "experiment")
  const founding = (reserve?.allocatedMinor ?? 0) + (allocation?.allocatedMinor ?? 0)
  const currentExperiment = snapshot.experiments[0]

  return (
    <main className="space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Nova Venture Lab</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-zinc-950">Nova Core</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${snapshot.runtime?.paused ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"}`}>
            {snapshot.runtime?.paused ? "STOP ACTIVE" : "RUNNING"}
          </span>
        </div>
        <p className="max-w-3xl text-sm text-zinc-600">
          PostgreSQL-backed Venture Lab state. Experiment #000 remains simulated; no real Venture Lab money or Grok connection is enabled.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Simulated founding capital" value={formatGbpMinor(founding)} />
        <Metric label="Protected reserve" value={formatGbpMinor(reserve?.allocatedMinor ?? 0)} />
        <Metric label="Experiment allocation" value={formatGbpMinor(allocation?.allocatedMinor ?? 0)} />
        <Metric label="Reserved / spent" value={`${formatGbpMinor(allocation?.reservedMinor ?? 0)} / ${formatGbpMinor(allocation?.spentMinor ?? 0)}`} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Current blocker">
          <p className="text-sm text-zinc-700">{snapshot.gate?.currentBlocker ?? "Gate state has not been initialised."}</p>
        </Panel>
        <Panel title="Next decision">
          <p className="text-sm text-zinc-700">{snapshot.gate?.nextDecision ?? "No next decision is recorded."}</p>
        </Panel>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Opportunities" value={String(snapshot.opportunities.length)} />
        <Metric label="Evidence records" value={String(snapshot.evidence.length)} />
        <Metric label="Pending proposals" value={String(snapshot.proposals.filter((item) => item.status === "PROPOSED").length)} />
        <Metric label="Approval requests" value={String(snapshot.approvals.length)} />
      </section>

      <Panel title="Portfolio / experiments">
        <DataTable
          headers={["Code", "Name", "Mode", "Status"]}
          rows={snapshot.experiments.map((item) => [item.code, item.name, item.mode, item.status])}
          empty="No Venture Lab experiments are persisted yet."
        />
      </Panel>

      <Panel title="Opportunities">
        <DataTable
          headers={["Title", "Status", "Created"]}
          rows={snapshot.opportunities.map((item) => [item.title, item.status, item.createdAt.toISOString()])}
          empty="No opportunities proposed."
        />
      </Panel>

      <Panel title="Evidence">
        <DataTable
          headers={["Type", "Claim", "Status", "Created"]}
          rows={snapshot.evidence.map((item) => [item.evidenceType, item.claim, item.status, item.createdAt.toISOString()])}
          empty="No evidence persisted."
        />
      </Panel>

      <Panel title="Approvals">
        <DataTable
          headers={["Action", "Amount", "Status", "Service"]}
          rows={snapshot.approvals.map((item) => [item.action, formatGbpMinor(item.amountMinor), item.status, item.requestedByService])}
          empty="No approval requests."
        />
      </Panel>

      <Panel title="Ledger">
        <DataTable
          headers={["Description", "Actor", "Sealed", "Created"]}
          rows={snapshot.journals.map((item) => [item.description, `${item.actorType}:${item.actorKey}`, item.sealed ? "yes" : "no", item.createdAt.toISOString()])}
          empty="No ledger journals."
        />
      </Panel>

      <Panel title="Audit history">
        <DataTable
          headers={["Action", "Actor", "Reason", "Created"]}
          rows={snapshot.audit.map((item) => [item.action, `${item.actorType}:${item.actorKey}`, item.reason ?? "—", item.createdAt.toISOString()])}
          empty="No audit events."
        />
      </Panel>

      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-950">External execution boundary</h2>
        <p className="mt-1 text-sm text-red-900">
          Grok is not connected. Payment credentials, real £100 capital, production deployment and autonomous spending remain unavailable.
          {currentExperiment ? ` Current persisted experiment: ${currentExperiment.code} (${currentExperiment.mode}).` : ""}
        </p>
      </section>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
    </article>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-semibold text-zinc-950">{title}</h2>
      {children}
    </section>
  )
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-zinc-500">{empty}</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-zinc-500">
          <tr>{headers.map((header) => <th key={header} className="px-2 py-2 font-medium">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-2 text-zinc-800">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
