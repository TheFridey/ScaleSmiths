import Link from "next/link"
import { ArrowRight } from "lucide-react"

export interface RelatedContentItem {
  href: string
  title: string
  description?: string
  eyebrow?: string
}

function RelatedContent({ title, items, ariaLabel }: { title: string; items: readonly RelatedContentItem[]; ariaLabel: string }) {
  if (!items.length) return null
  return (
    <section aria-label={ariaLabel} className="border-t border-b1 pt-8">
      <h2 className="font-syne text-2xl font-bold">{title}</h2>
      <ul className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href} prefetch={false} className="group flex h-full flex-col rounded-2xl border border-b1 bg-s1 p-5 transition-colors hover:border-b2">
              {item.eyebrow ? <span className="text-[11px] font-semibold uppercase tracking-[.12em] text-acc">{item.eyebrow}</span> : null}
              <span className="mt-2 font-syne text-lg font-bold">{item.title}</span>
              {item.description ? <span className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.description}</span> : null}
              <span className="mt-auto inline-flex items-center gap-2 pt-5 font-dm text-sm font-semibold text-acc">Read more <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export const RelatedInsights = ({ items }: { items: readonly RelatedContentItem[] }) => <RelatedContent title="Related insights" items={items} ariaLabel="Related insights" />
export const RelatedServices = ({ items }: { items: readonly RelatedContentItem[] }) => <RelatedContent title="Related services" items={items} ariaLabel="Related services" />
export const RelatedWork = ({ items }: { items: readonly RelatedContentItem[] }) => <RelatedContent title="Related work" items={items} ariaLabel="Related case studies" />
export const RelatedQuestions = ({ items }: { items: readonly RelatedContentItem[] }) => <RelatedContent title="Related questions" items={items} ariaLabel="Related frequently asked questions" />

export function NextRecommendedArticle({ item }: { item?: RelatedContentItem }) {
  if (!item) return null
  return <RelatedContent title="Read next" items={[item]} ariaLabel="Next recommended article" />
}
