import Link from "next/link"
import { CheckCircle2, Globe, TrendingUp, Layers, ChevronRight } from "lucide-react"
import { AnimateIn, StaggerIn } from "./AnimateIn"
import { services, retainers } from "@/lib/data"
import { cn } from "@/lib/utils"
import { claimWording, type PublicClaim } from "@/lib/public-claims"

const ICONS = { globe: Globe, "trending-up": TrendingUp, layers: Layers }

export function Services({ claims }: { claims: ReadonlyMap<string, PublicClaim> }) {
  return (
    <section aria-label="Services and pricing" className="px-6 md:px-12 py-24">
      <div className="max-w-[1240px] mx-auto">
        <AnimateIn className="mb-14">
          <span className="font-dm text-xs text-acc tracking-[.14em] font-semibold uppercase">
            What We Build
          </span>
          <h2 className="font-syne text-[clamp(30px,5vw,52px)] font-extrabold tracking-[-0.025em] mt-2 mb-3">
            Built for the way<br />you actually work.
          </h2>
          <p className="font-dm text-t2 max-w-[520px] leading-relaxed text-base">
            {claimWording(claims, "service.projects-across-uk", "We work with local businesses, e-commerce brands and software teams. Every engagement starts with strategy — not a template.")}
          </p>
        </AnimateIn>

        <StaggerIn className="grid md:grid-cols-3 gap-3" staggerDelay={0.1}>
          {services.map((s) => {
            const Icon = ICONS[s.icon]
            return (
              <article
                key={s.tier}
                className={cn(
                  "card-lift rounded-2xl p-8 border relative",
                  s.featured
                    ? "border-acc/20 bg-gradient-to-br from-s2 to-acc/5"
                    : "border-b1 bg-s1",
                )}
              >
                {s.featured && (
                  <div className="absolute top-4 right-4 bg-acc text-white text-[11px] font-dm font-semibold px-[10px] py-[3px] rounded-full tracking-[.04em]">
                    FEATURED
                  </div>
                )}
                <div className="w-11 h-11 bg-s3 rounded-[10px] flex items-center justify-center mb-6" aria-hidden="true">
                  <Icon size={20} className={s.featured ? "text-acc" : "text-silver"} />
                </div>
                <h3 className="font-syne text-xl font-bold mb-1">{s.tier}</h3>
                <div className="font-syne text-[17px] font-semibold text-acc mb-3">{claimWording(claims, s.priceClaimId, s.range)}</div>
                <p className="font-dm text-sm text-t2 leading-relaxed mb-5">{s.pitch}</p>
                <ul aria-label={`${s.tier} tier includes`} className="flex flex-col gap-1.5 mb-6">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 font-dm text-sm text-t2">
                      <CheckCircle2 size={13} className="text-success shrink-0" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/quote"
                  prefetch={false}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 py-[11px] rounded-lg font-dm text-sm font-medium transition-all",
                    s.featured
                      ? "bg-acc text-white hover:opacity-90"
                      : "bg-s3 text-t2 hover:bg-b1",
                  )}
                  aria-label={`Get started with the ${s.tier} tier`}
                >
                  Get Started <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </article>
            )
          })}
        </StaggerIn>

        <AnimateIn className="mt-10 bg-s1 border border-b1 rounded-2xl p-7" delay={0.2}>
          <h3 className="font-syne text-lg font-bold mb-1">Monthly Retainers</h3>
          <p className="font-dm text-sm text-t2 mb-6">
            {claimWording(claims, "service.most-clients-retain-30-days", "Post-launch support is optional and scoped separately around maintenance, monitoring and measured improvements.")}
          </p>
          <div className="grid md:grid-cols-3 gap-3">
            {retainers.map((r) => (
              <div key={r.name} className="bg-s2 border border-b2 rounded-xl p-5">
                <div className="font-syne text-[15px] font-bold mb-1">{r.name}</div>
                <div className="font-syne text-sm font-semibold text-acc mb-2">{claimWording(claims, r.priceClaimId, r.price)}</div>
                <div className="font-dm text-[13px] text-t2 leading-relaxed">{r.desc}</div>
                <div className="mt-4 flex items-center justify-between border-t border-b2 pt-3 font-dm text-[11px]">
                  <span className="text-t3">Managed Business Email</span>
                  <span className="rounded-full bg-acc/10 px-2.5 py-1 font-semibold uppercase tracking-[.08em] text-acc">{r.managedEmail}</span>
                </div>
              </div>
            ))}
          </div>
        </AnimateIn>
      </div>
    </section>
  )
}
