import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { FaqKnowledgeBase, type FaqCategoryView, type FaqLink } from "@/components/faq/FaqKnowledgeBase"
import { faqCategories, faqsForCategory } from "@/lib/faq-knowledge-base"
import { getInsight } from "@/lib/insights"
import { buildPageMetadata } from "@/lib/page-metadata"
import { serviceRouteCatalogue } from "@/lib/service-routes"
import { siteBaseUrl } from "@/lib/site-identity"
import { buildBreadcrumbSchema, buildWebPageSchema } from "@/lib/structured-data"

const description =
  "Straight answers on websites, SEO, ongoing support, custom development, hosting, business email and how ScaleSmiths works commercially."
const intro =
  "A searchable knowledge base of straight answers about websites, SEO, ongoing support, custom development, hosting, business email and how ScaleSmiths works commercially."

export const metadata = buildPageMetadata({
  title: "FAQ Knowledge Base",
  absoluteTitle: "FAQ: Websites, SEO, Support & Custom Systems | ScaleSmiths",
  description,
  path: "/faq",
})

/**
 * Resolves the hub's onward links from the same catalogues the rest of the site uses, so a
 * renamed service route or unpublished article cannot leave a dead link behind on /faq.
 */
function serviceLinks(hrefs: readonly string[], { withDescription = false } = {}): FaqLink[] {
  const catalogue = serviceRouteCatalogue()
  return hrefs.flatMap((href) => {
    const route = catalogue.get(href)
    if (!route) return []
    return [{ href, label: route.label, ...(withDescription ? { description: route.description } : {}) }]
  })
}

function insightLinks(slugs: readonly string[]): FaqLink[] {
  return slugs.flatMap((slug) => {
    const insight = getInsight(slug, { includeDrafts: false })
    return insight ? [{ href: `/insights/${slug}`, label: insight.title }] : []
  })
}

function categoryViews(): FaqCategoryView[] {
  return faqCategories.map((category) => ({
    slug: category.slug,
    label: category.label,
    description: category.description,
    faqs: faqsForCategory(category).map((faq) => ({
      id: faq.id,
      anchor: faq.anchor,
      q: faq.q,
      a: faq.a,
      services: serviceLinks(faq.services ?? []),
      insights: insightLinks(faq.insights ?? []),
    })),
    services: serviceLinks(category.services, { withDescription: true }),
    insights: insightLinks(category.insights),
    cta: category.cta,
  }))
}

export default function FaqPage() {
  const base = siteBaseUrl()
  const categories = categoryViews()
  const total = categories.reduce((count, category) => count + category.faqs.length, 0)

  // No FAQPage schema here: a hub this size is not the short, page-specific question set FAQ
  // structured data exists for. Scoped contextual FAQ blocks on service pages keep theirs.
  const schema = [
    buildWebPageSchema(base, { name: "ScaleSmiths FAQ knowledge base", description, path: "/faq", type: "CollectionPage" }),
    buildBreadcrumbSchema(base, [{ name: "Home", path: "/" }, { name: "FAQ", path: "/faq" }]),
  ]

  return (
    <>
      <JsonLd data={schema} />
      <main>
        <header className="px-6 pb-14 pt-10 md:px-12 md:pt-14">
          <div className="mx-auto max-w-[1240px]">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "FAQ" }]} />
            <div className="mt-10 max-w-[840px]">
              <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Knowledge base · {total} answers</p>
              <h1 className="mt-3 font-syne text-[clamp(38px,6.5vw,72px)] font-black leading-[1.02] tracking-[-.04em]">Clear answers before you commit.</h1>
              <p className="mt-5 font-dm text-lg leading-relaxed text-t2">{intro}</p>
              <p className="mt-4 max-w-[720px] border-l border-acc pl-4 font-dm text-sm leading-relaxed text-t3">
                Where something is agreed per engagement rather than published — payment terms, response commitments, what a specific partnership covers — the answer says so instead of inventing a policy.
              </p>
            </div>
          </div>
        </header>

        <FaqKnowledgeBase categories={categories} />

        <section aria-labelledby="faq-close" className="border-t border-b1 bg-s1/40 px-6 py-20 md:px-12">
          <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
            <div>
              <h2 id="faq-close" className="font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-.03em]">Still the wrong question for your situation?</h2>
              <p className="mt-4 max-w-[640px] font-dm text-base leading-relaxed text-t2">
                Most of these answers end with &ldquo;it depends on what we find&rdquo; for good reason. If you want a specific answer about your website, a{" "}
                <Link href="/services/business-growth-audit" prefetch={false} className="text-t1 underline decoration-acc underline-offset-4">
                  Business Growth Audit
                </Link>{" "}
                produces one, and the{" "}
                <Link href="/work" prefetch={false} className="text-t1 underline decoration-acc underline-offset-4">
                  case studies
                </Link>{" "}
                show what the work looks like in practice.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/quote" prefetch={false} className="btn-primary font-dm">
                Discuss a project <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/contact" prefetch={false} className="btn-ghost font-dm">
                Ask a question
              </Link>
              <Link href="/insights" prefetch={false} className="btn-ghost font-dm">
                Read the insights library
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
