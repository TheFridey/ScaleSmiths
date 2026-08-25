import { CheckCircle2, XCircle } from "lucide-react"
import { AnimateIn } from "./AnimateIn"

const FOR = [
  "Founder-led businesses that need digital to drive enquiries, sales, or operational leverage.",
  "Teams with enough traction to invest properly in custom design, engineering, and long-term upkeep.",
  "Clients who want direct technical partnership, clear communication, and honest trade-offs.",
]

const NOT_FOR = [
  "One-page brochure sites where the lowest upfront price is the main decision.",
  "Projects that need to be copied from a competitor without a strategy or differentiation.",
  "Builds with no owner, no decision-maker or no appetite for ongoing improvement.",
]

export function FitSection() {
  return (
    <section aria-label="Who ScaleSmiths is for" className="px-6 md:px-12 py-20">
      <div className="mx-auto grid max-w-[1240px] gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <AnimateIn>
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Fit</span>
          <h2 className="mt-2 font-syne text-[clamp(30px,5vw,52px)] font-extrabold tracking-[-0.025em]">
            Who this is for, and who it is not for.
          </h2>
          <p className="mt-4 max-w-[520px] font-dm text-base leading-relaxed text-t2">
            The best work happens when the ambition, budget, and operating style match. This is how we qualify projects before either side wastes time.
          </p>
        </AnimateIn>

        <AnimateIn delay={0.1} className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-acc/20 bg-acc/10 p-6">
            <h3 className="font-syne text-xl font-bold">Who this is for</h3>
            <ul className="mt-5 flex flex-col gap-4">
              {FOR.map((item) => (
                <li key={item} className="flex gap-2.5 font-dm text-sm leading-relaxed text-t1">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-grn" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-b1 bg-s1 p-6">
            <h3 className="font-syne text-xl font-bold">Who this is not for</h3>
            <ul className="mt-5 flex flex-col gap-4">
              {NOT_FOR.map((item) => (
                <li key={item} className="flex gap-2.5 font-dm text-sm leading-relaxed text-t2">
                  <XCircle size={15} className="mt-0.5 shrink-0 text-red" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </AnimateIn>
      </div>
    </section>
  )
}
