import Link from "next/link"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { internationalDelivery, internationalPriceLines, INTERNATIONAL_PATH } from "@/lib/international-delivery"
import { buildPageMetadata } from "@/lib/page-metadata"
import { organizationReference, siteBaseUrl, websiteId } from "@/lib/site-identity"

export const metadata = buildPageMetadata({
  title: "International clients",
  absoluteTitle: internationalDelivery.metaTitle,
  description: internationalDelivery.description,
  path: INTERNATIONAL_PATH,
})

export default function InternationalPage() {
  const base = siteBaseUrl()
  const url = `${base}${INTERNATIONAL_PATH}`
  const prices = internationalPriceLines()
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: internationalDelivery.metaTitle,
      description: internationalDelivery.description,
      isPartOf: { "@id": websiteId(base) },
      about: organizationReference(base),
      inLanguage: "en-GB",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "International clients", item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: internationalDelivery.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    },
  ]

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <article className="px-6 py-20 md:px-12 md:py-28">
          <div className="mx-auto max-w-[1100px]">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "International clients" }]} />
            <div className="mt-10 max-w-[760px]">
              <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">UK founded · remote delivery</span>
              <h1 className="page-hero-display mt-3">{internationalDelivery.h1}</h1>
              <p className="mt-6 font-dm text-lg leading-relaxed text-t2">{internationalDelivery.intro}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/quote?intent=strategy_call&industry=international&hub=international&pathway=growth" prefetch={false} className="btn-primary font-dm">
                  Discuss an international project
                </Link>
                <Link href="/services/business-growth-audit" prefetch={false} className="btn-ghost font-dm">
                  Business Growth Audit
                </Link>
              </div>
            </div>

            <section aria-labelledby="remote-delivery" className="mt-16">
              <h2 id="remote-delivery" className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">How the work is delivered</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {internationalDelivery.sections.map((section) => (
                  <article key={section.title} className="rounded-2xl border border-b1 bg-s1 p-6">
                    <h3 className="font-syne text-xl font-bold tracking-[-0.02em]">{section.title}</h3>
                    <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{section.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section aria-labelledby="international-prices" className="mt-16">
              <h2 id="international-prices" className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
                Published offers
              </h2>
              <p className="mt-3 max-w-[720px] font-dm text-base leading-relaxed text-t2">
                International work is quoted in GBP. The Business Growth Audit is £395. Business email starts from £15/month. Website builds, Growth Partnerships and custom systems are scoped after discovery, and we do not publish a converted price in another currency.
              </p>
              <ul className="mt-8 grid gap-4 md:grid-cols-2">
                {prices.map((price) => (
                  <li key={price.name} className="rounded-2xl border border-b1 bg-s1 p-6">
                    <h3 className="font-syne text-lg font-bold">{price.name}</h3>
                    <p className="mt-2 font-dm text-2xl font-semibold text-acc">{price.priceLabel}</p>
                    <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{price.note}</p>
                    <Link href={price.href} prefetch={false} className="mt-4 inline-flex min-h-11 items-center font-dm text-sm font-semibold text-acc">
                      View this offer
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-[720px] font-dm text-sm leading-relaxed text-t2">
                Larger website work, Growth Partnerships beyond the starting scope, and custom systems are still quoted after discovery. See <Link href="/enterprise" className="underline underline-offset-2">enterprise delivery</Link> when the operation is multi-site or the system is bespoke.
              </p>
            </section>

            <section aria-labelledby="international-proof" className="mt-16 rounded-2xl border border-b1 bg-s1 p-6 md:p-8">
              <h2 id="international-proof" className="font-syne text-2xl font-bold">What has already been delivered abroad</h2>
              <p className="mt-3 max-w-[720px] font-dm text-sm leading-relaxed text-t2">
                CSDS is a published website and quote system for a computer-repair firm in Pennsylvania. That is one remote delivery. It is not a network of offices, and it is not a result we copy onto every international enquiry.
              </p>
              <Link href="/work/csds" prefetch={false} className="mt-4 inline-flex min-h-11 items-center font-dm text-sm font-semibold text-acc">
                Read the CSDS project
              </Link>
            </section>

            <section aria-labelledby="international-faqs" className="mt-16">
              <h2 id="international-faqs" className="font-syne text-2xl font-bold">Practical questions</h2>
              <div className="mt-6 grid gap-4">
                {internationalDelivery.faqs.map((faq) => (
                  <details key={faq.q} className="rounded-xl border border-b1 bg-s1 p-5">
                    <summary className="cursor-pointer font-syne text-lg font-bold">{faq.q}</summary>
                    <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{faq.a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </article>
      </main>
    </>
  )
}
