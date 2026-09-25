import Link from "next/link"
import { ArrowRight, ChevronRight, MapPin } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { FounderCard } from "@/components/FounderCard"
import { JsonLd } from "@/components/JsonLd"
import { aboutMetadata, approachPillars, founders, originStatements } from "@/lib/founders"
import { siteBaseUrl } from "@/lib/site-identity"
import { buildAboutSchemas } from "@/lib/structured-data"

export const metadata = aboutMetadata

const whatWeBuild = [
  { title: "Local growth websites", description: "Search-led sites that turn local demand into enquiries and bookings.", href: "/local-growth" },
  { title: "E-commerce", description: "Custom storefronts and admin tooling when templates no longer fit the workflow.", href: "/e-commerce-development-nottingham" },
  { title: "Custom systems and SaaS", description: "Web applications, portals, billing, automation and production infrastructure.", href: "/custom-systems" },
  { title: "Ongoing improvement", description: "A scoped Digital Growth Partnership around the current estate or after a ScaleSmiths build.", href: "/digital-growth-partnership" },
]

const relationshipModel = [
  { title: "A founder conversation first", description: "The first call is with the people who will shape and deliver the work, not a sales intermediary." },
  { title: "Commercial and technical scoping together", description: "Trevor frames the commercial priorities; Rhys frames the technical approach, risks and delivery." },
  { title: "Delivery by the people who scoped it", description: "No hand-off from sales to an account manager to an outsourced developer." },
  { title: "Continuity after launch", description: "A Digital Growth Partnership can begin with an existing digital estate or continue after a ScaleSmiths build, with the same founders remaining accountable." },
]

export default function AboutPage() {
  const schemas = buildAboutSchemas(siteBaseUrl())

  return (
    <>
      <JsonLd data={schemas} />

      <section className="px-6 pb-14 pt-10 md:px-12 md:pb-20 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <nav aria-label="Breadcrumb" className="font-dm text-xs text-t3">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-t1">Home</Link>
              </li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li aria-current="page" className="text-t1">About</li>
            </ol>
          </nav>

          <AnimateIn className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
            <div>
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">About & founders</span>
              <h1 className="mt-3 max-w-4xl font-syne text-[clamp(38px,6.5vw,76px)] font-black leading-[1.02] tracking-[-.04em]">
                Two founders. One accountable team. Built around the business.
              </h1>
              <p className="mt-6 max-w-3xl font-dm text-lg leading-relaxed text-t2">
                ScaleSmiths is founder-led across growth strategy, engineering and delivery. We start with the commercial problem, recommend the work that genuinely makes sense, and stay directly involved from the first conversation through build and ongoing improvement.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/quote?intent=strategy_call" prefetch={false} className="btn-primary font-dm">
                  Talk to a Founder <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/work" prefetch={false} className="btn-ghost font-dm">See the Work</Link>
              </div>
            </div>

            <aside aria-label="Where ScaleSmiths is based" className="rounded-2xl border border-acc/25 bg-acc/[.07] p-6 md:p-8">
              <p className="flex items-center gap-2 font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">
                <MapPin size={14} className="text-acc" aria-hidden="true" /> Hucknall, Nottinghamshire
              </p>
              <p className="mt-5 font-dm text-sm leading-relaxed text-t2">
                We are based in Hucknall, on the northern edge of Nottingham. Local work sits alongside national and international platform builds, with the same principle underneath both: understand the real business problem before deciding what to build.
              </p>
              <p className="mt-4 font-dm text-sm leading-relaxed text-t2">
                Projects are delivered directly by the founders and, as ScaleSmiths grows, by specialists working inside the same accountable delivery model.
              </p>
              <Link href="/web-design-hucknall" prefetch={false} className="mt-6 inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
                Web design in Hucknall <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </aside>
          </AnimateIn>
        </div>
      </section>

      <section aria-labelledby="about-origin" className="border-y border-b1 bg-s1/60 px-6 py-16 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Origin</span>
            <h2 id="about-origin" className="mt-2 font-syne text-[clamp(28px,4.2vw,44px)] font-extrabold tracking-[-.03em]">How ScaleSmiths started.</h2>
            <p className="mt-4 font-dm text-sm leading-relaxed text-t3">
              From local commercial work to increasingly complex software, the principle has stayed the same: understand the business problem before choosing the technical answer.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {originStatements.map((statement, index) => (
              <li key={statement.text} className="rounded-2xl border border-b1 bg-bg/60 p-6">
                <span className="font-syne text-sm font-bold text-acc">0{index + 1}</span>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{statement.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="about-founders" className="relative overflow-hidden px-6 py-16 md:px-12 md:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(253,230,138,0.07),transparent_40%),radial-gradient(ellipse_at_90%_80%,rgba(232,160,69,0.06),transparent_45%)]"
        />
        <div className="relative mx-auto max-w-[1240px]">
          <div className="max-w-3xl">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">The founders</span>
            <h2 id="about-founders" className="mt-2 font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold tracking-[-.03em]">Commercial thinking meets technical delivery.</h2>
            <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
              Trevor leads growth strategy and client partnerships. Rhys leads engineering, product and technical delivery. Both stay directly involved in understanding what the business needs and making sure the work connects back to that outcome.
            </p>
          </div>
          <div className="mt-10 grid gap-3 lg:grid-cols-2 lg:items-start">
            {founders.map((founder) => <FounderCard key={founder.slug} founder={founder} />)}
          </div>
        </div>
      </section>

      <section aria-labelledby="about-builds" className="px-6 pb-16 md:px-12 md:pb-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-2">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">What we build</span>
            <h2 id="about-builds" className="mt-2 font-syne text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-.03em]">Websites, platforms and the systems behind them.</h2>
            <ul className="mt-6 grid gap-2">
              {whatWeBuild.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} prefetch={false} className="group flex items-start justify-between gap-4 rounded-xl border border-b1 bg-s1 p-4 transition-colors hover:border-b2">
                    <span>
                      <span className="block font-syne text-base font-bold">{item.title}</span>
                      <span className="mt-1 block font-dm text-sm leading-relaxed text-t2">{item.description}</span>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" className="mt-1 shrink-0 text-t3 transition-transform group-hover:translate-x-1 group-hover:text-acc" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">How clients work with us</span>
            <h2 className="mt-2 font-syne text-[clamp(28px,4vw,42px)] font-extrabold tracking-[-.03em]">Founder-led from first call to ongoing roadmap.</h2>
            <ol className="mt-6 grid gap-3">
              {relationshipModel.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[36px_1fr] gap-3 border-t border-b1 pt-4">
                  <span className="font-syne text-sm font-bold text-acc">0{index + 1}</span>
                  <span>
                    <span className="block font-syne text-base font-bold">{step.title}</span>
                    <span className="mt-1 block font-dm text-sm leading-relaxed text-t2">{step.description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="about-approach" className="border-y border-b1 bg-s1/60 px-6 py-16 md:px-12 md:py-20">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-3xl">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">The approach</span>
            <h2 id="about-approach" className="mt-2 font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold tracking-[-.03em]">Find. Fix. Grow.</h2>
            <p className="mt-4 font-dm text-sm leading-relaxed text-t2">The service changes with the problem. The underlying job does not: find what is holding the business back, fix the right thing, then keep improving where an ongoing relationship creates value.</p>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {approachPillars.map((pillar, index) => (
              <article key={pillar.title} className="rounded-2xl border border-b1 bg-bg/60 p-6">
                <div className="font-syne text-sm font-bold text-acc">0{index + 1}</div>
                <h3 className="mt-3 font-syne text-xl font-bold">{pillar.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{pillar.description}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/local-growth" prefetch={false} className="btn-ghost font-dm">Local Growth</Link>
            <Link href="/custom-systems" prefetch={false} className="btn-ghost font-dm">Custom Systems</Link>
            <Link href="/digital-growth-partnership" prefetch={false} className="btn-ghost font-dm">Growth Partnership</Link>
          </div>
        </div>
      </section>

      <section aria-label="Founder-led call to action" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[760px] rounded-3xl border border-acc/20 bg-gradient-to-br from-s2 to-acc/5 px-8 py-[64px] text-center md:px-16">
          <h2 className="font-syne text-[clamp(28px,4.5vw,44px)] font-extrabold tracking-[-.025em]">Speak to a founder, not a sales team.</h2>
          <p className="mx-auto mt-4 max-w-[500px] font-dm text-base leading-relaxed text-t2">
            Tell us what the business needs to do next. We will look at the problem first — including when the honest answer is that you do not need a rebuild.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/quote?intent=strategy_call" prefetch={false} className="btn-primary font-dm inline-flex">
              Request a Strategy Call <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/quote" prefetch={false} className="btn-ghost font-dm">Start a Project Brief</Link>
          </div>
        </div>
      </section>
    </>
  )
}
