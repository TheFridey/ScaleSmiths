import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, CheckCircle2, FileText, Search, Wrench } from "lucide-react"
import { quoteThanksMetadata } from "./metadata"

export const metadata: Metadata = quoteThanksMetadata

export default function QuoteThanksPage() {
  return (
    <section className="px-6 py-20 md:px-12">
      <div className="mx-auto max-w-[900px] text-center">
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-acc/20 bg-acc/10">
          <CheckCircle2 size={28} className="text-acc" aria-hidden="true" />
        </div>
        <h1 className="font-syne text-[clamp(36px,6vw,64px)] font-extrabold leading-none tracking-[-0.03em]">
          Brief received.
        </h1>
        <p className="mx-auto mt-5 max-w-[620px] font-dm text-base leading-relaxed text-t2">
          We will review the scope, budget, timing, and commercial goal before replying. Expect a response within one working day.
        </p>

        <div className="mt-10 grid gap-3 text-left md:grid-cols-3">
          {[
            { Icon: Search, title: "Fit check", copy: "We check whether ScaleSmiths is the right partner for the outcome." },
            { Icon: FileText, title: "Prepare", copy: "Useful prep: current site access, analytics, brand assets, and examples you like or dislike." },
            { Icon: Wrench, title: "Next step", copy: "If there is a fit, we suggest a discovery call and a sensible first scope." },
          ].map(({ Icon, title, copy }) => (
            <div key={title} className="rounded-2xl border border-b1 bg-s1 p-5">
              <Icon size={17} className="mb-4 text-acc" aria-hidden="true" />
              <h2 className="font-syne text-lg font-bold">{title}</h2>
              <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/services" prefetch={false} className="btn-primary font-dm">
            View Services <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/work" prefetch={false} className="btn-ghost font-dm">
            View Work / Build Logs
          </Link>
        </div>
      </div>
    </section>
  )
}
