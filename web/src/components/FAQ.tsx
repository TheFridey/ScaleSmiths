"use client"
import { useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { AnimateIn } from "./AnimateIn"

export function FAQ({ items }: { items: Array<{ q: string; a: string }> }) {
  const [open, setOpen] = useState<number | null>(null)
  const reducedMotion = useReducedMotion()
  return (
    <section aria-label="Frequently asked questions" className="px-6 md:px-12 py-20">
      <div className="max-w-[1240px] mx-auto">
        <AnimateIn className="mb-10">
          <span className="font-dm text-xs text-acc tracking-[.14em] font-semibold uppercase">FAQ</span>
          <h2 className="font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em] mt-2">
            Common questions.
          </h2>
        </AnimateIn>
        <AnimateIn delay={0.1} className="bg-s1 border border-b1 rounded-2xl overflow-hidden">
          {items.map((faq, i) => (
            <div key={faq.q} className={i < items.length - 1 ? "border-b border-b1" : ""}>
              <button
                id={`faq-trigger-${i}`}
                className="faq-btn w-full text-left px-7 py-[22px] flex justify-between items-center gap-4 rounded-none transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                aria-controls={`faq-panel-${i}`}
              >
                <span className="font-syne text-base font-bold text-t1">{faq.q}</span>
                <span className="relative h-4 w-4 shrink-0 text-t2" aria-hidden="true">
                  <span className="absolute left-0 top-[7px] h-px w-4 bg-current" />
                  <m.span className="absolute left-[7px] top-0 h-4 w-px bg-current" animate={{ scaleY: open === i ? 0 : 1, opacity: open === i ? 0 : 1 }} transition={{ duration: reducedMotion ? 0 : 0.16 }} />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <m.div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reducedMotion ? 0 : 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="px-7 pb-[22px] font-dm text-sm text-t2 leading-[1.78]">{faq.a}</div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </AnimateIn>
      </div>
    </section>
  )
}
