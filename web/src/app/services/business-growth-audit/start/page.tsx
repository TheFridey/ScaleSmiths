import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BusinessGrowthAuditForm } from "@/components/BusinessGrowthAuditForm"
import { businessGrowthAudit, formatAuditPrice } from "@/lib/business-growth-audit"
export const metadata: Metadata = { title: "Start a Business Growth Audit", description: "Tell ScaleSmiths about the business, customer journey, systems and growth priorities.", robots: { index: false, follow: true } }
export default function StartAuditPage() { return <main className="px-6 py-16 md:px-12"><div className="mx-auto max-w-[900px]"><Link href={businessGrowthAudit.slug} className="inline-flex items-center gap-2 text-sm text-t2"><ArrowLeft size={15} /> Business Growth Audit</Link><header className="mt-8 border-b border-b1 pb-8"><p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Audit intake</p><h1 className="mt-3 font-syne text-[clamp(40px,6vw,68px)] font-extrabold leading-none">Tell us where the business stands.</h1><p className="mt-5 max-w-[720px] leading-relaxed text-t2">This focused questionnaire gives ScaleSmiths enough context to confirm the one-time {formatAuditPrice()} engagement and plan the investigation. No card payment is taken here.</p></header><div className="mt-10"><BusinessGrowthAuditForm /></div></div></main> }
