import { CheckCircle2 } from "lucide-react"
import { METRIC_DEFINITIONS, type MetricKey, type ResolvedMetric, type ResolvedQuote } from "@/lib/case-study-metrics"
import { isDevelopment } from "./ProjectScreenshot"

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" })

interface ResultsProps {
  metrics: ResolvedMetric[]
  outcomes: string[]
  awaiting: MetricKey[]
}

export function hasResults({ metrics, outcomes, awaiting }: ResultsProps) {
  return metrics.length > 0 || outcomes.length > 0 || (isDevelopment && awaiting.length > 0)
}

/**
 * Verified results only. Awaiting metrics appear as explicitly labelled placeholders in
 * development so the layout can be reviewed; production never shows a metric without a value.
 */
export function CaseStudyResults({ metrics, outcomes, awaiting }: ResultsProps) {
  const pending = isDevelopment ? awaiting.filter((key) => !metrics.some((metric) => metric.key === key)) : []

  return (
    <div className="grid gap-8">
      {metrics.length > 0 || pending.length > 0 ? (
        <dl className="grid gap-px overflow-hidden rounded-2xl border border-b1 bg-b1 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.key} className="bg-s1 p-6">
              <dt className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">{metric.label}</dt>
              <dd className="mt-3 font-syne text-[clamp(26px,3vw,36px)] font-extrabold leading-tight tracking-[-.02em]">{metric.value}</dd>
              <dd className="mt-2 font-dm text-xs text-t3">{metric.description} Verified {monthYear.format(metric.verifiedAt)}.</dd>
            </div>
          ))}
          {pending.map((key) => (
            <div key={key} className="bg-s1/60 p-6">
              <dt className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">{METRIC_DEFINITIONS[key].label}</dt>
              <dd className="mt-3 inline-flex rounded border border-dashed border-b2 px-2 py-1 font-dm text-xs text-t3">Awaiting measured results · dev only</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {outcomes.length > 0 ? (
        <ul className="grid gap-3">
          {outcomes.map((outcome) => (
            <li key={outcome} className="flex items-start gap-3 font-dm text-base text-t1">
              <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              {outcome}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Renders only a genuine, verified and attributed client quote. */
export function ClientQuote({ quote }: { quote?: ResolvedQuote }) {
  if (!quote) return null
  return (
    <figure className="mx-auto max-w-[860px] border-l-2 border-acc pl-6 md:pl-10">
      <blockquote className="font-syne text-[clamp(22px,3vw,34px)] font-bold leading-snug tracking-[-.02em] text-t1">
        <p>&ldquo;{quote.quote}&rdquo;</p>
      </blockquote>
      <figcaption className="mt-6 font-dm text-sm text-t2">
        <span className="font-semibold text-t1">{quote.name}</span> · {quote.business}
      </figcaption>
    </figure>
  )
}
