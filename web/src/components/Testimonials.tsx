import { AnimateIn } from "./AnimateIn"
import { PaperBand } from "./PaperBand"

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
    <PaperBand aria-label="Client testimonials" className="py-16 md:py-24">
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="mb-10 max-w-[36rem] md:mb-12">
          <span className="paper-label">From clients</span>
          <h2 className="paper-display mt-3">
            Words from people who trusted us with the work.
          </h2>
        </AnimateIn>
        <div className="grid gap-8 border-t border-paper-border pt-8 md:grid-cols-3 md:gap-10">
          {testimonials.map((t) => (
            <blockquote key={t.id} className="m-0 border-l-2 border-paper-acc/40 pl-5 md:pl-6">
              <p className="font-syne text-[clamp(1.05rem,1.6vw,1.25rem)] font-semibold leading-[1.35] tracking-[-0.015em] text-paper-ink">
                &ldquo;{t.quote}&rdquo;
              </p>
              <footer className="mt-5">
                <div className="font-syne text-sm font-bold tracking-[-0.01em] text-paper-ink">{t.name}</div>
                <div className="mt-1 font-dm text-xs leading-snug text-paper-muted">{t.business}</div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </PaperBand>
  )
}
