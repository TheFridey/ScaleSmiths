"use client"

import { useId } from "react"
import type { IndustryDemonstration } from "@/lib/industries/demonstrations"

export function IndustryWorkflowDemo({ demonstration }: { demonstration: IndustryDemonstration }) {
  const labelId = useId()

  return (
    <div className="mt-10 grid gap-8">
      <div className="flex flex-wrap gap-2" aria-labelledby={labelId}>
        <p id={labelId} className="sr-only">Jump to a workflow</p>
        {demonstration.tracks.map((track) => (
          <a
            key={track.id}
            href={`#${demonstration.hubSlug}-${track.id}`}
            className="inline-flex min-h-11 items-center rounded-full border border-b1 bg-s1 px-4 font-dm text-sm font-semibold text-t1 hover:border-acc/50"
          >
            {track.label}
          </a>
        ))}
      </div>
      {demonstration.tracks.map((track) => (
        <section key={track.id} id={`${demonstration.hubSlug}-${track.id}`} aria-labelledby={`${track.id}-title`} className="scroll-mt-24">
          <h2 id={`${track.id}-title`} className="font-syne text-[clamp(26px,3.6vw,40px)] font-extrabold tracking-[-0.025em]">
            {track.label}
          </h2>
          <p className="mt-3 max-w-[720px] font-dm text-base leading-relaxed text-t2">{track.summary}</p>
          <ol className="mt-8 grid gap-4">
            {track.steps.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-b1 bg-s1 p-6">
                <p className="font-dm text-[11px] font-semibold uppercase tracking-[0.14em] text-acc">Step {index + 1}</p>
                <h3 className="mt-2 font-syne text-xl font-bold tracking-[-0.02em]">{step.title}</h3>
                <dl className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <dt className="font-dm text-xs font-semibold uppercase tracking-[0.12em] text-t3">What happens</dt>
                    <dd className="mt-2 font-dm text-sm leading-relaxed text-t2">{step.happens}</dd>
                  </div>
                  <div>
                    <dt className="font-dm text-xs font-semibold uppercase tracking-[0.12em] text-t3">What the system does</dt>
                    <dd className="mt-2 font-dm text-sm leading-relaxed text-t2">{step.system}</dd>
                  </div>
                  <div>
                    <dt className="font-dm text-xs font-semibold uppercase tracking-[0.12em] text-t3">What changes</dt>
                    <dd className="mt-2 font-dm text-sm leading-relaxed text-t2">{step.outcome}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
