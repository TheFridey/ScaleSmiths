import Link from "next/link"

const DEFAULT_STATEMENTS = ["Find the constraint", "Engineer the solution", "Keep improving"] as const

const OFFERS = [
  { label: "Business Growth Audit", href: "/services/business-growth-audit" },
  { label: "Websites that convert", href: "/local-growth" },
  { label: "Custom systems", href: "/custom-systems" },
  { label: "Digital Growth Partnership", href: "/digital-growth-partnership" },
] as const

/**
 * Lives below the hero so the first viewport stays lean: offer labels and
 * verified (or approach) statements without competing with the headline.
 */
export function HeroApproachBand({ verifiedStats = [] }: { verifiedStats?: string[] }) {
  const statements = verifiedStats.length > 0 ? verifiedStats : [...DEFAULT_STATEMENTS]
  const caption = verifiedStats.length > 0 ? "Verified public claim" : "ScaleSmiths approach"

  return (
    <section aria-label="How ScaleSmiths works" className="border-b border-b1 bg-s1/40 px-6 py-14 md:px-12 md:py-20">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-20">
        <ul className="flex max-w-[38rem] flex-wrap gap-x-1 gap-y-4" aria-label="ScaleSmiths core offers">
          {OFFERS.map((offer) => (
            <li key={offer.href} className="pr-6">
              <Link
                href={offer.href}
                prefetch={false}
                className="border-l border-b2 pl-4 font-dm text-[13px] font-medium leading-snug tracking-[0.01em] text-t2 transition-colors hover:text-t1"
              >
                {offer.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="grid gap-8 sm:grid-cols-3 sm:gap-10" aria-label={caption}>
          {statements.map((statement) => (
            <li key={statement} className="max-w-[14rem]">
              <p className="font-syne text-[1.0625rem] font-semibold leading-[1.35] tracking-[-0.008em] text-t1 md:text-[1.125rem]">
                {statement}
              </p>
              <p className="mt-2.5 font-dm text-xs leading-snug tracking-[0.03em] text-t3">{caption}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
