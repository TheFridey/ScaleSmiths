import Link from "next/link"
import { ArrowRight, ChevronRight, MapPin } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { FounderCard } from "@/components/FounderCard"
import {
  aboutMetadata,
  approachPillars,
  buildAboutSchemas,
  founders,
  originStatements,
} from "@/lib/founders"

export const metadata = aboutMetadata

export default function AboutPage() {
  const schemas = buildAboutSchemas(process.env.NEXT_PUBLIC_SITE_URL)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }} />

      <section className="px-6 pb-14 pt-10 md:px-12 md:pb-20 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <nav aria-label="Breadcrumb" className="font-dm text-xs text-t3">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-t1">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight size={12} />
              </li>
              <li aria-current="page" className="text-t1">
                About
              </li>
            </ol>
          </nav>

          <AnimateIn className="mt-10 grid gap-10 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
            <div>
              <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">
                About & founders
              </span>
              <h1 className="mt-3 max-w-4xl font-syne text-[clamp(38px,6.5vw,76px)] font-black leading-[1.02] tracking-[-.04em]">
                Two founders. One accountable relationship.
              </h1>
              <p className="mt-6 max-w-3xl font-dm text-lg leading-relaxed text-t2">
                ScaleSmiths combines commercial thinking with technical execution. Trevor leads the
                commercial growth and relationship perspective; Rhys leads strategy, engineering,
                systems and delivery. Together, they stay close to the problem and the work.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/quote?intent=strategy_call" prefetch={false} className="btn-primary font-dm">
                  Talk to a Founder
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/work" prefetch={false} className="btn-ghost font-dm">
                  See the Work
                </Link>
              </div>
            </div>

            <aside
              aria-label="Where ScaleSmiths is based"
              className="rounded-2xl border border-acc/25 bg-acc/[.07] p-6 md:p-8"
            >
              <p className="flex items-center gap-2 font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">
                <MapPin size={14} className="text-acc" aria-hidden="true" />
                Hucknall, Nottinghamshire
              </p>
              <p className="mt-5 font-dm text-sm leading-relaxed text-t2">
                We are based in Hucknall, on the northern edge of Nottingham. The first project
                published under the ScaleSmiths name was a Hucknall business, and local work still
                sits alongside national and international platform builds.
              </p>
              <p className="mt-4 font-dm text-sm leading-relaxed text-t2">
                Projects are delivered remotely with a communication and review cadence agreed in
                the project scope.
              </p>
              <Link
                href="/web-design-hucknall"
                prefetch={false}
                className="mt-6 inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc"
              >
                Web design in Hucknall
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </aside>
          </AnimateIn>
        </div>
      </section>

      <section
        aria-labelledby="about-origin"
        className="border-y border-b1 bg-s1/60 px-6 py-16 md:px-12 md:py-20"
      >
        <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Origin</span>
            <h2 id="about-origin" className="mt-2 font-syne text-[clamp(28px,4.2vw,44px)] font-extrabold tracking-[-.03em]">
              How ScaleSmiths started.
            </h2>
            <p className="mt-4 font-dm text-sm leading-relaxed text-t3">Built in Hucknall, working across local growth and complex digital systems.</p>
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

      <section aria-labelledby="about-founders" className="px-6 py-16 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-3xl">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">The founders</span>
            <h2 id="about-founders" className="mt-2 font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold tracking-[-.03em]">
              Who owns and delivers the work.
            </h2>
            <p className="mt-3 font-dm text-sm leading-relaxed text-t2">
              Complementary commercial and technical leadership gives clients a direct route from
              the business problem to a solution that can be delivered and improved.
            </p>
          </div>
          <div className="mt-10 grid gap-3 lg:grid-cols-2 lg:items-start">
            {founders.map((founder) => (
              <FounderCard key={founder.slug} founder={founder} />
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="about-approach"
        className="border-y border-b1 bg-s1/60 px-6 py-16 md:px-12 md:py-20"
      >
        <div className="mx-auto max-w-[1240px]">
          <div className="max-w-3xl">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">The approach</span>
            <h2 id="about-approach" className="mt-2 font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold tracking-[-.03em]">
               Find. Fix. Grow.
            </h2>
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
            <Link href="/local-growth" prefetch={false} className="btn-ghost font-dm">
              Local Growth
            </Link>
            <Link href="/custom-systems" prefetch={false} className="btn-ghost font-dm">
              Custom Systems
            </Link>
            <Link href="/pricing" prefetch={false} className="btn-ghost font-dm">
              Pricing Guidance
            </Link>
            <Link href="/digital-growth-partnership" prefetch={false} className="btn-ghost font-dm">
              Digital Growth Partnership
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Founder-led call to action" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[760px] rounded-3xl border border-acc/20 bg-gradient-to-br from-s2 to-acc/5 px-8 py-[64px] text-center md:px-16">
          <h2 className="font-syne text-[clamp(28px,4.5vw,44px)] font-extrabold tracking-[-.025em]">
            Speak to a founder, not a sales team.
          </h2>
          <p className="mx-auto mt-4 max-w-[460px] font-dm text-base leading-relaxed text-t2">
            Tell us what the business needs to do next. A founder reviews every enquiry and answers
            it directly — including when the honest answer is that you do not need a rebuild.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/quote?intent=strategy_call" prefetch={false} className="btn-primary font-dm inline-flex">
              Request a Strategy Call
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/quote" prefetch={false} className="btn-ghost font-dm">
              Start a Project Brief
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
