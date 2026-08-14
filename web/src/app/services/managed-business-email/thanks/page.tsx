import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"

export const metadata: Metadata = { title: "Email Enquiry Received", robots: { index: false, follow: false } }
export default function BusinessEmailThanksPage() { return <main className="px-6 py-24 md:px-12"><div className="mx-auto max-w-[720px] text-center"><CheckCircle2 size={44} className="mx-auto text-acc" aria-hidden="true" /><h1 className="mt-6 font-syne text-5xl font-extrabold">Your email enquiry is in.</h1><p className="mt-5 leading-relaxed text-t2">ScaleSmiths will review your domain, mailbox choices and migration requirements, then reply with the next onboarding step. Do not email domain or registrar passwords; appropriate access will be arranged separately.</p><div className="mt-8 flex justify-center gap-3"><Link href="/services/managed-business-email" className="btn-primary">Review the service</Link><Link href="/" className="btn-ghost">Return home</Link></div></div></main> }
