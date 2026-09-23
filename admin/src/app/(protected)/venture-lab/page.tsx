import { EXPERIMENT_ZERO, EXPERIMENT_ZERO_ATTACKS, experimentZeroSummary } from "@/lib/venture-lab/experiment-zero"
import { formatGbpMinor } from "@/lib/venture-lab/money"

export default function VentureLabPage() {
  const summary = experimentZeroSummary()

  return (
    <main className="space-y-8 p-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">Nova Venture Lab</p>
        <h1 className="text-3xl font-semibold text-zinc-950">{EXPERIMENT_ZERO.name}</h1>
        <p className="max-w-3xl text-sm text-zinc-600">
          Simulated governance and financial-control proving ground. No real Venture Lab money is exposed during Experiment #000.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Simulated founding capital" value={formatGbpMinor(EXPERIMENT_ZERO.capital.foundingCapitalMinor)} />
        <Metric label="Protected reserve" value={formatGbpMinor(EXPERIMENT_ZERO.capital.protectedReserveMinor)} />
        <Metric label="Experiment allocation" value={formatGbpMinor(EXPERIMENT_ZERO.capital.experimentAllocationMinor)} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950">Governance test catalogue</h2>
            <p className="text-sm text-zinc-600">
              {summary.totalAttacks} mandatory attacks across {summary.categories.length} control categories.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
            {EXPERIMENT_ZERO.status}
          </span>
        </div>

        <div className="mt-5 overflow-hidden rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-4 py-3 font-medium">Attack</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Expected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {EXPERIMENT_ZERO_ATTACKS.map((attack) => (
                <tr key={attack.id}>
                  <td className="px-4 py-3 text-zinc-900">{attack.description}</td>
                  <td className="px-4 py-3 text-zinc-600">{attack.category}</td>
                  <td className="px-4 py-3 font-medium text-zinc-800">{attack.expected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-950">Real-money execution</h2>
        <p className="mt-1 text-sm text-red-900">
          Disabled. Grok direct spending authority remains £0. Experiment #001 cannot begin until every mandatory #000 exit gate passes.
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
