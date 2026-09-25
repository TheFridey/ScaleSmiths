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
    <section aria-label="How ScaleSmiths works" className="border-b border-b1 bg-s1/40 px-6 py-10 md:px-12 md:py-12">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <ul className="flex flex-wrap gap-x-6 gap-y-3" aria-label="ScaleSmiths core offers">
          {OFFERS.map((offer) => (
            <li key={offer.href}>
              <Link
                href={offer.href}
                prefetch={false}
                className="border-l border-b2 pl-3 font-dm text-[12px] font-medium tracking-[.02em] text-t2 transition-colors hover:text-t1"
              >
                {offer.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-x-10 gap-y-4" aria-label={caption}>
          {statements.map((statement) => (
            <li key={statement} className="max-w-[200px]">
              <p className="font-syne text-[17px] font-extrabold leading-snug text-t1">{statement}</p>
              <p className="mt-1 font-dm text-[11px] tracking-wider text-t3">{caption}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
