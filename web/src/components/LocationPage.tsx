import Link from "next/link"
import { ArrowRight, MapPin } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { JsonLd } from "@/components/JsonLd"
import { ContextualFaqs } from "@/components/faq/ContextualFaqs"
import { contextualFaqs } from "@/lib/faq-knowledge-base"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import type { LocationPageData } from "@/lib/location-pages"
import { siteBaseUrl } from "@/lib/site-identity"
import { buildBreadcrumbSchema, buildFaqSchema, buildWebPageSchema } from "@/lib/structured-data"

export function LocationPage({ page }: { page: LocationPageData }) {
  const base = siteBaseUrl()
  const path = `/locations/${page.slug}`
  const proof = caseStudiesForSlugs(page.proofLinks)
  return <>
    <JsonLd data={[
      buildWebPageSchema(base, { name: page.metaTitle, description: page.description, path }),
      { "@context": "https://schema.org", "@type": "Service", name: `ScaleSmiths services in ${page.title}`, serviceType: ["Web design", "Web development", "Technical SEO"], provider: { "@id": `${base}/#org` }, areaServed: page.title, url: `${base}${path}` },
      buildFaqSchema(page.faqs),
      buildBreadcrumbSchema(base, [{ name: "Home", path: "/" }, { name: "Locations", path: "/locations" }, { name: page.title, path }]),
    ]} />
    <main>
      <header className="px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14"><div className="mx-auto max-w-[1240px]"><Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Locations", href: "/locations" }, { name: page.title }]} /><div className="mt-10 max-w-[900px]"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-acc"><MapPin size={14} aria-hidden="true" />{page.eyebrow}</p><h1 className="mt-3 font-syne text-[clamp(40px,7vw,78px)] font-black leading-[1.02] tracking-[-.04em]">{page.h1}</h1><p className="mt-6 max-w-[760px] text-lg leading-relaxed text-t2">{page.intro}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/quote" prefetch={false} className="btn-primary">Discuss a project <ArrowRight size={16} aria-hidden="true" /></Link><Link href="/work" prefetch={false} className="btn-ghost">View nearby work</Link></div></div></div></header>
      <section aria-label={`${page.title} services`} className="border-y border-b1 bg-s1/40 px-6 py-20 md:px-12"><div className="mx-auto max-w-[1240px]"><h2 className="font-syne text-[clamp(30px,4vw,46px)] font-extrabold">Services available in {page.title}</h2><div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{page.services.map((service) => <Link key={service.href} href={service.href} prefetch={false} className="group rounded-2xl border border-b1 bg-s1 p-6 transition-colors hover:border-b2"><h3 className="font-syne text-xl font-bold">{service.title}</h3><p className="mt-3 text-sm leading-relaxed text-t2">{service.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-acc">Explore service <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-1" /></span></Link>)}</div></div></section>
      <section className="px-6 py-20 md:px-12"><div className="mx-auto grid max-w-[1240px] gap-5 lg:grid-cols-2">{page.sections.map((section) => <article key={section.title} className="rounded-3xl border border-b1 bg-s1 p-7 md:p-9"><h2 className="font-syne text-2xl font-bold">{section.title}</h2><div className="mt-5 space-y-4">{section.paragraphs.map((paragraph) => <p key={paragraph} className="text-sm leading-[1.8] text-t2">{paragraph}</p>)}</div></article>)}</div></section>
      <section aria-labelledby={`${page.slug}-proof`} className="px-6 py-20 md:px-12"><div className="mx-auto max-w-[1240px]"><h2 id={`${page.slug}-proof`} className="font-syne text-[clamp(30px,4vw,46px)] font-extrabold">Relevant work in and around Nottinghamshire</h2><div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{proof.map((study) => <ProjectCard key={study.slug} study={study} size="compact" />)}</div></div></section>
      <ContextualFaqs
        id={`${page.slug}-faqs`}
        eyebrow={`${page.title} questions`}
        title="Questions about working locally"
        intro={`What ${page.title} businesses ask before starting, plus the answers that apply wherever you are.`}
        items={[...page.faqs, ...contextualFaqs(page.faqLibrary)]}
        hubHash="web-design"
      />
    </main>
  </>
}
