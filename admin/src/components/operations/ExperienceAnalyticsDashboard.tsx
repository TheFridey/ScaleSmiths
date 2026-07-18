import type { summarizeExperienceAnalytics } from "@/lib/experience-analytics"

type Summary = ReturnType<typeof summarizeExperienceAnalytics>

export function ExperienceAnalyticsDashboard({ summary }: { summary: Summary }) {
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4">
      <header>
        <h1 className="font-syne text-3xl font-bold">Experience analytics</h1>
        <p className="mt-1 max-w-3xl text-sm text-t2">
          First-party aggregate journey events for the public ScaleSmiths normal-versus-interactive experience. No cookies, IP addresses, user agents or form payloads are stored.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Choice displayed" value={summary.choiceDisplayed} />
        <Metric label="Normal selected" value={`${summary.normalSelected}${formatRate(summary.normalSelectionRate)}`} />
        <Metric label="Interactive selected" value={`${summary.interactiveSelected}${formatRate(summary.interactiveSelectionRate)}`} />
        <Metric label="Choice abandoned" value={summary.choiceAbandoned} />
        <Metric label="Returning preference" value={summary.returningPreference} />
        <Metric label="Experience switched" value={summary.experienceSwitched} />
        <Metric label="Quote CTA clicked" value={summary.quoteCtaClicked} />
        <Metric label="Form submitted" value={`${summary.formSubmitted}${formatRate(summary.quoteSubmissionRate)}`} />
        <Metric label="Normal submissions" value={summary.normalFormSubmitted} />
        <Metric label="Interactive submissions" value={summary.interactiveFormSubmitted} />
        <Metric label="Avg. interactive depth" value={summary.averageInteractiveDepth === null ? "Missing" : `${summary.averageInteractiveDepth}%`} />
        <Metric label="Fallbacks / errors" value={summary.fallbackOrError} />
      </section>

      <section aria-labelledby="local-growth-funnel-heading" className="space-y-3">
        <h2 id="local-growth-funnel-heading" className="font-syne text-xl font-bold">Local growth check funnel</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Page viewed" value={summary.localGrowthViewed} />
          <Metric label="Form started" value={summary.localGrowthStarted} />
          <Metric label="Form submitted" value={summary.localGrowthSubmitted} />
          <Metric label="Moved to full quote" value={summary.localGrowthFullQuoteSelected} />
          <Metric label="Strategy call requested" value={summary.localGrowthStrategyCallRequested} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Device class" rows={summary.byDevice} />
        <Breakdown title="Campaign attribution" rows={summary.byCampaign} />
      </section>

      <Breakdown title="Daily event volume" rows={summary.byDay} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-b1 bg-s1 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-t3">{label}</p>
      <p className="mt-2 font-syne text-2xl font-bold">{value}</p>
    </div>
  )
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return (
    <section className="rounded border border-b1 bg-s1 p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-t3"><tr><th>Segment</th><th className="text-right">Events</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="py-3 text-t3" colSpan={2}>No events recorded yet.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.label} className="border-t border-b1">
                <td className="py-2">{row.label}</td>
                <td className="text-right">{row.count.toLocaleString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatRate(value: number | null) {
  return value === null ? "" : ` (${value}%)`
}
