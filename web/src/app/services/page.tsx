import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Mail, ServerCog, Wrench } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { CTA } from "@/components/CTA"
import { ServiceRouteChooser } from "@/components/ServiceRouteChooser"
import { buildServiceHubSchema, serviceHubItems } from "@/lib/service-pages"

export const metadata: Metadata = {
  title: "Services",
  description: "Conversion websites, custom systems, managed business email, care plans, hosting, maintenance and digital infrastructure.",
  alternates: { canonical: "/services" },
}

export default function ServicesPage() {
  const schema = buildServiceHubSchema(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk")

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <section className="mx-auto max-w-[1240px] px-6 py-20 md:px-12">
        <AnimateIn className="max-w-[760px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Services</span>
          <h1 className="mt-2 font-syne text-[clamp(38px,7vw,76px)] font-extrabold leading-none tracking-[-0.03em]">
            Commercial web builds, not template theatre.
          </h1>
          <p className="mt-5 font-dm text-lg leading-relaxed text-t2">
            Choose between a local growth journey and a custom systems journey, then explore the detailed capabilities that support it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/local-growth" prefetch={false} className="btn-primary font-dm">Explore Local Growth <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/custom-systems" prefetch={false} className="btn-ghost font-dm">Explore Custom Systems</Link>
            <Link href="/pricing" prefetch={false} className="btn-ghost font-dm">View Pricing Guidance</Link>
          </div>
        </AnimateIn>
      </section>

      <ServiceRouteChooser />

      <section className="px-6 pb-20 md:px-12">
        <div className="mx-auto max-w-[1240px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Detailed capabilities</span>
          <h2 className="mt-2 font-syne text-3xl font-extrabold">The work inside each route.</h2>
        </div>
        <div className="mx-auto mt-8 grid max-w-[1240px] gap-3 md:grid-cols-2">
          {serviceHubItems.map((service) => (
            <article key={service.title} className="rounded-2xl border border-b1 bg-s1 p-6">
              <h2 className="font-syne text-2xl font-bold">{service.title}</h2>
              <Link href={`/${service.journey}`} prefetch={false} className="mt-2 inline-flex font-dm text-xs font-semibold uppercase tracking-[.09em] text-acc">
                {service.journey.replace("-", " ")} route
              </Link>
              <div className="mt-5 grid gap-4">
                {[
                  ["Who it is for", service.for],
                  ["Included", service.includes],
                  ["Typical outcome", service.outcome],
                ].map(([label, copy]) => (
                  <div key={label} className="flex gap-3">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-grn" aria-hidden="true" />
                    <div>
                      <div className="font-dm text-[11px] font-semibold uppercase tracking-[.08em] text-t3">{label}</div>
                      <p className="mt-1 font-dm text-sm leading-relaxed text-t2">{copy}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href={service.journey === "local-growth" ? "/local-growth-check" : "/quote"} prefetch={false} className="btn-primary font-dm text-sm">
                  {service.journey === "local-growth" ? "Request a Local Growth Check" : "Start a Project Brief"}
                </Link>
                {service.links.map((href) => (
                  <Link key={href} href={href} prefetch={false} className="btn-ghost font-dm text-sm">{href.replace("/", "").replaceAll("-", " ")}</Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="managed-estate-services" className="px-6 pb-24 md:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-8 rounded-3xl bg-s1 p-7 md:p-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Managed infrastructure</span>
            <h2 id="managed-estate-services" className="mt-3 font-syne text-[clamp(30px,4vw,48px)] font-extrabold tracking-[-.03em]">One technical partner beyond launch.</h2>
            <p className="mt-4 font-dm text-sm leading-[1.8] text-t2">Hosting, maintenance and professional business email can sit inside the same deliberately scoped relationship as the systems ScaleSmiths builds.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: "Hosting", body: "Production deployment and infrastructure responsibility where agreed.", Icon: ServerCog },
              { title: "Maintenance", body: "Updates, monitoring and support around the managed system.", Icon: Wrench },
              { title: "Managed Business Email", body: "Professional custom-domain email from £15, available standalone or inside an agreed managed relationship.", Icon: Mail },
            ].map(({ title, body, Icon }) => (
              <article key={title} className="border-l border-b2 pl-5">
                <Icon size={17} className="text-acc" aria-hidden="true" />
                <h3 className="mt-4 font-syne text-base font-bold">{title}</h3>
                <p className="mt-2 font-dm text-xs leading-relaxed text-t2">{body}</p>
                {title === "Managed Business Email" && <Link href="/services/managed-business-email" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-acc">View email service <ArrowRight size={12} /></Link>}
              </article>
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </>
  )
}
