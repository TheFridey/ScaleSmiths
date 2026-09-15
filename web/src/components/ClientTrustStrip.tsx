import Link from "next/link"
import { AnimateIn } from "./AnimateIn"
import { ClientLogo } from "./ClientLogo"
import { trustEntries, type TrustEntry } from "@/lib/client-proof"

function TrustMark({ entry }: { entry: TrustEntry }) {
  return (
    <Link
      href={entry.href}
      prefetch={false}
      className="group flex h-full min-h-[92px] flex-col justify-between rounded-xl border border-b1 bg-bg/40 px-4 py-4 transition-colors hover:border-b2 focus-visible:border-acc"
    >
      <ClientLogo
        name={entry.name}
        logo={entry.logo}
        height={28}
        monochrome
        className="font-syne text-[15px] text-t2 transition-[color,opacity] group-hover:text-t1 group-hover:opacity-100"
      />
      <span className="mt-3 font-dm text-[11px] uppercase tracking-[.1em] text-t3">
        {entry.sector} · {entry.location}
      </span>
    </Link>
  )
}

export function ClientTrustStrip() {
  const entries = trustEntries()
  const clientWork = entries.filter((entry) => entry.group === "client-work")
  const platforms = entries.filter((entry) => entry.group === "product-platform")

  return (
    <section aria-labelledby="client-trust-heading" className="border-y border-b1 bg-s1/50 px-6 py-12 md:px-12 md:py-14">
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Published work</span>
            <h2 id="client-trust-heading" className="mt-2 font-syne text-[clamp(22px,3vw,30px)] font-extrabold tracking-[-.025em]">
              Trusted to build for businesses in the UK and beyond.
            </h2>
          </div>
          <p className="max-w-[420px] font-dm text-sm leading-relaxed text-t3">
            Every name links to a case study showing what was built and why.
          </p>
        </AnimateIn>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          <div>
            <h3 className="font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-t3">Client websites & commerce</h3>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {clientWork.map((entry) => <li key={entry.href}><TrustMark entry={entry} /></li>)}
            </ul>
          </div>
          <div>
            <h3 className="font-dm text-[11px] font-semibold uppercase tracking-[.14em] text-t3">Platforms engineered</h3>
            <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {platforms.map((entry) => <li key={entry.href}><TrustMark entry={entry} /></li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
