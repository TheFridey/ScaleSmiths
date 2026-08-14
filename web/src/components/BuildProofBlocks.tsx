import { Gauge, LockKeyhole, LineChart, PanelsTopLeft } from "lucide-react"
import { AnimateIn } from "./AnimateIn"

const BLOCKS = [
  {
    title: "Production-ready delivery",
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
    <section aria-label="Build proof" className="px-6 py-28 md:px-12 md:py-36">
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="mb-14 max-w-[760px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">Engineered delivery</span>
          <h2 className="mt-3 font-syne text-[clamp(34px,5.5vw,68px)] font-extrabold leading-[.98] tracking-[-.035em]">
            The build is only the beginning.
          </h2>
          <p className="mt-5 max-w-[620px] font-dm text-base leading-relaxed text-t2">
            Strategy, engineering and operational responsibility are designed as one system—not handed between disconnected suppliers.
          </p>
        </AnimateIn>
        <AnimateIn className="grid gap-3 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-2">
          {BLOCKS.map(({ title, copy, Icon }, index) => (
            <article
              key={title}
              className={`group relative min-h-[240px] overflow-hidden rounded-2xl bg-s1 p-7 transition-[background-color,transform] duration-300 hover:-translate-y-1 hover:bg-s2 md:p-9 ${index === 0 ? "lg:col-span-7 lg:row-span-2 lg:min-h-[500px]" : "lg:col-span-5"}`}
            >
              <div className="absolute inset-x-0 top-0 h-px origin-left scale-x-[.22] bg-acc/70 transition-transform duration-500 group-hover:scale-x-100" aria-hidden="true" />
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-acc/10 text-acc" aria-hidden="true"><Icon size={18} /></div>
              <div className={index === 0 ? "mt-24 max-w-xl lg:mt-52" : "mt-12"}>
                <p className="font-dm text-[10px] font-semibold uppercase tracking-[.18em] text-t3">0{index + 1} / Capability</p>
                <h3 className={`mt-3 font-syne font-bold tracking-[-.025em] ${index === 0 ? "text-3xl md:text-5xl" : "text-2xl"}`}>{title}</h3>
                <p className="mt-4 max-w-xl font-dm text-sm leading-[1.8] text-t2">{copy}</p>
              </div>
            </article>
          ))}
        </AnimateIn>
      </div>
    </section>
  )
}
