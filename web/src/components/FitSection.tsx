import { CheckCircle2, XCircle } from "lucide-react"
import { AnimateIn } from "./AnimateIn"

const FOR = [
  "Local businesses that want a clear scope, a straightforward explanation, and a responsible place to start.",
  "Growing companies that need better enquiries, less wasted admin, and a partner who stays with the work.",
  "Established organisations that want direct contact with the people who will design and deliver the system.",
]

const NOT_FOR = [
  "Projects where the only question is the lowest possible price, with no interest in scope or what happens after launch.",
  "Work that needs to be copied from a competitor without a reason of its own.",
  "Builds with no owner, no decision-maker, or no appetite for the decisions a project requires.",
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
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
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
                  <XCircle size={15} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
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
