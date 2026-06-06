"use client"
import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { AnimateIn } from "./AnimateIn"
import { faqs } from "@/lib/data"

export function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
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
          {faqs.map((faq, i) => (
            <div key={i} className={i < faqs.length - 1 ? "border-b border-b1" : ""}>
              <button
                className="faq-btn w-full text-left px-7 py-[22px] flex justify-between items-center gap-4 rounded-none transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="font-syne text-base font-bold text-t1">{faq.q}</span>
                <ChevronRight
                  size={18}
                  className="text-t2 shrink-0 transition-transform duration-200"
                  style={{ transform: open === i ? "rotate(90deg)" : "none" }}
                  aria-hidden="true"
                />
              </button>
              {open === i && (
                <div className="px-7 pb-[22px] font-dm text-sm text-t2 leading-[1.78]">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </AnimateIn>
      </div>
    </section>
  )
}
