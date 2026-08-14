"use client"

import { useRef } from "react"
import { m, useReducedMotion, useScroll, useTransform } from "motion/react"
import { Code2, Rocket, Target, TrendingUp } from "lucide-react"
import { AnimateIn } from "./AnimateIn"

const steps = [
  {
    n: "01", label: "Strategy", title: "Strategy Call",
    desc: "We understand your business first—your goals, constraints, and market. Not just your brief.", Icon: Target,
  },
  {
    n: "02", label: "Build", title: "Build & Forge",
    desc: "Your site, system or platform is built to the agreed scope, with delivery progress visible through the client portal.", Icon: Code2,
  },
  {
    n: "03", label: "Launch", title: "Launch",
    desc: "We deploy deliberately, verify the production system and make the handover operational rather than ceremonial.", Icon: Rocket,
  },
  {
    n: "04", label: "Scale", title: "Scale",
    desc: "Monitor and iterate. Ongoing support is optional and scoped around the work the business needs after launch.", Icon: TrendingUp,
  },
]

export function Process({ verifiedDeliveryClaim, verifiedRetentionClaim }: { verifiedDeliveryClaim?: string; verifiedRetentionClaim?: string }) {
  const sectionRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 70%", "end 65%"] })
  const pathScale = useTransform(scrollYProgress, [0, 1], [0, 1])
  const publicSteps = steps.map((step) => step.n === "04"
    ? { ...step, desc: verifiedRetentionClaim ?? step.desc }
    : step.n === "02"
      ? { ...step, desc: verifiedDeliveryClaim ?? step.desc }
      : step)

  return (
    <section ref={sectionRef} aria-label="Our process" className="relative overflow-hidden bg-s1 px-6 py-28 md:px-12 md:py-36">
      <div className="mx-auto max-w-[1240px] lg:grid lg:grid-cols-[.72fr_1.28fr] lg:gap-24">
        <AnimateIn className="mb-16 lg:sticky lg:top-32 lg:mb-0 lg:h-fit">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">How it works</span>
          <h2 className="mt-3 font-syne text-[clamp(38px,6vw,72px)] font-extrabold leading-[.94] tracking-[-.04em]">
            From intent<br />to infrastructure.
          </h2>
          <p className="mt-6 max-w-[420px] font-dm text-base leading-relaxed text-t2">
            One accountable path from commercial strategy through launch and managed improvement.
          </p>
          <div className="mt-10 hidden font-dm text-[10px] font-semibold uppercase tracking-[.18em] text-t3 lg:block">
            Strategy → Build → Launch → Scale
          </div>
        </AnimateIn>

        <div className="relative pl-10 md:pl-16">
          <div className="absolute bottom-12 left-[7px] top-12 w-px bg-b2 md:left-[15px]" aria-hidden="true" />
          <m.div
            className="absolute bottom-12 left-[7px] top-12 w-px origin-top bg-acc md:left-[15px]"
            style={{ scaleY: reducedMotion ? 1 : pathScale }}
            aria-hidden="true"
          />
          {publicSteps.map((step) => (
            <m.article
              key={step.n}
              className="group relative flex min-h-[260px] flex-col justify-center border-b border-b1 py-12 last:border-0 md:min-h-[300px]"
              initial={reducedMotion ? false : { opacity: 0.56 }}
              whileInView={{ opacity: 1 }}
              viewport={{ amount: 0.55 }}
              transition={{ duration: reducedMotion ? 0 : 0.32 }}
            >
              <div className="absolute -left-[40px] flex h-4 w-4 items-center justify-center rounded-full border border-b2 bg-s1 transition-colors group-hover:border-acc group-hover:bg-acc/15 md:-left-[56px] md:h-8 md:w-8">
                <span className="h-1.5 w-1.5 rounded-full bg-acc" aria-hidden="true" />
              </div>
              <div className="flex items-center gap-3 text-acc">
                <step.Icon size={16} aria-hidden="true" />
                <span className="font-dm text-[10px] font-semibold uppercase tracking-[.2em]">{step.n} / {step.label}</span>
              </div>
              <h3 className="mt-4 font-syne text-[clamp(28px,4vw,48px)] font-bold tracking-[-.03em]">{step.title}</h3>
              <p className="mt-4 max-w-[620px] font-dm text-[15px] leading-[1.8] text-t2">{step.desc}</p>
            </m.article>
          ))}
        </div>
      </div>
    </section>
  )
}
