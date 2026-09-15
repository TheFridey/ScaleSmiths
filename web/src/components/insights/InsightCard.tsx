import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AuthorAvatar, formatInsightDate } from "./AuthorByline"
import { INSIGHT_CATEGORIES, insightAuthor, readingTimeMinutes, type Insight } from "@/lib/insights"

export function InsightCard({ insight, headingLevel: Heading = "h3" }: { insight: Insight; headingLevel?: "h2" | "h3" | "h4" }) {
  const author = insightAuthor(insight)
  return (
    <article className="group relative flex h-full flex-col rounded-2xl border border-b1 bg-s1 p-6 transition-colors hover:border-b2 focus-within:border-acc/50">
      <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">{INSIGHT_CATEGORIES[insight.category].label}</p>
      <Heading className="mt-3 font-syne text-xl font-bold leading-snug">
        <Link href={`/insights/${insight.slug}`} prefetch={false} className="after:absolute after:inset-0 focus-visible:outline-none">
          {insight.title}
        </Link>
      </Heading>
      <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{insight.description}</p>
      <div className="mt-auto flex items-center justify-between gap-4 pt-6">
        <span className="flex items-center gap-2.5 font-dm text-xs text-t3">
          <AuthorAvatar founder={author} size={28} />
          <span>
            {author.name}
            {insight.datePublished ? <> · <time dateTime={insight.datePublished}>{formatInsightDate(insight.datePublished)}</time></> : null}
            {" · "}{readingTimeMinutes(insight)} min
          </span>
        </span>
        <ArrowRight size={15} aria-hidden="true" className="shrink-0 text-t3 transition-transform group-hover:translate-x-0.5 group-hover:text-acc" />
      </div>
    </article>
  )
}
