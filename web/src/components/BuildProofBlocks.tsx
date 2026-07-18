import { Gauge, LockKeyhole, LineChart, PanelsTopLeft } from "lucide-react"
import { AnimateIn } from "./AnimateIn"

const BLOCKS = [
  {
    title: "Lean delivery",
    copy: "Lean scopes, direct founder communication, and production-ready defaults keep momentum high without cutting corners.",
    Icon: Gauge,
  },
  {
    title: "Secure foundations",
    copy: "Auth, cookies, headers, validation, rate limits, deployment, and data handling are treated as part of the product, not an afterthought.",
    Icon: LockKeyhole,
  },
  {
    title: "Business outcomes",
    copy: "Every build is tied to a commercial reason: more qualified leads, better conversion, lower admin drag, or stronger retention.",
    Icon: LineChart,
  },
  {
    title: "Custom code",
    copy: "No generic template churn. We build the interface, workflows, and infrastructure around the way the business actually operates.",
    Icon: PanelsTopLeft,
  },
]

export function BuildProofBlocks() {
  return (
    <section aria-label="Build proof" className="px-6 py-20 md:px-12">
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="grid gap-3 md:grid-cols-4">
          {BLOCKS.map(({ title, copy, Icon }) => (
            <article key={title} className="rounded-2xl border border-b1 bg-s1 p-6">
              <Icon size={18} className="mb-5 text-acc" aria-hidden="true" />
              <h2 className="font-syne text-lg font-bold">{title}</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{copy}</p>
            </article>
          ))}
        </AnimateIn>
      </div>
    </section>
  )
}
