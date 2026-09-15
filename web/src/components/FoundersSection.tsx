import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { AnimateIn } from "./AnimateIn"
import { FounderPortrait } from "./FounderPortrait"
import { founderFocusAreas, founderProfileHref, founders } from "@/lib/founders"
import { teamImages } from "@/lib/team-images"

const directAccessPoints = [
  {
    title: "No hand-off chain",
    description: "You are not passed from a salesperson to an account manager to an outsourced developer. The founders who scope the work stay responsible for it.",
  },
  {
    title: "Commercial and technical in one conversation",
    description: "Growth priorities and implementation trade-offs are weighed together, by the people who will act on them.",
  },
  {
    title: "Accountability you can name",
    description: "Published case studies record who delivered the work, and each founder has a public profile you can check.",
  },
]

export function FoundersSection() {
  const pairPhoto = teamImages.founders

  return (
    <section aria-labelledby="home-founders-heading" className="px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
          <AnimateIn>
            {pairPhoto.available ? (
              <FounderPortrait image="founders" monogram="R · TNB" accent="#22d3ee" sizes="(min-width: 1024px) 620px, 100vw" />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {founders.map((founder, index) => (
                  <FounderPortrait
                    key={founder.slug}
                    image={founder.photo}
                    monogram={founder.monogram}
                    accent={founder.accent}
                    sizes="(min-width: 1024px) 310px, 50vw"
                    className={index === 1 ? "mt-10" : undefined}
                  />
                ))}
              </div>
            )}
          </AnimateIn>

          <AnimateIn delay={0.08}>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Meet the founders</span>
            <h2 id="home-founders-heading" className="mt-3 font-syne text-[clamp(34px,5vw,60px)] font-extrabold leading-[.98] tracking-[-.035em]">
              The people you speak to are the people doing the work.
            </h2>
            <p className="mt-6 font-dm text-lg leading-relaxed text-t2">
              ScaleSmiths is founder-led. You work directly with the people responsible for strategy, commercial direction and implementation, from the first conversation to the ongoing roadmap.
            </p>

            <ul className="mt-9 grid gap-3">
              {founders.map((founder) => (
                <li key={founder.slug}>
                  <Link
                    href={founderProfileHref(founder)}
                    prefetch={false}
                    className="group flex flex-col gap-3 rounded-2xl border border-b1 bg-s1 p-5 transition-colors hover:border-b2 focus-visible:border-acc sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      <span className="block font-syne text-xl font-bold">{founder.name}</span>
                      <span className="mt-1 block font-dm text-sm text-acc">{founder.role.text}</span>
                      <span className="mt-2 block font-dm text-xs text-t3">{founderFocusAreas(founder, 4).join(" · ")}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-2 font-dm text-sm font-medium text-t2 transition-colors group-hover:text-t1">
                      {founder.firstName}&apos;s profile <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </AnimateIn>
        </div>

        <AnimateIn delay={0.1} className="mt-14 grid gap-3 border-t border-b1 pt-10 md:grid-cols-3">
          {directAccessPoints.map((point) => (
            <div key={point.title}>
              <h3 className="font-syne text-lg font-bold">{point.title}</h3>
              <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{point.description}</p>
            </div>
          ))}
        </AnimateIn>
      </div>
    </section>
  )
}
