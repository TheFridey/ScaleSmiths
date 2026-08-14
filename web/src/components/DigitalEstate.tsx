"use client"

import { useState } from "react"
import Link from "next/link"
import { m, useReducedMotion } from "motion/react"
import { ArrowRight } from "lucide-react"
import { AnimateIn } from "./AnimateIn"
import { motionStagger, motionTransitions } from "@/lib/motion"

const estateNodes = [
  { id: "website", label: "Website", description: "The public experience, conversion paths and content your customers rely on.", x: 12, y: 18 },
  { id: "hosting", label: "Hosting", description: "Production hosting and deployment responsibility scoped around the system we manage.", x: 38, y: 8 },
  { id: "email", label: "Business Email", description: "Professional custom-domain email, configured, authenticated and supported by ScaleSmiths. Available standalone or as part of a managed relationship.", x: 72, y: 16 },
  { id: "dns", label: "DNS", description: "Domain records kept organised and changed deliberately when they are within our agreed scope.", x: 88, y: 42 },
  { id: "ssl", label: "SSL", description: "Secure web connections maintained as part of managed hosting and infrastructure.", x: 75, y: 76 },
  { id: "backups", label: "Backups", description: "Backup responsibility and restore expectations documented for infrastructure we manage.", x: 45, y: 88 },
  { id: "monitoring", label: "Monitoring", description: "Technical checks that help surface issues in managed systems before they are left to drift.", x: 15, y: 76 },
  { id: "analytics", label: "Analytics", description: "Measurement foundations that connect digital work to useful business decisions.", x: 5, y: 46 },
  { id: "automation", label: "Automation", description: "Joined-up workflows that reduce repetitive operational work where custom integration is justified.", x: 31, y: 48 },
  { id: "support", label: "Support", description: "One accountable technical relationship for questions, requests and agreed ongoing work.", x: 64, y: 50 },
]

export function DigitalEstate() {
  const [activeId, setActiveId] = useState("email")
  const reducedMotion = useReducedMotion()
  const active = estateNodes.find((node) => node.id === activeId) ?? estateNodes[0]

  return (
    <section aria-labelledby="digital-estate-heading" className="relative overflow-hidden border-y border-b1/70 bg-s1 px-6 py-28 md:px-12 md:py-36">
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="max-w-[900px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">The managed digital estate</span>
          <h2 id="digital-estate-heading" className="mt-3 font-syne text-[clamp(42px,7vw,86px)] font-extrabold leading-[.92] tracking-[-.045em]">
            More than<br />a website.
          </h2>
          <p className="mt-7 max-w-[720px] font-dm text-[clamp(17px,2vw,22px)] leading-relaxed text-t2">
            Your website is one part of the infrastructure the business depends on. ScaleSmiths can bring the surrounding estate into one deliberately scoped, professionally managed technical relationship.
          </p>
        </AnimateIn>

        <div className="mt-16 grid gap-8 lg:grid-cols-[1.35fr_.65fr] lg:items-stretch">
          <div className="relative hidden min-h-[620px] overflow-hidden rounded-3xl bg-bg lg:block" aria-label="Interactive digital estate architecture">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {estateNodes.map((node, index) => (
                <m.line
                  key={node.id}
                  x1="50" y1="50" x2={node.x} y2={node.y}
                  stroke="rgba(61,119,144,.42)" strokeWidth=".18" vectorEffect="non-scaling-stroke"
                  initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{ ...motionTransitions.gentle, delay: reducedMotion ? 0 : index * motionStagger.tight }}
                />
              ))}
            </svg>

            <div className="absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-acc/35 bg-s1 text-center shadow-[0_0_70px_rgba(34,211,238,.08)]">
              <span className="font-dm text-[9px] font-semibold uppercase tracking-[.18em] text-acc">Managed by</span>
              <span className="mt-2 font-syne text-sm font-bold">ScaleSmiths</span>
            </div>

            {estateNodes.map((node, index) => (
              <m.button
                key={node.id}
                type="button"
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-b2 bg-s1 px-4 py-2 font-dm text-[10px] font-semibold uppercase tracking-[.1em] text-t2 transition-colors hover:border-acc hover:text-t1 focus-visible:border-acc data-[active=true]:border-acc data-[active=true]:bg-acc/10 data-[active=true]:text-t1"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                data-active={activeId === node.id}
                onMouseEnter={() => setActiveId(node.id)}
                onFocus={() => setActiveId(node.id)}
                onClick={() => setActiveId(node.id)}
                aria-pressed={activeId === node.id}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ ...motionTransitions.ui, delay: reducedMotion ? 0 : 0.18 + index * motionStagger.tight }}
              >
                {node.label}
              </m.button>
            ))}
          </div>

          <aside className="hidden flex-col justify-between rounded-3xl bg-bg p-8 lg:flex" aria-live="polite">
            <div>
              <p className="font-dm text-[10px] font-semibold uppercase tracking-[.18em] text-acc">Selected responsibility</p>
              <h3 className="mt-5 font-syne text-4xl font-bold tracking-[-.03em]">{active.label}</h3>
              <p className="mt-5 font-dm text-base leading-[1.8] text-t2">{active.description}</p>
            </div>
            <p className="mt-10 border-t border-b1 pt-6 font-dm text-xs leading-relaxed text-t3">
              Every estate is scoped individually. A node represents a capability that may be managed—not an automatic inclusion or invented live status.
            </p>
          </aside>

          <div className="relative grid gap-0 border-l border-b2 pl-6 lg:hidden">
            {estateNodes.map((node) => (
              <article key={node.id} className="relative border-b border-b1 py-6 last:border-0">
                <span className="absolute -left-[29px] top-8 h-1.5 w-1.5 rounded-full bg-acc" aria-hidden="true" />
                <h3 className="font-syne text-lg font-bold">{node.label}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{node.description}</p>
              </article>
            ))}
          </div>
        </div>

        <AnimateIn className="mt-12 flex flex-col justify-between gap-6 border-t border-b1 pt-8 md:flex-row md:items-center">
          <p className="max-w-[720px] font-dm text-sm leading-relaxed text-t2">
            The portal supports the working relationship through project information, requests, published reports and shared delivery notes where portal access is included in scope.
          </p>
          <Link href="/portal/login" prefetch={false} className="group inline-flex shrink-0 items-center gap-2 font-dm text-sm font-semibold text-t1">
            Open Client Portal <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </AnimateIn>
        <AnimateIn className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-acc/20 bg-acc/[.04] p-5 sm:flex-row sm:items-center">
          <p className="font-dm text-sm text-t2"><strong className="text-t1">Need professional email only?</strong> Managed Business Email starts from £15 for three 5GB mailboxes, with initial setup included.</p>
          <Link href="/services/managed-business-email" prefetch={false} className="group inline-flex shrink-0 items-center gap-2 font-dm text-sm font-semibold text-acc">Explore Managed Email <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link>
        </AnimateIn>
      </div>
    </section>
  )
}
