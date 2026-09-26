import Link from "next/link"
import { ArrowRight, CheckCircle2, GitBranch, Shield } from "lucide-react"
import { AnimateIn, StaggerIn } from "@/components/AnimateIn"
import { PageBreadcrumbs } from "@/components/Breadcrumbs"
import { ContextualFaqs } from "@/components/faq/ContextualFaqs"
import { HeroEmbers } from "@/components/HeroEmbers"
import { JsonLd } from "@/components/JsonLd"
import {
  ENTERPRISE_DELIVERY_CTA_ANCHOR,
  architectureDomains,
  buildEnterpriseDeliveryPageSchemas,
  changeControlPoints,
  deliveryPhases,
  deliveryStages,
  discoveryTopics,
  documentationOutputs,
  enterpriseDeliveryCopy,
  enterpriseDeliveryFaqs,
  releaseManagementPoints,
  requirementsOutputs,
  stagedDeliveryReasons,
  supportModels,
  testingTypes,
  uatPoints,
} from "@/lib/enterprise-delivery-page"

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{children}</p>
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-3 max-w-[840px] font-syne text-[clamp(28px,4.6vw,48px)] font-extrabold leading-[1.05] tracking-[-.03em]">
      {children}
    </h2>
  )
}

function SectionLede({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 max-w-[720px] font-dm text-base leading-relaxed text-t2">{children}</p>
}

export function EnterpriseDeliveryPage() {
  const schemas = buildEnterpriseDeliveryPageSchemas(process.env.NEXT_PUBLIC_SITE_URL)

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
              { name: "Enterprise", path: "/enterprise" },
              { name: "Delivery", path: "/enterprise/delivery" },
            ]}
          />

          <AnimateIn className="max-w-[900px]">
            <SectionEyebrow>{enterpriseDeliveryCopy.eyebrow}</SectionEyebrow>
            <h1 className="mt-4 font-syne text-[clamp(34px,6.2vw,64px)] font-extrabold leading-[1.02] tracking-[-.04em]">
              {enterpriseDeliveryCopy.title}
            </h1>
            <p className="mt-7 max-w-[740px] font-dm text-lg leading-relaxed text-t2">{enterpriseDeliveryCopy.lede}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={enterpriseDeliveryCopy.primaryCta.href} prefetch={false} className="btn-primary font-dm">
                {enterpriseDeliveryCopy.primaryCta.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href={enterpriseDeliveryCopy.secondaryCta.href} prefetch={false} className="btn-ghost font-dm">
                {enterpriseDeliveryCopy.secondaryCta.label}
              </Link>
            </div>
            <p className="mt-6 font-dm text-sm leading-relaxed text-t3">
              Related:{" "}
              <Link href="/enterprise" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">Enterprise systems</Link>
              {" · "}
              <Link href="/security" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">Security &amp; Trust</Link>
              {" · "}
              <Link href="/custom-systems" prefetch={false} className="text-t2 underline-offset-2 hover:text-t1 hover:underline">Custom systems</Link>
            </p>
          </AnimateIn>
        </div>
      </section>

      <section aria-labelledby="delivery-timeline" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Staged methodology</SectionEyebrow>
            <SectionHeading id="delivery-timeline">Discovery → Production → Expansion</SectionHeading>
            <SectionLede>
              Staged delivery reduces risk by forcing assumptions, scope and acceptance into the open before the organisation commits to a full build and rollout.
            </SectionLede>
          </AnimateIn>

          <ol className="delivery-timeline mt-12" aria-label="Enterprise delivery stages">
            {deliveryStages.map((stage, index) => (
              <li key={stage.id} className="delivery-timeline__item">
                <div className="delivery-timeline__marker" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="delivery-timeline__card enterprise-panel">
                  <h3 className="font-syne text-lg font-bold">{stage.label}</h3>
                  <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{stage.summary}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {stagedDeliveryReasons.map((reason) => (
              <article key={reason.title} className="rounded-2xl border border-b1 bg-bg p-5">
                <h3 className="font-syne text-base font-bold">{reason.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{reason.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="delivery-phases" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>End-to-end phases</SectionEyebrow>
            <SectionHeading id="delivery-phases">Fourteen phases from first conversation to continuous improvement.</SectionHeading>
            <SectionLede>
              Not every engagement needs equal depth in every phase. The sequence stays the same so larger organisations can see how discipline is applied.
            </SectionLede>
          </AnimateIn>
          <ol className="mt-12 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {deliveryPhases.map((phase, index) => (
              <li key={phase.title} className="rounded-2xl border border-b1 bg-s1 p-5">
                <span className="font-syne text-sm font-bold text-acc">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-2 font-syne text-lg font-bold">{phase.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{phase.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="delivery-discovery" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Discovery</SectionEyebrow>
            <SectionHeading id="delivery-discovery">Understand the estate before proposing the system.</SectionHeading>
            <SectionLede>
              Discovery covers the people, processes, data and constraints that determine whether software will actually improve the operation.
            </SectionLede>
          </AnimateIn>
          <ul className="mt-10 columns-1 gap-x-10 sm:columns-2 lg:columns-3">
            {discoveryTopics.map((topic) => (
              <li key={topic} className="mb-3 flex break-inside-avoid items-start gap-3 font-dm text-sm text-t1">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />
                {topic}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="delivery-requirements" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Requirements</SectionEyebrow>
            <SectionHeading id="delivery-requirements">Artifacts that make scope inspectable.</SectionHeading>
            <SectionLede>
              Discovery produces working documents leadership and delivery can share — not a slide deck that disappears after kickoff.
            </SectionLede>
          </AnimateIn>
          <StaggerIn className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-b1 bg-b1 sm:grid-cols-2 xl:grid-cols-3">
            {requirementsOutputs.map((item) => (
              <article key={item.title} className="bg-bg p-6">
                <h3 className="font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </StaggerIn>
        </div>
      </section>

      <section aria-labelledby="delivery-architecture" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Architecture</SectionEyebrow>
            <SectionHeading id="delivery-architecture">Chosen for the operating environment — not a forced stack.</SectionHeading>
            <SectionLede>
              Architecture follows users, integrations, offline needs, identity constraints and operational ownership. We do not force every project onto the same template.
            </SectionLede>
          </AnimateIn>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {architectureDomains.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-bg p-5">
                <h3 className="font-syne text-base font-bold">{item.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="delivery-testing" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[.75fr_1.25fr]">
          <AnimateIn>
            <SectionEyebrow>Testing and validation</SectionEyebrow>
            <SectionHeading id="delivery-testing">Prove behaviour before asking for acceptance.</SectionHeading>
            <SectionLede>
              Testing depth follows risk. Critical workflows, permissions and migrations are not left to hope.
            </SectionLede>
          </AnimateIn>
          <div className="grid gap-3 sm:grid-cols-2">
            {testingTypes.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-s1 p-5">
                <h3 className="font-syne text-base font-bold">{item.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="delivery-uat" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>UAT</SectionEyebrow>
            <SectionHeading id="delivery-uat">Client acceptance before production rollout.</SectionHeading>
            <SectionLede>
              User acceptance testing is the deliberate gate between a built system and a live operational change.
            </SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {uatPoints.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-bg p-6">
                <h3 className="font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="delivery-change-control" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
          <AnimateIn>
            <SectionEyebrow>Change control</SectionEyebrow>
            <SectionHeading id="delivery-change-control">Scope changes are decisions — not silent drift.</SectionHeading>
            <SectionLede>
              After scope is agreed, significant new work is documented, assessed and estimated rather than absorbed into the original commitment.
            </SectionLede>
          </AnimateIn>
          <div className="grid gap-3">
            {changeControlPoints.map((item, index) => (
              <div key={item.title} className="flex gap-4 border-t border-b1 py-5 first:border-t-0 first:pt-0">
                <GitBranch size={16} className="mt-1 shrink-0 text-acc" aria-hidden="true" />
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

      <section aria-labelledby="delivery-release" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Rollback / release management</SectionEyebrow>
            <SectionHeading id="delivery-release">Versioned releases with a path back.</SectionHeading>
            <SectionLede>
              Production change is controlled: identifiable versions, protected deployment, rollback capability and separated environments.
            </SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {releaseManagementPoints.map((item) => (
              <article key={item.title} className="enterprise-panel rounded-2xl border border-b1 bg-bg p-6">
                <Shield size={16} className="text-acc" aria-hidden="true" />
                <h3 className="mt-4 font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="delivery-documentation" className="px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Documentation</SectionEyebrow>
            <SectionHeading id="delivery-documentation">Handover materials that match the system that shipped.</SectionHeading>
            <SectionLede>
              Documentation is proportionate to the engagement and delivered around the artefacts operators actually need.
            </SectionLede>
          </AnimateIn>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documentationOutputs.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-2xl border border-b1 bg-s1 px-5 py-4 font-dm text-sm text-t1">
                <CheckCircle2 size={15} className="shrink-0 text-acc" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="delivery-support" className="border-y border-b1 bg-s1 px-6 py-20 md:px-12 md:py-24">
        <div className="mx-auto max-w-[1240px]">
          <AnimateIn>
            <SectionEyebrow>Support</SectionEyebrow>
            <SectionHeading id="delivery-support">Maintenance is not unlimited development.</SectionHeading>
            <SectionLede>
              After rollout, the commercial boundary matters. Support keeps the agreed system healthy; new capability is scoped as enhancement or a new project.
            </SectionLede>
          </AnimateIn>
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {supportModels.map((item) => (
              <article key={item.title} className="rounded-2xl border border-b1 bg-bg p-6">
                <h3 className="font-syne text-lg font-bold">{item.title}</h3>
                <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ContextualFaqs
        id="delivery-faqs"
        eyebrow="Delivery questions"
        title="How structured engagement actually works."
        intro="Discovery first, staged risk reduction, explicit change control and support boundaries."
        items={enterpriseDeliveryFaqs}
        hubHash="custom-development"
        className="border-t border-b1 bg-bg"
      />

      <section
        id={ENTERPRISE_DELIVERY_CTA_ANCHOR}
        aria-labelledby="delivery-cta"
        className="relative overflow-hidden border-t border-b1 px-6 py-20 md:px-12 md:py-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(232,160,69,0.11), transparent 55%)" }}
        />
        <div className="relative mx-auto max-w-[1240px]">
          <div className="enterprise-panel rounded-[1.5rem] border border-acc/25 bg-s1 p-7 md:p-10 lg:grid lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:gap-10">
            <div>
              <SectionEyebrow>Start with discovery</SectionEyebrow>
              <h2 id="delivery-cta" className="mt-3 font-syne text-[clamp(28px,4.2vw,44px)] font-extrabold tracking-[-.03em]">
                Begin with the operating problem — not a premature build.
              </h2>
              <p className="mt-5 max-w-[640px] font-dm text-sm leading-relaxed text-t2">
                Tell us about the current systems, workflows and constraints. Discovery determines whether the right next step is a prototype, a scoped MVP or a clearer architecture decision.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 lg:mt-0">
              <Link href={enterpriseDeliveryCopy.enquiryCta.href} prefetch={false} className="btn-primary justify-center font-dm">
                {enterpriseDeliveryCopy.enquiryCta.label}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href={enterpriseDeliveryCopy.secondaryCta.href} prefetch={false} className="btn-ghost justify-center font-dm">
                {enterpriseDeliveryCopy.secondaryCta.label}
              </Link>
              <Link href="/enterprise" prefetch={false} className="btn-ghost justify-center font-dm">
                Back to enterprise systems
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
