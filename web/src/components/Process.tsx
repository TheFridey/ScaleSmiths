import { Target, Code2, TrendingUp } from "lucide-react"
import { AnimateIn, StaggerIn } from "./AnimateIn"

const steps = [
  {
    n: "01", title: "Strategy Call",
    desc: "We understand your business first — your goals, constraints, and market. Not just your brief.",
    Icon: Target,
  },
  {
    n: "02", title: "Build & Forge",
    desc: "Your site, system or platform built to spec, on time. Full transparency via your client portal throughout.",
    Icon: Code2,
  },
  {
    n: "03", title: "Launch & Scale",
    desc: "Deploy. Monitor. Iterate. Most clients convert to a retainer here — because the real work is just beginning.",
    Icon: TrendingUp,
  },
]

export function Process() {
  return (
    <section
      aria-label="Our process"
      className="bg-s1 border-y border-b1 px-6 md:px-12 py-20"
    >
      <div className="max-w-[1100px] mx-auto">
        <AnimateIn className="text-center mb-14">
          <span className="font-dm text-xs text-acc tracking-[.14em] font-semibold uppercase">
            How It Works
          </span>
          <h2 className="font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em] mt-2">
            Three steps to launch.
          </h2>
        </AnimateIn>
        <StaggerIn className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.n} className="text-center px-4">
              <div className="font-dm text-[11px] text-t3 tracking-[.14em] mb-4" aria-hidden="true">
                STEP {step.n}
              </div>
              <div
                className="w-[52px] h-[52px] bg-s2 border border-b2 rounded-[14px] flex items-center justify-center mx-auto mb-5"
                aria-hidden="true"
              >
                <step.Icon size={22} className="text-acc" />
              </div>
              <h3 className="font-syne text-xl font-bold mb-2.5">{step.title}</h3>
              <p className="font-dm text-sm text-t2 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </StaggerIn>
      </div>
    </section>
  )
}
