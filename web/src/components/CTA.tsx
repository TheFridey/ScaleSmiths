import { ArrowRight } from "lucide-react"
import { AnimateIn } from "./AnimateIn"
import { Logo } from "./Logo"
import { MagneticLink } from "./MagneticLink"

export function CTA() {
  return (
    <section aria-label="Call to action" className="px-6 py-28 md:px-12">
      <AnimateIn className="relative mx-auto max-w-[760px] overflow-hidden rounded-3xl border border-acc/28 bg-gradient-to-br from-s2 via-s1 to-acc/[.1] px-8 py-[72px] text-center shadow-[0_28px_90px_rgba(232,160,69,0.1)] md:px-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acc/55 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 left-1/2 h-48 w-[78%] -translate-x-1/2 rounded-full bg-acc/12 blur-3xl"
        />
        <div className="float-anim mb-8 inline-block" aria-hidden="true">
          <Logo size={52} showName={false} href="" />
        </div>
        <h2 className="mb-4 font-syne text-[clamp(28px,4.5vw,48px)] font-extrabold tracking-[-0.025em]">
          Ready to build something<br />that actually scales?
        </h2>
        <p className="mx-auto mb-10 max-w-[420px] font-dm text-base leading-relaxed text-t2">
          Tell us about your business and we&apos;ll tell you exactly what you need to grow.
          No pitch. No pressure. Just honest advice.
        </p>
        <MagneticLink href="/quote?intent=strategy_call" className="btn-primary group inline-flex font-dm">
          Request a Strategy Call <ArrowRight size={16} aria-hidden="true" />
        </MagneticLink>
      </AnimateIn>
    </section>
  )
}
