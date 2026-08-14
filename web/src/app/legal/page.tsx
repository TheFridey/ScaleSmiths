import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { legalPolicies } from "@/lib/legal-policies"
import type { LegalSlug } from "@/lib/legal"

export const metadata: Metadata = { title: "Legal & Policies", description: "The terms, policies and operating standards governing ScaleSmiths services.", alternates: { canonical: "/legal" } }
const groups: Array<{ title: string; slugs: LegalSlug[] }> = [
  { title: "General", slugs: ["website-terms", "service-terms", "privacy", "cookies"] },
  { title: "Service policies", slugs: ["hosting-terms", "email-terms", "domain-dns-terms", "acceptable-use", "fair-use"] },
  { title: "Data & security", slugs: ["data-processing", "subprocessors", "security", "accessibility"] },
  { title: "Customer support", slugs: ["cancellations", "complaints"] },
]
export default function LegalHubPage() { return <main className="px-6 py-20 md:px-12 md:py-28"><div className="mx-auto max-w-[1100px]"><header className="max-w-[780px]"><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Legal & policies</p><h1 className="mt-3 font-syne text-[clamp(42px,7vw,78px)] font-extrabold leading-none">Clear terms for a managed relationship.</h1><p className="mt-6 text-lg leading-relaxed text-t2">The terms, policies and operating standards governing ScaleSmiths services. Commercial details in a signed proposal or order take precedence where stated.</p></header><div className="mt-14 grid gap-10 md:grid-cols-2">{groups.map((group) => <section key={group.title}><h2 className="border-b border-b1 pb-3 text-xs font-semibold uppercase tracking-[.14em] text-acc">{group.title}</h2><div className="divide-y divide-b1">{group.slugs.map((slug) => <Link key={slug} href={`/legal/${slug}`} className="group flex items-center justify-between gap-4 py-5"><span className="font-syne text-lg font-bold">{legalPolicies[slug].title}</span><ArrowRight size={16} className="text-t3 transition-transform group-hover:translate-x-1" /></Link>)}</div></section>)}</div></div></main> }
