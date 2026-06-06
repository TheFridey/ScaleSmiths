import Link from "next/link"
import { ArrowRight } from "lucide-react"

interface InlineCTAProps {
  label: string
  title: string
  body: string
}

export function InlineCTA({ label, title, body }: InlineCTAProps) {
  return (
    <section aria-label={label} className="px-6 md:px-12 py-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-5 border-y border-b1 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{label}</div>
          <h2 className="mt-2 font-syne text-[clamp(24px,3.4vw,36px)] font-extrabold tracking-[-0.025em]">{title}</h2>
          <p className="mt-2 max-w-[620px] font-dm text-sm leading-relaxed text-t2">{body}</p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link href="/quote" prefetch={false} className="btn-primary font-dm text-sm">
            Request a Quote <ArrowRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/quote" prefetch={false} className="btn-ghost font-dm text-sm">
            Book a Discovery Call
          </Link>
          <Link href="/services" prefetch={false} className="btn-ghost font-dm text-sm">
            View Services
          </Link>
        </div>
      </div>
    </section>
  )
}
