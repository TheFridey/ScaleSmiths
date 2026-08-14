import { Star } from "lucide-react"
import { AnimateIn } from "./AnimateIn"

export interface VerifiedTestimonial {
  id: string
  quote: string
  name: string
  business: string
}

export function Testimonials({ testimonials }: { testimonials: VerifiedTestimonial[] }) {
  if (testimonials.length === 0) return null
  return (
    <section aria-label="Client testimonials" className="px-6 md:px-12 py-20">
      <div className="max-w-[1240px] mx-auto">
        <AnimateIn className="text-center mb-12">
          <span className="font-dm text-xs text-acc tracking-[.14em] font-semibold uppercase">Results</span>
          <h2 className="font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em] mt-2">
            What clients say.
          </h2>
        </AnimateIn>
        <div className="grid gap-3 md:grid-cols-3">
          {testimonials.map((t) => (
            <blockquote
              key={t.id}
              className="bg-s1 border border-b1 rounded-2xl p-7 m-0"
            >
              <div className="flex gap-0.5 mb-5" aria-label="5 stars">
                {[...Array(5)].map((_, j) => (
                  <Star key={j} size={13} fill="#f59e0b" className="text-warning" aria-hidden="true" />
                ))}
              </div>
              <p className="font-dm text-[15px] text-t1 leading-[1.72] mb-5 italic">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer>
                <div className="font-syne text-sm font-bold">{t.name}</div>
                <div className="font-dm text-xs text-t2 mt-0.5">{t.business}</div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
