import { ArrowRight } from "lucide-react"
import { AnimateIn } from "./AnimateIn"
import { Logo } from "./Logo"
import { MagneticLink } from "./MagneticLink"

export function CTA() {
  return (
    <section aria-label="Call to action" className="px-6 md:px-12 py-24">
      <AnimateIn className="max-w-[760px] mx-auto text-center bg-gradient-to-br from-s2 to-acc/5 border border-acc/20 rounded-3xl px-8 md:px-16 py-[72px]">
        <div className="float-anim inline-block mb-7" aria-hidden="true">
          <Logo size={44} showName={false} href="" />
        </div>
        <h2 className="font-syne text-[clamp(28px,4.5vw,48px)] font-extrabold tracking-[-0.025em] mb-4">
          Ready to build something<br />that actually scales?
        </h2>
        <p className="font-dm text-base text-t2 leading-relaxed mb-10 max-w-[420px] mx-auto">
          Tell us about your business and we&apos;ll tell you exactly what you need to grow.
          No pitch. No pressure. Just honest advice.
        </p>
        <MagneticLink href="/quote?intent=strategy_call" className="btn-primary group font-dm inline-flex">
          Request a Strategy Call <ArrowRight size={16} aria-hidden="true" />
        </MagneticLink>
      </AnimateIn>
    </section>
  )
}
