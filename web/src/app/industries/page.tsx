import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { IndustryExplorer } from "@/components/industries/IndustryExplorer"
import { JsonLd } from "@/components/JsonLd"
import {
  allIndustryHubs,
  buildIndustriesIndexSchemas,
  industryAzIndex,
  industryPath,
  metadataForIndustriesIndex,
  publishedIndustryPages,
} from "@/lib/industries"
import { siteBaseUrl } from "@/lib/site-identity"

export const metadata = metadataForIndustriesIndex()

export default function IndustriesIndexPage() {
  const hubs = allIndustryHubs()
  const published = publishedIndustryPages()
  const az = industryAzIndex()
  const schemas = buildIndustriesIndexSchemas(siteBaseUrl())

  return (
    <>
      <JsonLd data={schemas} />
      <main>
        <section className="relative overflow-hidden px-6 py-20 md:px-12 md:py-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(232,160,69,0.16),transparent_42%),radial-gradient(ellipse_at_90%_20%,rgba(180,80,20,0.12),transparent_40%)]"
          />
          <div className="relative mx-auto max-w-[1240px]">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Industries" }]} />
            <div className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div className="max-w-[720px]">
                <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Industries we help</span>
                <h1 className="page-hero-display mt-3">Find the page that understands your business.</h1>
                <p className="mt-6 font-dm text-lg leading-relaxed text-t2">
                  These pages describe the problems we see in specific kinds of business: a pest controller separating emergency calls from contract work, a printer collecting a usable specification, a CNC shop receiving a drawing instead of a vague email. We are based in the UK and work remotely with businesses elsewhere. We do not pretend to have a local office in your town.
                </p>
                <p className="mt-4 font-dm text-sm text-t3">
                  {published.length} published industry pages · {hubs.length} groups · if yours is not listed, you can still tell us about the business
                </p>
              </div>
              <IndustryExplorer featuredHints={["pest control", "podiatry", "roofing", "SaaS", "restaurant", "CNC"]} />
            </div>
          </div>
        </section>

        <section aria-labelledby="industry-hubs" className="border-y border-b1 bg-s1/40 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id="industry-hubs" className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              Browse by vertical
            </h2>
            <p className="mt-3 max-w-[640px] font-dm text-base text-t2">
              Start with the group closest to how you trade. Search and the A–Z list stay on this page, so you are not sent to a thin copy of the same page with a different town in the title.
            </p>
            <ul className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {hubs.map((hub) => (
                <li key={hub.slug}>
                  <Link
                    href={industryPath(hub.slug)}
                    prefetch={false}
                    className="group flex h-full flex-col rounded-2xl border border-b1 bg-s2/50 p-6 transition-colors hover:border-acc/40"
                  >
                    <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">{hub.eyebrow}</span>
                    <h3 className="mt-2 font-syne text-xl font-bold tracking-[-0.02em] group-hover:text-acc">{hub.shortName}</h3>
                    <p className="mt-3 flex-1 font-dm text-sm leading-relaxed text-t2">{hub.intro}</p>
                    <span className="mt-4 inline-flex items-center gap-1 font-dm text-sm font-semibold text-acc">
                      Open hub <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="published-industries" className="px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id="published-industries" className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              Published specialist pages
            </h2>
            <p className="mt-3 max-w-[640px] font-dm text-base text-t2">
              First-wave pages spanning trades, clinics, hospitality, print, retail, manufacturing, SaaS, beauty and professional services — each meaningfully different.
            </p>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {published.map((page) => (
                <li key={page.id}>
                  <Link
                    href={industryPath(page.hubSlug, page.slug)}
                    prefetch={false}
                    className="block rounded-xl border border-b1 bg-s1 p-5 transition-colors hover:border-acc/40"
                  >
                    <span className="font-syne text-lg font-bold">{page.name}</span>
                    <p className="mt-2 font-dm text-sm leading-relaxed text-t2 line-clamp-3">{page.primaryProblem}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="industry-az" className="border-t border-b1 bg-s1/30 px-6 py-16 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <h2 id="industry-az" className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
              A–Z industry index
            </h2>
            <p className="mt-3 max-w-[640px] font-dm text-base text-t2">
              Published pages link through. Candidates open a request route so nobody hits a dead end.
            </p>
            <div className="mt-10 grid gap-8">
              {az.map((group) => (
                <div key={group.letter}>
                  <h3 className="font-syne text-2xl font-bold text-acc">{group.letter}</h3>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <Link href={item.href} prefetch={false} className="footer-link inline-flex min-h-6 items-center font-dm text-sm text-t2">
                          {item.name}
                          {item.kind === "candidate" ? <span className="ml-2 text-xs text-t3">request</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-12 rounded-2xl border border-dashed border-b2 p-6">
              <h3 className="font-syne text-xl font-bold">Missing your industry?</h3>
              <p className="mt-2 max-w-[640px] font-dm text-sm text-t2">
                Whatever you run, tell us what is holding it back. We add proven niches without multiplying duplicates.
              </p>
              <Link href="/industries/request" prefetch={false} className="btn-primary mt-4 inline-flex font-dm">
                Tell us your industry <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
