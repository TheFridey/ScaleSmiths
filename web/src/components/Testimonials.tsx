import { AnimateIn } from "./AnimateIn"

export interface VerifiedTestimonial {
  id: string
  quote: string
  name: string
  business: string
}

/** Editorial quote treatment on paper — only renders verified attributed claims. */
export function Testimonials({ testimonials }: { testimonials: VerifiedTestimonial[] }) {
  if (testimonials.length === 0) return null
  return (
    <section aria-label="Client testimonials" className="surface-paper border-y border-paper-border px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="mb-14 max-w-[640px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-paper-acc">
            From clients
          </span>
          <h2 className="mt-2 font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-0.025em] text-paper-ink">
            Words from people who trusted us with the work.
          </h2>
        </AnimateIn>
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {testimonials.map((t) => (
            <blockquote key={t.id} className="m-0 border-l-2 border-paper-acc/50 pl-5 md:pl-6">
              <p className="font-syne text-[clamp(18px,2vw,22px)] font-semibold leading-snug tracking-[-0.015em] text-paper-ink">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="mt-6">
                <div className="font-syne text-sm font-bold text-paper-ink">{t.name}</div>
                <div className="mt-0.5 font-dm text-xs text-paper-muted">{t.business}</div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
