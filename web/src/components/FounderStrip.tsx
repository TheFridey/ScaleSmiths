import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AuthorAvatar } from "./insights/AuthorByline"
import { founderProfileHref, founders } from "@/lib/founders"

/** "Who you'll work with": the founders, with profile links. Used on service and location pages. */
export function FounderStrip({ headingId, intro }: { headingId: string; intro: string }) {
  return (
    <section aria-labelledby={headingId} className="px-6 py-20 md:px-12">
      <div className="mx-auto grid max-w-[1240px] gap-8 rounded-2xl border border-b1 bg-s1 p-6 md:p-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
        <div>
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Who you&apos;ll work with</span>
          <h2 id={headingId} className="mt-2 font-syne text-[clamp(26px,3.6vw,38px)] font-extrabold tracking-[-.025em]">The founders, from first call to launch.</h2>
          <p className="mt-4 font-dm text-sm leading-relaxed text-t2">{intro}</p>
        </div>
        <ul className="grid gap-3">
          {founders.map((founder) => (
            <li key={founder.slug}>
              <Link href={founderProfileHref(founder)} prefetch={false} className="group flex items-center gap-4 rounded-xl border border-b1 bg-bg/60 p-4 transition-colors hover:border-b2">
                <AuthorAvatar founder={founder} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block font-syne text-lg font-bold">{founder.name}</span>
                  <span className="block font-dm text-sm text-t2">{founder.authorTitle}</span>
                </span>
                <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-t3 transition-transform group-hover:translate-x-0.5 group-hover:text-acc" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
