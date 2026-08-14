import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { BusinessEmailEnquiryForm } from "@/components/BusinessEmailEnquiryForm"
import { managedBusinessEmail, managedBusinessEmailPriceLabel } from "@/lib/managed-business-email"

export const metadata: Metadata = { title: "Set Up Managed Business Email", description: "Tell ScaleSmiths which domain and three professional mailboxes you need.", robots: { index: false, follow: true } }

export default function BusinessEmailGetStartedPage() {
  return <main className="px-6 py-16 md:px-12 md:py-20"><div className="mx-auto max-w-[900px]"><Link href={managedBusinessEmail.slug} className="inline-flex items-center gap-2 text-sm text-t2 hover:text-t1"><ArrowLeft size={15} /> Managed Business Email</Link><div className="mt-8 border-b border-b1 pb-8"><span className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Lightweight onboarding</span><h1 className="mt-3 font-syne text-[clamp(38px,6vw,64px)] font-extrabold leading-none">Set up your business email.</h1><p className="mt-5 max-w-[680px] text-base leading-relaxed text-t2">The starting service is {managedBusinessEmailPriceLabel()}: three professional mailboxes with {managedBusinessEmail.standalone.storagePerMailboxGb}GB each and initial setup included. We will confirm billing cadence and any migration scope before onboarding.</p></div><div className="mt-10"><BusinessEmailEnquiryForm /></div></div></main>
}
