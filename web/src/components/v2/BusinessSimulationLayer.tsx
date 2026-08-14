"use client"

import { m as motion, useReducedMotion } from "motion/react"
import { AlertCircle, BarChart3, CalendarDays, CheckCircle2, ClipboardCheck, MailCheck, MessageSquarePlus, Search, Star, Workflow } from "lucide-react"
import type { V2Industry } from "@/lib/v2/scenes"
import { getIndustryContent } from "@/lib/v2/industryContent"
import type { V2IndustryModuleLabel } from "@/lib/v2/industryContent"

interface BusinessSimulationLayerProps {
  industry: V2Industry | null
}

const moduleIcons: Record<V2IndustryModuleLabel, typeof MessageSquarePlus> = {
  "Lead Capture": MessageSquarePlus,
  "Quote Engine": ClipboardCheck,
  "Booking Calendar": CalendarDays,
  "CRM Pipeline": Workflow,
  "Review Requests": Star,
  "SEO Visibility": Search,
  "Follow-up Automation": MailCheck,
  Analytics: BarChart3,
}

export function BusinessSimulationLayer({ industry }: BusinessSimulationLayerProps) {
  const reducedMotion = useReducedMotion()
  const content = getIndustryContent(industry)

  const containerTransition = reducedMotion ? { duration: 0 } : { staggerChildren: 0.08, delayChildren: 0.08 }
  const itemTransition = reducedMotion ? { duration: 0 } : { duration: 0.36, ease: "easeOut" as const }

  return (
    <motion.aside
      aria-labelledby="business-simulation-heading"
      className="rounded-lg border border-white/10 bg-bg/54 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.30)] backdrop-blur-xl md:p-6"
      initial={reducedMotion ? false : { opacity: 0, x: 22 }}
      animate={{ opacity: 1, x: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
    >
      <p className="inline-flex rounded-full border border-acc/30 bg-acc/10 px-3 py-1.5 font-dm text-[11px] font-semibold uppercase tracking-[0.14em] text-acc">
        Example workflow demonstration
      </p>
      <div className="mt-5">
        <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-t3">{content.name} workflow</p>
        <h2 id="business-simulation-heading" className="mt-2 font-syne text-2xl font-black leading-tight tracking-normal text-t1 md:text-3xl">
          {content.headline}
        </h2>
        <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{content.finalPitch}</p>
      </div>

      <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.045] p-4">
        <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-t3">Pain points</p>
        <ul className="mt-3 grid gap-2" aria-label={`${content.name} pain points`}>
          {content.painPoints.map((painPoint) => (
            <li key={painPoint} className="flex items-start gap-2 font-dm text-sm leading-relaxed text-t2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-acc" aria-hidden="true" />
              {painPoint}
            </li>
          ))}
        </ul>
      </div>

      <motion.div
        className="mt-6 grid gap-3 sm:grid-cols-2"
        aria-label="Animated business system modules"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: containerTransition },
        }}
      >
        {content.modules.map(({ label, summary }) => {
          const Icon = moduleIcons[label]

          return (
            <motion.div
              key={label}
              className="group min-h-[112px] rounded-lg border border-white/10 bg-white/[0.055] p-4 transition-colors hover:border-acc/30 hover:bg-white/[0.075]"
              whileHover={reducedMotion ? undefined : { y: -2 }}
              variants={{
                hidden: reducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.98 },
                visible: { opacity: 1, y: 0, scale: 1, transition: itemTransition },
              }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-acc/20 bg-acc/10 text-acc">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-dm text-sm font-semibold text-t1">{label}</h3>
                  <p className="mt-1 font-dm text-[13px] leading-relaxed text-t3">{summary}</p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      <motion.div
        className="mt-5 rounded-lg border border-white/10 bg-bg/52 p-4"
        initial={reducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reducedMotion ? { duration: 0 } : { duration: 0.36, delay: 0.72, ease: "easeOut" }}
      >
        <p className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-t3">Simulated workflow</p>
        <ul className="mt-3 grid gap-2" aria-label={`${content.name} simulated workflow`}>
          {content.simulatedWorkflow.map((workflowStep, index) => (
            <motion.li
              key={workflowStep}
              className="flex items-center gap-2 font-dm text-sm text-t2"
              initial={reducedMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.28, delay: 0.86 + index * 0.08, ease: "easeOut" }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              {workflowStep}
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </motion.aside>
  )
}
