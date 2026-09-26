import Link from "next/link"
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Network,
  Shield,
  Workflow,
} from "lucide-react"
import { AnimateIn, StaggerIn } from "@/components/AnimateIn"
import { PageBreadcrumbs } from "@/components/Breadcrumbs"
import { EnterpriseArchitectureFramework } from "@/components/EnterpriseArchitectureFramework"
import { ContextualFaqs } from "@/components/faq/ContextualFaqs"
import { FounderStrip } from "@/components/FounderStrip"
import { HeroEmbers } from "@/components/HeroEmbers"
import { JsonLd } from "@/components/JsonLd"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import {
  ENTERPRISE_ENQUIRY_ANCHOR,
  ENTERPRISE_PROOF_SLUGS,
  buildEnterprisePageSchemas,
  enterpriseCapabilities,
  enterpriseFaqs,
  enterpriseFounderAdvantage,
  enterpriseIntegrations,
  enterpriseMultiSite,
  enterprisePageCopy,
  enterpriseProblems,
  enterpriseProcess,
  enterpriseProofIntro,
  enterpriseSecurity,
  enterpriseSystemTypes,
} from "@/lib/enterprise-page"

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{children}</p>
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-3 max-w-[820px] font-syne text-[clamp(30px,5vw,52px)] font-extrabold leading-[1.05] tracking-[-.03em]">
      {children}
    </h2>
  )
}

function SectionLede({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">{children}</p>
}

export function EnterprisePage() {
  const studies = caseStudiesForSlugs([...ENTERPRISE_PROOF_SLUGS])
  const schemas = buildEnterprisePageSchemas(process.env.NEXT_PUBLIC_SITE_URL)

  return (
    <>
      <JsonLd data={schemas} />

      <section className="enterprise-hero relative overflow-hidden px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 78% 18%, rgba(232,160,69,0.14), transparent 44%), radial-gradient(ellipse at 12% 88%, rgba(185,140,90,0.06), transparent 40%)",
          }}
        />
        <div
          aria-hidden="true"
          className="enterprise-grid pointer-events-none absolute inset-0 opacity-[0.28]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 opacity-70">
          <HeroEmbers />
        </div>

        <div className="relative mx-auto max-w-[1240px]">
          <PageBreadcrumbs
            className="mb-10"
            items={[
              { name: "Home", path: "/" },
              { name: "Services", path: "/services" },
              { name: "Enterprise", path: "/enterprise" },
            ]}
          />

          <AnimateIn className="max-w-[920px]">
            <SectionEyebrow>{enterprisePageCopy.eyebrow}</SectionEyebrow>
            <h1 className="mt-4 font-syne text-[clamp(36px,7vw,72px)] font-extrabold leading-[1.02] tracking-[-.04em] text-t1">
              {enterprisePageCopy.title}
            </h1>
            <p className="mt-7 max-w-[760px] font-dm text-lg leading-relaxed text-t2">
              {enterprisePageCopy.lede}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={enterprisePageCopy.primaryCta.href} prefetch={false} className="btn-primary font-dm">
                {enterprisePageCopy.primaryCta.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href={enterprisePageCopy.secondaryCta.href} prefetch={false} className="btn-ghost font-dm">
                {enterprisePageCopy.secondaryCta.label}
              </Link>
            </div>
            <p className="mt-6 max-w-[640px] font-dm text-sm leading-relaxed text-t3">
              Complements our{" "}
              <Link href="/local-growth" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                local growth
              </Link>{" "}
              and{" "}
              <Link href="/custom-systems" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                custom systems
              </Link>{" "}
              routes — for organisations whose operational software has become a strategic constraint.
            </p>
          </AnimateIn>
        </div>
      </section>

      <section aria-labelledby="enterprise-problems" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Enterprise problems we solve</SectionEyebrow>
            <SectionHeading id="enterprise-problems">When the estate no longer matches the operation.</SectionHeading>
            <SectionLede>
              Most organisations do not need another generic tool. They need software that collapses fragmentation, reduces duplicated work and makes complex operations controllable.
            </SectionLede>
          </AnimateIn>
          <StaggerIn className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-b1 bg-b1 sm:grid-cols-2 xl:grid-cols-3">
            {enterpriseProblems.map((problem) => (
              <article key={problem.title} className="bg-bg p-6 md:p-7">
                <h3 className="font-syne text-lg font-bold tracking-[-.01em]">{problem.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{problem.body}</p>
              </article>
            ))}
          </StaggerIn>
        </div>
      </section>

      <section aria-labelledby="enterprise-systems" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Types of systems we build</SectionEyebrow>
            <SectionHeading id="enterprise-systems">Platforms for how the organisation actually works.</SectionHeading>
            <SectionLede>
              From internal operations to partner-facing portals, the common thread is software that encodes real process, ownership and control — not a brochure product forced onto the business.
            </SectionLede>
          </AnimateIn>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {enterpriseSystemTypes.map((system, index) => (
              <AnimateIn key={system.title} delay={index * 0.04} className="enterprise-panel rounded-2xl border border-b1 bg-s1/70 p-6 md:p-7">
                <div className="flex items-start gap-4">
                  <span className="mt-1 font-syne text-sm font-bold text-acc">0{index + 1}</span>
                  <div>
                    <h3 className="font-syne text-xl font-bold">{system.title}</h3>
                    <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{system.body}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="enterprise-capabilities" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Enterprise software capabilities</SectionEyebrow>
            <SectionHeading id="enterprise-capabilities">The engineering surface area behind the platform.</SectionHeading>
            <SectionLede>
              Capabilities are selected against the operating problem. The list below is the practical stack of work enterprise buyers typically need in combination.
            </SectionLede>
          </AnimateIn>
          <ul className="mt-10 columns-1 gap-x-10 sm:columns-2 lg:columns-3">
            {enterpriseCapabilities.map((capability) => (
              <li key={capability} className="mb-3 flex break-inside-avoid items-start gap-3 font-dm text-sm text-t1">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />
                {capability}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <EnterpriseArchitectureFramework idPrefix="enterprise" hideEnterpriseLink />

      <section aria-labelledby="enterprise-security" className="border-y border-acc/20 bg-acc/[.04] px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Security and governance overview</SectionEyebrow>
            <SectionHeading id="enterprise-security">Designed for controlled environments.</SectionHeading>
            <SectionLede>
              Security language matters. We describe what systems are architected for and built with — not certifications or approvals ScaleSmiths does not currently hold.
            </SectionLede>
          </AnimateIn>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {enterpriseSecurity.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1/80 bg-bg/70 p-6 md:p-7">
                <div className="flex items-center gap-3">
                  <Shield size={16} className="text-acc" aria-hidden="true" />
                  <h3 className="font-syne text-lg font-bold">{item.title}</h3>
                </div>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/security" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
              View Security &amp; Trust practices
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="enterprise-integrations" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-start">
          <AnimateIn>
            <SectionEyebrow>Integration capabilities</SectionEyebrow>
            <SectionHeading id="enterprise-integrations">Connect the estate without fragile bridges.</SectionHeading>
            <SectionLede>
              Enterprise value often lives between systems. We build interfaces that can integrate with identity, operational platforms and data flows — subject to client security and procurement requirements.
            </SectionLede>
          </AnimateIn>
          <div className="grid gap-3">
            {enterpriseIntegrations.map((item, index) => (
              <div key={item.title} className="flex gap-4 border-t border-b1 py-5 first:border-t-0 first:pt-0">
                <Network size={16} className="mt-1 shrink-0 text-acc" aria-hidden="true" />
                <div>
                  <span className="font-dm text-xs text-t3">0{index + 1}</span>
                  <h3 className="mt-1 font-syne text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="enterprise-multisite" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Multi-site / multi-team systems</SectionEyebrow>
            <SectionHeading id="enterprise-multisite">One operating model. Many places of work.</SectionHeading>
            <SectionLede>
              Multi-site software fails when it ignores local reality or central control. We design for both — permissions, process and reporting that travel with the organisation.
            </SectionLede>
          </AnimateIn>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {enterpriseMultiSite.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-bg p-6">
                <Building2 size={16} className="text-acc" aria-hidden="true" />
                <h3 className="mt-4 font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="enterprise-process" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[.7fr_1.3fr]">
          <AnimateIn>
            <SectionEyebrow>Discovery-to-deployment process</SectionEyebrow>
            <SectionHeading id="enterprise-process">From operating constraint to controlled release.</SectionHeading>
            <SectionLede>
              The aim is not an unbounded transformation programme. It is a clear path from discovery to a first dependable system — then disciplined expansion.
            </SectionLede>
          </AnimateIn>
          <ol className="grid gap-3 sm:grid-cols-2">
            {enterpriseProcess.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-b1 bg-s1 p-5 md:p-6">
                <span className="font-syne text-sm font-bold text-acc">{index + 1}</span>
                <h3 className="mt-2 font-syne text-lg font-bold">{step.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 lg:col-span-2">
            <Link href="/enterprise/delivery" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
              View the full enterprise delivery process
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="enterprise-founder-advantage" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Founder-led delivery advantage</SectionEyebrow>
            <SectionHeading id="enterprise-founder-advantage">Senior enough for complexity. Small enough for accountability.</SectionHeading>
            <SectionLede>
              ScaleSmiths is not Accenture and does not pretend to be. The advantage is direct access to technically deep builders with delivery discipline — for organisations that want substance over theatre.
            </SectionLede>
          </AnimateIn>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {enterpriseFounderAdvantage.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-bg p-6 md:p-7">
                <Workflow size={16} className="text-acc" aria-hidden="true" />
                <h3 className="mt-4 font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <FounderStrip
        headingId="enterprise-founders"
        intro="Enterprise work is scoped and delivered with founder accountability. The people who challenge the brief stay responsible for the architecture and the release."
      />

      <section aria-labelledby="enterprise-proof" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn className="max-w-3xl">
            <SectionEyebrow>Relevant existing ScaleSmiths work</SectionEyebrow>
            <SectionHeading id="enterprise-proof">Technical depth already in public view.</SectionHeading>
            <SectionLede>{enterpriseProofIntro}</SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {studies.map((study) => (
              <ProjectCard key={study.slug} study={study} size="compact" />
            ))}
          </div>
          <div className="mt-8">
            <Link href="/work" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc">
              Browse all technical work
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <ContextualFaqs
        id="enterprise-faqs"
        eyebrow="Enterprise questions"
        title="What buyers usually need to clarify first."
        intro="Positioning, scope and governance — without overclaiming certifications or inventing enterprise customer logos."
        items={enterpriseFaqs}
        hubHash="custom-development"
        className="border-t border-b1 bg-s1/50"
      />

      <section
        id={ENTERPRISE_ENQUIRY_ANCHOR}
        aria-labelledby="enterprise-cta"
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
              <SectionEyebrow>Enterprise enquiry</SectionEyebrow>
              <h2 id="enterprise-cta" className="mt-3 font-syne text-[clamp(30px,4.5vw,48px)] font-extrabold tracking-[-.03em]">
                Discuss an enterprise system with the people who would build it.
              </h2>
              <p className="mt-5 max-w-[640px] font-dm text-sm leading-relaxed text-t2">
                Tell us about the operating constraint, the systems involved and the outcome that would matter. This enquiry route is ready for a dedicated enterprise form; today it opens a founder-reviewed brief with an enterprise intent.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 lg:mt-0">
              <Link href={enterprisePageCopy.enquiryCta.href} prefetch={false} className="btn-primary justify-center font-dm">
                {enterprisePageCopy.enquiryCta.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href={enterprisePageCopy.secondaryCta.href} prefetch={false} className="btn-ghost justify-center font-dm">
                {enterprisePageCopy.secondaryCta.label}
              </Link>
              <p className="pt-2 text-center font-dm text-xs leading-relaxed text-t3 lg:text-left">
                Subject to client security and procurement requirements. No invented certifications, logos or guaranteed compliance claims.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
