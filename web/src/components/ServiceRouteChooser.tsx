import Link from "next/link"
import { ArrowRight, Building2, Workflow } from "lucide-react"

export function ServiceRouteChooser({ compact = false }: { compact?: boolean }) {
  return (
    <section aria-labelledby={compact ? "home-service-routes" : "service-routes"} className={compact ? "px-6 py-12 md:px-12" : "px-6 pb-20 md:px-12"}>
      <div className="mx-auto max-w-[1240px]">
        <div className="max-w-2xl">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Choose your route</span>
          <h2 id={compact ? "home-service-routes" : "service-routes"} className="mt-2 font-syne text-[clamp(28px,4vw,44px)] font-extrabold tracking-[-.025em]">
            Different problems need different buying journeys.
          </h2>
          <p className="mt-3 font-dm text-sm leading-relaxed text-t2">Start with the route that sounds like your business. You can move between them without committing to a scope.</p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <RouteCard
            href="/local-growth"
            eyebrow="Local service businesses"
            title="Local Growth"
            description="Trust, local visibility, enquiries, bookings and managed improvement for trades, clinics, hospitality and founder-led businesses."
            cta="Explore Local Growth"
            icon={<Building2 size={22} aria-hidden="true" />}
            tone="local"
          />
          <RouteCard
            href="/custom-systems"
            eyebrow="Products and complex operations"
            title="Custom Systems"
            description="Portals, e-commerce, SaaS, AI implementation, automation, integrations, real-time systems, and production infrastructure."
            cta="Explore Custom Systems"
            icon={<Workflow size={22} aria-hidden="true" />}
            tone="systems"
          />
        </div>
      </div>
    </section>
  )
}

function RouteCard({ href, eyebrow, title, description, cta, icon, tone }: { href: string; eyebrow: string; title: string; description: string; cta: string; icon: React.ReactNode; tone: "local" | "systems" }) {
  const visual = tone === "local"
    ? "border-success/25 bg-gradient-to-br from-success/[.09] to-s1 hover:border-success/45"
    : "border-acc/25 bg-gradient-to-br from-acc/[.09] via-s1 to-violet-500/5 hover:border-acc/45"
  return (
    <Link href={href} prefetch={false} className={`group rounded-2xl border p-6 transition-colors md:p-8 ${visual}`}>
      <div className="flex items-center gap-3 text-acc">{icon}<span className="font-dm text-xs font-semibold uppercase tracking-[.12em]">{eyebrow}</span></div>
      <h3 className="mt-5 font-syne text-3xl font-extrabold">{title}</h3>
      <p className="mt-3 max-w-xl font-dm text-sm leading-relaxed text-t2">{description}</p>
      <span className="mt-6 inline-flex items-center gap-2 font-dm text-sm font-semibold text-t1">{cta}<ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
    </Link>
  )
}
