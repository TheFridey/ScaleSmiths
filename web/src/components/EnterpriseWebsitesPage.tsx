import Link from "next/link"
import { ArrowRight, CheckCircle2, Compass, GitBranch, Shield } from "lucide-react"
import { AnimateIn, StaggerIn } from "@/components/AnimateIn"
import { PageBreadcrumbs } from "@/components/Breadcrumbs"
import { ContextualFaqs } from "@/components/faq/ContextualFaqs"
import { FounderStrip } from "@/components/FounderStrip"
import { HeroEmbers } from "@/components/HeroEmbers"
import { JsonLd } from "@/components/JsonLd"
import { PageSectionNav } from "@/components/PageSectionNav"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import {
  ENTERPRISE_WEBSITES_PROOF_SLUGS,
  buildEnterpriseWebsitesPageSchemas,
  enterpriseWebsitesApproach,
  enterpriseWebsitesBuyerContext,
  enterpriseWebsitesCapabilities,
  enterpriseWebsitesCopy,
  enterpriseWebsitesFaqs,
  enterpriseWebsitesFounderAdvantage,
  enterpriseWebsitesSectionNav,
} from "@/lib/enterprise-websites-page"

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{children}</p>
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-3 max-w-[860px] font-syne text-[clamp(28px,4.6vw,48px)] font-extrabold leading-[1.05] tracking-[-.03em]">
      {children}
    </h2>
  )
}

function SectionLede({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">{children}</p>
}

export function EnterpriseWebsitesPage() {
  const studies = caseStudiesForSlugs([...ENTERPRISE_WEBSITES_PROOF_SLUGS])
  const schemas = buildEnterpriseWebsitesPageSchemas(process.env.NEXT_PUBLIC_SITE_URL)

  return (
    <>
      <JsonLd data={schemas} />

      <section className="enterprise-hero relative overflow-hidden px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 78% 16%, rgba(232,160,69,0.12), transparent 44%), radial-gradient(ellipse at 10% 88%, rgba(185,140,90,0.05), transparent 40%)",
          }}
        />
        <div aria-hidden="true" className="enterprise-grid pointer-events-none absolute inset-0 opacity-[0.24]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 opacity-60">
          <HeroEmbers />
        </div>

        <div className="relative mx-auto max-w-[1240px]">
          <PageBreadcrumbs
            className="mb-10"
            items={[
              { name: "Home", path: "/" },
              { name: "Services", path: "/services" },
              { name: "Enterprise Websites", path: "/enterprise-websites" },
            ]}
          />

          <AnimateIn className="max-w-[920px]">
            <SectionEyebrow>{enterpriseWebsitesCopy.eyebrow}</SectionEyebrow>
            <h1 className="mt-4 font-syne text-[clamp(34px,6.2vw,64px)] font-extrabold leading-[1.02] tracking-[-.04em]">
              {enterpriseWebsitesCopy.title}
            </h1>
            <p className="mt-7 max-w-[760px] font-dm text-lg leading-relaxed text-t2">{enterpriseWebsitesCopy.lede}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={enterpriseWebsitesCopy.primaryCta.href} prefetch={false} className="btn-primary font-dm">
                {enterpriseWebsitesCopy.primaryCta.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href={enterpriseWebsitesCopy.secondaryCta.href} prefetch={false} className="btn-ghost font-dm">
                {enterpriseWebsitesCopy.secondaryCta.label}
              </Link>
            </div>
            <p className="mt-6 font-dm text-sm leading-relaxed text-t3">
              Related:{" "}
              <Link href="/enterprise" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                Enterprise systems
              </Link>
              {" · "}
              <Link href="/enterprise/delivery" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                Delivery process
              </Link>
              {" · "}
              <Link href="/pricing#enterprise-systems" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                How larger work is priced
              </Link>
            </p>
          </AnimateIn>
        </div>
      </section>

      <PageSectionNav items={[...enterpriseWebsitesSectionNav]} label="Jump to" />

      <section aria-labelledby="enterprise-websites-buyer" className="border-y border-b1 bg-s1 px-6 py-16 md:px-12 md:py-20">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn className="max-w-3xl">
            <SectionEyebrow>Buyer context</SectionEyebrow>
            <SectionHeading id="enterprise-websites-buyer">{enterpriseWebsitesBuyerContext.title}</SectionHeading>
            <SectionLede>{enterpriseWebsitesBuyerContext.body}</SectionLede>
          </AnimateIn>
        </div>
      </section>

      <section id="enterprise-websites-capabilities" aria-labelledby="enterprise-websites-capabilities-heading" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>What we deliver</SectionEyebrow>
            <SectionHeading id="enterprise-websites-capabilities-heading">
              Digital experiences engineered around the organisation.
            </SectionHeading>
            <SectionLede>
              Corporate websites succeed when journey design, engineering, integrations, visibility and migration continuity are treated as one problem. ScaleSmiths works across that surface without selling a retail website package as an enterprise answer.
            </SectionLede>
          </AnimateIn>

          <div className="mt-12 grid gap-4">
            {enterpriseWebsitesCapabilities.map((capability) => (
              <article key={capability.title} className="rounded-2xl border border-b1 bg-s1/50 p-6 md:p-8">
                <h3 className="font-syne text-2xl font-bold tracking-[-.02em]">{capability.title}</h3>
                <p className="mt-3 max-w-[720px] font-dm text-sm leading-relaxed text-t2">{capability.body}</p>
                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                  {capability.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 font-dm text-sm leading-relaxed text-t2">
                      <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="enterprise-websites-approach" aria-labelledby="enterprise-websites-approach-heading" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>How we decide</SectionEyebrow>
            <SectionHeading id="enterprise-websites-approach-heading">
              Improve, integrate or rebuild, decided from evidence.
            </SectionHeading>
            <SectionLede>
              We are engineers first. Stack choices, rebuild recommendations and integration work follow discovery, not a predetermined productisation of the public site.
            </SectionLede>
          </AnimateIn>
          <StaggerIn className="mt-10 grid gap-4 md:grid-cols-2" staggerDelay={0.06}>
            {enterpriseWebsitesApproach.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-bg p-6 md:p-7">
                <Compass size={16} className="text-acc" aria-hidden="true" />
                <h3 className="mt-4 font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </StaggerIn>
        </div>
      </section>

      <section id="enterprise-websites-delivery" aria-labelledby="enterprise-websites-delivery-heading" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Founder-led delivery</SectionEyebrow>
            <SectionHeading id="enterprise-websites-delivery-heading">
              Why two founders can outperform a large agency for the right brief.
            </SectionHeading>
            <SectionLede>
              Direct access, accountability and requirements-led engineering matter more than headcount theatre. Capacity, specialists and support are assessed before we accept the work.
            </SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {enterpriseWebsitesFounderAdvantage.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-s1 p-6">
                <GitBranch size={16} className="text-acc" aria-hidden="true" />
                <h3 className="mt-4 font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-acc/25 bg-acc/[.05] p-6 md:p-8">
            <div className="flex items-start gap-3">
              <Shield size={18} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />
              <div>
                <h3 className="font-syne text-lg font-bold">Procurement, resilience and capacity</h3>
                <p className="mt-3 max-w-[720px] font-dm text-sm leading-relaxed text-t2">
                  Before accepting a corporate website or digital transformation brief, we assess complexity, third-party dependencies, specialist needs and the support model required after launch. Where additional resources are needed, that is agreed during discovery. We do not invent wider team sizes, guaranteed response times or accreditations we do not hold.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href="/enterprise/delivery" prefetch={false} className="btn-ghost font-dm">
                    View delivery process
                  </Link>
                  <Link href="/security" prefetch={false} className="btn-ghost font-dm">
                    Security &amp; Trust
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FounderStrip
        headingId="enterprise-websites-founders"
        intro="Corporate website and digital experience work is scoped with founder accountability. The people who challenge the brief stay responsible for architecture, delivery and handover."
      />

      <section id="enterprise-websites-proof" aria-labelledby="enterprise-websites-proof-heading" className="border-y border-b1 bg-s1/40 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn className="max-w-3xl">
            <SectionEyebrow>Engineering &amp; complex systems</SectionEyebrow>
            <SectionHeading id="enterprise-websites-proof-heading">
              Platforms, integrations and production depth you can inspect.
            </SectionHeading>
            <SectionLede>
              Selected public work prioritising custom platforms, SaaS surfaces, secure access, workflows, admin consoles and infrastructure. These are engineering proof points. Client contracts, founder-owned platforms and collaborative builds are labelled honestly in each case study; they are not named enterprise endorsements.
            </SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {studies.map((study) => (
              <ProjectCard key={study.slug} study={study} size="compact" />
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/work#engineering-complex-systems" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
              Browse Engineering &amp; Complex Systems
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link href="/enterprise" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-t2 hover:text-t1">
              {enterpriseWebsitesCopy.relatedSystemsCta.label}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <ContextualFaqs
        id="enterprise-websites-faqs"
        eyebrow="Enterprise website questions"
        title="What corporate buyers usually need clarified."
        intro="Pricing boundaries, how this differs from operational software, and how a founder-led team takes on larger digital estates."
        items={enterpriseWebsitesFaqs}
        hubHash="web-design"
        className="bg-bg"
      />

      <section
        id="enterprise-websites-enquire"
        aria-labelledby="enterprise-websites-cta"
        className="relative overflow-hidden border-t border-b1 px-6 py-20 md:px-12 md:py-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 0%, rgba(232,160,69,0.12), transparent 55%)",
          }}
        />
        <div className="relative mx-auto max-w-[1240px]">
          <div className="enterprise-panel rounded-[1.5rem] border border-acc/25 bg-s1 p-7 md:p-10 lg:grid lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-10">
            <div>
              <SectionEyebrow>Digital transformation enquiry</SectionEyebrow>
              <h2 id="enterprise-websites-cta" className="mt-3 font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold tracking-[-.03em]">
                Discuss Your Digital Transformation
              </h2>
              <p className="mt-5 max-w-[640px] font-dm text-sm leading-relaxed text-t2">
                Tell us about the organisation, the journeys that matter, the systems involved and the outcome that would count as success. The founders review the brief and say plainly whether ScaleSmiths is the right team, and what capacity and security questions need answering first.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 lg:mt-0">
              <Link href={enterpriseWebsitesCopy.primaryCta.href} prefetch={false} className="btn-primary justify-center font-dm">
                {enterpriseWebsitesCopy.primaryCta.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/quote" prefetch={false} className="btn-ghost justify-center font-dm">
                Website &amp; Growth enquiry
              </Link>
              <Link href="/pricing" prefetch={false} className="btn-ghost justify-center font-dm">
                Pricing journeys
              </Link>
              <p className="pt-2 text-center font-dm text-xs leading-relaxed text-t3 lg:text-left">
                Submitting an enquiry does not take payment or create a contract.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
