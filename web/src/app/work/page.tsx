import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Portfolio } from "@/components/Portfolio"
import { AnimateIn } from "@/components/AnimateIn"
import { CTA } from "@/components/CTA"
import { buildLogs } from "@/lib/build-logs"

export const metadata: Metadata = {
  title: "Our Work",
  description:
    "Portfolio of projects built by the ScaleSmiths team - local businesses, e-commerce, SaaS platforms and more.",
  alternates: { canonical: "https://scalesmiths.io/work" },
}

export default function WorkPage() {
  return (
    <>
      <div className="px-6 md:px-12 pt-16 pb-0 max-w-[1240px] mx-auto">
        <AnimateIn>
          <span className="font-dm text-xs text-acc tracking-[.14em] font-semibold uppercase">Work / Build Logs</span>
          <h1 className="font-syne text-[clamp(32px,5.5vw,60px)] font-extrabold tracking-[-0.025em] mt-2">
            Proof without theatre.
          </h1>
          <p className="font-dm text-base text-t2 leading-relaxed mt-3 max-w-[540px]">
            Honest build logs from the ScaleSmiths platform and selected project work. No fake revenue claims, no invented testimonials.
          </p>
        </AnimateIn>
      </div>
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-3 md:grid-cols-2">
          {buildLogs.map((log) => (
            <Link key={log.slug} href={`/work/${log.slug}`} prefetch={false} className="rounded-2xl border border-b1 bg-s1 p-6 transition-colors hover:border-b2">
              <div className="mb-4 flex flex-wrap gap-1.5">
                {log.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded border border-b1 bg-s2 px-2 py-1 font-dm text-[11px] text-t2">{tag}</span>
                ))}
              </div>
              <h2 className="font-syne text-2xl font-bold">{log.title}</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{log.summary}</p>
              <span className="mt-5 inline-flex items-center gap-2 font-dm text-sm font-medium text-t2">
                Read build log <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <Portfolio showHeading={false} />
      <CTA />
    </>
  )
}
