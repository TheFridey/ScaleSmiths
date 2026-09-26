import Link from "next/link"
import { ArrowRight, CheckCircle2, Mail, Shield } from "lucide-react"
import { AnimateIn, StaggerIn } from "@/components/AnimateIn"
import { PageBreadcrumbs } from "@/components/Breadcrumbs"
import { ContextualFaqs } from "@/components/faq/ContextualFaqs"
import { HeroEmbers } from "@/components/HeroEmbers"
import { JsonLd } from "@/components/JsonLd"
import {
  SECURITY_CONTACT_ANCHOR,
  buildSecurityPageSchemas,
  securityAssurance,
  securityFaqs,
  securityHosting,
  securityLifecycle,
  securityPageCopy,
  securityPhilosophy,
  securityResilience,
  securitySections,
} from "@/lib/security-page"
import { CONTACT_EMAIL } from "@/lib/site-identity"

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{children}</p>
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-3 max-w-[820px] font-syne text-[clamp(28px,4.6vw,48px)] font-extrabold leading-[1.05] tracking-[-.03em]">
      {children}
    </h2>
  )
}

function SectionLede({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">{children}</p>
}

export function SecurityPage() {
  const schemas = buildSecurityPageSchemas(process.env.NEXT_PUBLIC_SITE_URL)

  return (
    <>
      <JsonLd data={schemas} />

      <section className="enterprise-hero relative overflow-hidden px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 80% 12%, rgba(232,160,69,0.10), transparent 42%), radial-gradient(ellipse at 8% 90%, rgba(185,140,90,0.05), transparent 38%)",
          }}
        />
        <div aria-hidden="true" className="enterprise-grid pointer-events-none absolute inset-0 opacity-[0.22]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 opacity-55">
          <HeroEmbers />
        </div>

        <div className="relative mx-auto max-w-[1240px]">
          <PageBreadcrumbs
            className="mb-10"
            items={[
              { name: "Home", path: "/" },
              { name: "Enterprise", path: "/enterprise" },
              { name: "Security", path: "/security" },
            ]}
          />

          <AnimateIn className="max-w-[900px]">
            <SectionEyebrow>{securityPageCopy.eyebrow}</SectionEyebrow>
            <h1 className="mt-4 font-syne text-[clamp(34px,6.4vw,64px)] font-extrabold leading-[1.02] tracking-[-.04em] text-t1">
              {securityPageCopy.title}
            </h1>
            <p className="mt-7 max-w-[740px] font-dm text-lg leading-relaxed text-t2">{securityPageCopy.lede}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={securityPageCopy.primaryCta.href} prefetch={false} className="btn-primary font-dm">
                {securityPageCopy.primaryCta.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href={securityPageCopy.secondaryCta.href} prefetch={false} className="btn-ghost font-dm">
                {securityPageCopy.secondaryCta.label}
              </Link>
            </div>
            <p className="mt-6 max-w-[620px] font-dm text-sm leading-relaxed text-t3">
              Related reading:{" "}
              <Link href="/enterprise" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                Enterprise systems
              </Link>
              ,{" "}
              <Link href="/enterprise/delivery" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                Enterprise delivery
              </Link>
              ,{" "}
              <Link href="/custom-systems" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                Custom systems
              </Link>
              ,{" "}
              <Link href="/about" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                About ScaleSmiths
              </Link>
              .
            </p>
          </AnimateIn>
        </div>
      </section>

      <section aria-labelledby="security-philosophy" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Security philosophy</SectionEyebrow>
            <SectionHeading id="security-philosophy">Controls belong in the design, not the appendix.</SectionHeading>
            <SectionLede>
              The operating model, data sensitivity and failure modes shape the security work. Checklists are useful; they are not a substitute for architecture.
            </SectionLede>
          </AnimateIn>
          <StaggerIn className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-b1 bg-b1 sm:grid-cols-2">
            {securityPhilosophy.map((item) => (
              <article key={item.title} className="bg-bg p-6 md:p-7">
                <h3 className="font-syne text-lg font-bold tracking-[-.01em]">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </StaggerIn>
        </div>
      </section>

      {securitySections.map((section, sectionIndex) => (
        <section
          key={section.id}
          aria-labelledby={section.id}
          className={sectionIndex % 2 === 0 ? "px-6 py-20 md:px-12 md:py-24" : "border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24"}
        >
          <div className="mx-auto max-w-[1240px]">
            <AnimateIn>
              <SectionEyebrow>{section.eyebrow}</SectionEyebrow>
              <SectionHeading id={section.id}>{section.title}</SectionHeading>
              <SectionLede>{section.lede}</SectionLede>
            </AnimateIn>
            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {section.items.map((item) => (
                <article key={item.title} className="rounded-2xl border border-b1 bg-bg/70 p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 size={15} className="mt-1 shrink-0 text-acc" aria-hidden="true" />
                    <div>
                      <h3 className="font-syne text-lg font-bold">{item.title}</h3>
                      <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section aria-labelledby="security-lifecycle" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <AnimateIn>
            <SectionEyebrow>Secure delivery</SectionEyebrow>
            <SectionHeading id="security-lifecycle">From design through dependency risk and test evidence.</SectionHeading>
            <SectionLede>
              Secure development, dependency hygiene, automated testing and third-party penetration testing when required — scoped to the risk of the system being built.
            </SectionLede>
          </AnimateIn>
          <ol className="grid gap-3 sm:grid-cols-2">
            {securityLifecycle.map((item, index) => (
              <li key={item.title} className="rounded-2xl border border-b1 bg-s1 p-5 md:p-6">
                <span className="font-syne text-sm font-bold text-acc">{index + 1}</span>
                <h3 className="mt-2 font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="security-resilience" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Resilience and operations</SectionEyebrow>
            <SectionHeading id="security-resilience">Backups, observability and incident handling are part of the system.</SectionHeading>
            <SectionLede>
              Availability and recoverability are security concerns when the software becomes operationally critical.
            </SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {securityResilience.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-bg p-6">
                <h3 className="font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="security-hosting" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Hosting, residency and client controls</SectionEyebrow>
            <SectionHeading id="security-hosting">Meet the estate where it already has rules.</SectionHeading>
            <SectionLede>
              Client cloud accounts, residency constraints, subprocessors and pre-development security reviews are treated as design inputs.
            </SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {securityHosting.map((item) => (
              <article key={item.title} className="enterprise-panel rounded-2xl border border-b1 bg-s1/70 p-6 md:p-7">
                <h3 className="font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="security-assurance" className="border-y border-acc/20 bg-acc/[.04] px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn className="max-w-[820px]">
            <SectionEyebrow>Certifications &amp; assurance</SectionEyebrow>
            <SectionHeading id="security-assurance">{securityAssurance.title}</SectionHeading>
            <SectionLede>{securityAssurance.intro}</SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {[
              { title: "Current status", body: securityAssurance.held },
              { title: "Programme direction", body: securityAssurance.planned },
              { title: "Important boundary", body: securityAssurance.boundary },
            ].map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1/80 bg-bg/70 p-6">
                <div className="flex items-center gap-3">
                  <Shield size={16} className="text-acc" aria-hidden="true" />
                  <h3 className="font-syne text-lg font-bold">{item.title}</h3>
                </div>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ContextualFaqs
        id="security-faqs"
        eyebrow="Enterprise security FAQ"
        title="Direct answers before procurement deepens."
        intro="Cloud hosting, SSO, residency, documentation, backups and audit trails — without inventing certifications."
        items={securityFaqs}
        hubHash="custom-development"
        className="border-t border-b1 bg-s1/50"
      />

      <section
        id={SECURITY_CONTACT_ANCHOR}
        aria-labelledby="security-contact-heading"
        className="relative overflow-hidden border-t border-b1 px-6 py-20 md:px-12 md:py-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(232,160,69,0.10), transparent 55%)" }}
        />
        <div className="relative mx-auto max-w-[1240px]">
          <div className="enterprise-panel rounded-[1.5rem] border border-acc/25 bg-s1 p-7 md:p-10 lg:grid lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-10">
            <div>
              <SectionEyebrow>Security contact</SectionEyebrow>
              <h2 id="security-contact-heading" className="mt-3 font-syne text-[clamp(28px,4.2vw,44px)] font-extrabold tracking-[-.03em]">
                Review security requirements with the people who would build the system.
              </h2>
              <p className="mt-5 max-w-[640px] font-dm text-sm leading-relaxed text-t2">
                Share questionnaires, residency constraints, identity requirements or architecture expectations before development. For enterprise engagements, the enquiry route uses a founder-reviewed brief.
              </p>
              <p className="mt-4 font-dm text-sm text-t3">
                Security contact:{" "}
                <a href={securityPageCopy.securityEmailHref} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">
                  {CONTACT_EMAIL}
                </a>
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 lg:mt-0">
              <Link href={securityPageCopy.enquiryCta.href} prefetch={false} className="btn-primary justify-center font-dm">
                {securityPageCopy.enquiryCta.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href={securityPageCopy.securityEmailHref} className="btn-ghost justify-center font-dm">
                <Mail size={16} aria-hidden="true" />
                Email a security enquiry
              </a>
              <Link href="/enterprise" prefetch={false} className="btn-ghost justify-center font-dm">
                View enterprise systems
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
