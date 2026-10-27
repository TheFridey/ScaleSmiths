import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import {
  allIndustryHubs,
  buildIndustryHubSchemas,
  getIndustryHub,
  getIndustryDemonstration,
  industryDemonstrationPath,
  industryPagesForHub,
  industryPath,
  metadataForIndustryHub,
} from "@/lib/industries"
import { routeLabel } from "@/lib/service-routes"
import { siteBaseUrl } from "@/lib/site-identity"

export function generateStaticParams() {
  return allIndustryHubs().map((hub) => ({ hub: hub.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ hub: string }> }) {
  const { hub } = await params
  return metadataForIndustryHub(hub) ?? {}
}

export default async function IndustryHubPage({ params }: { params: Promise<{ hub: string }> }) {
  const { hub: hubSlug } = await params
  const hub = getIndustryHub(hubSlug)
  if (!hub) notFound()

  const pages = industryPagesForHub(hub.slug)
  const demonstration = getIndustryDemonstration(hub.slug)
  const schemas = buildIndustryHubSchemas(hub.slug, siteBaseUrl())

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <section className="px-6 py-20 md:px-12 md:py-28">
          <div className="mx-auto max-w-[1240px]">
            <Breadcrumbs
              items={[
                { name: "Home", href: "/" },
                { name: "Industries", href: "/industries" },
                { name: hub.shortName },
              ]}
            />
            <div className="mt-10 max-w-[820px]">
              <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">{hub.eyebrow}</span>
              <h1 className="page-hero-display mt-3">{hub.h1}</h1>
              <p className="mt-6 font-dm text-lg leading-relaxed text-t2">{hub.intro}</p>
              <p className="mt-4 border-l border-acc pl-4 font-dm text-sm text-t3">{hub.audience}</p>
              {demonstration ? (
                <p className="mt-6">
                  <Link href={industryDemonstrationPath(hub.slug)} prefetch={false} className="btn-primary inline-flex font-dm">
                    Walk through the workflow
                  </Link>
                </p>
              ) : null}
            </div>
            <div className="mt-14 grid gap-10 md:grid-cols-2">
              {hub.sections.map((section, index) => (
                <section key={section.title} aria-labelledby={`${hub.slug}-guidance-${index}`}>
                  <h2 id={`${hub.slug}-guidance-${index}`} className="font-syne text-2xl font-bold">{section.title}</h2>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-4 font-dm text-base leading-relaxed text-t2">{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby={`${hub.slug}-pages`} className="border-y border-b1 bg-s1/40 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id={`${hub.slug}-pages`} className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              Specialist pages in this hub
            </h2>
            {pages.length > 0 ? (
              <ul className="mt-10 grid gap-4 md:grid-cols-2">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      href={industryPath(page.hubSlug, page.slug)}
                      prefetch={false}
                      className="group flex h-full flex-col rounded-2xl border border-b1 bg-s2/50 p-6 transition-colors hover:border-acc/40"
                    >
                      <h3 className="font-syne text-xl font-bold group-hover:text-acc">{page.name}</h3>
                      <p className="mt-3 flex-1 font-dm text-sm leading-relaxed text-t2">{page.primaryProblem}</p>
                      <span className="mt-4 inline-flex items-center gap-1 font-dm text-sm font-semibold text-acc">
                        Read industry page <ArrowRight size={14} aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-6 font-dm text-base text-t2">
                Published pages for this hub are still being researched.{" "}
                <Link href="/industries/request" prefetch={false} className="text-acc underline-offset-4 hover:underline">
                  Tell us your industry
                </Link>
                .
              </p>
            )}
          </div>
        </section>

        {pages.length > 0 ? (
          <section aria-labelledby={`${hub.slug}-evidence`} className="px-6 py-16 md:px-12">
            <div className="mx-auto max-w-[1240px]">
              <h2 id={`${hub.slug}-evidence`} className="font-syne text-2xl font-bold">Evidence the specialist pages will stand behind</h2>
              <ul className="mt-8 grid gap-4">
                {pages.map((page) => (
                  <li key={page.id} className="rounded-2xl border border-b1 bg-s1 p-6">
                    <h3 className="font-syne text-xl font-bold">
                      <Link href={industryPath(page.hubSlug, page.slug)} prefetch={false} className="hover:text-acc">{page.name}</Link>
                    </h3>
                    <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{page.proof.label}. {page.proof.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 className="font-syne text-2xl font-bold">Related solutions</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {hub.relatedSolutionHrefs.map((href) => (
                <li key={href}>
                  <Link href={href} prefetch={false} className="btn-ghost inline-flex font-dm text-sm">
                    {routeLabel(href)}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/industries" prefetch={false} className="btn-ghost inline-flex font-dm text-sm">
                  All industries
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </>
  )
}
