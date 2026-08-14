import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { AnimateIn } from "./AnimateIn"
import { PortalPreview } from "./PortalPreview"

const capabilities = ["Project timeline", "Requests and follow-up", "Published reports", "Shared delivery notes"]

export function ClientPortalSection({ verifiedAvailabilityClaim }: { verifiedAvailabilityClaim?: string }) {
  return (
    <section aria-label="Client portal" className="border-y border-b1 bg-s1/30 px-6 py-24 md:px-12">
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <AnimateIn>
          <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Client delivery system</span>
          <h2 className="mt-2 font-syne text-[clamp(32px,5vw,56px)] font-extrabold leading-[.98] tracking-[-0.035em]">A clear view of the work behind the work.</h2>
          <p className="mt-5 max-w-[520px] font-dm text-base leading-relaxed text-t2">{verifiedAvailabilityClaim ?? "Where included in the agreed scope, the ScaleSmiths portal gives clients one protected place to review updates, log requests and keep the working relationship organised."}</p>
          <ul className="mt-7 grid gap-3">{capabilities.map((item) => <li key={item} className="flex items-center gap-3 font-dm text-sm text-t2"><CheckCircle2 size={15} className="shrink-0 text-acc" aria-hidden="true" />{item}</li>)}</ul>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/portal/login" prefetch={false} className="btn-ghost font-dm text-sm">Client sign in</Link><Link href="/quote" prefetch={false} className="btn-primary font-dm text-sm">Start a project <ArrowRight size={15} aria-hidden="true" /></Link></div>
        </AnimateIn>
        <PortalPreview />
      </div>
    </section>
  )
}
