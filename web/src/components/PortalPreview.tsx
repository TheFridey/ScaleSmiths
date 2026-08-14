"use client"

import { m, useReducedMotion } from "motion/react"
import { CheckCircle2, Clock3, FileText, ListChecks, ShieldCheck } from "lucide-react"
import { motionStagger, motionTransitions } from "@/lib/motion"

const milestones = [
  { label: "Strategy approved", complete: true },
  { label: "Interface system", complete: true },
  { label: "Client review", complete: false },
  { label: "Launch preparation", complete: false },
]

export function PortalPreview() {
  const reducedMotion = useReducedMotion()
  return (
    <m.div initial={reducedMotion ? false : { opacity: 0, y: 24, rotateX: 3, scale: 0.985 }} whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }} viewport={{ once: true, amount: 0.18 }} transition={motionTransitions.gentle} style={{ transformPerspective: 1200 }} className="overflow-hidden rounded-[1.35rem] border border-b2 bg-bg shadow-[0_32px_100px_rgba(0,0,0,.4)]" aria-label="Demonstration of the ScaleSmiths client portal using example data">
      <div className="flex items-center justify-between border-b border-b1 bg-s1 px-4 py-3 md:px-5">
        <div className="flex items-center gap-2" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-t3/50" /><span className="h-2 w-2 rounded-full bg-t3/30" /><span className="h-2 w-2 rounded-full bg-t3/20" /></div>
        <span className="rounded border border-acc/20 bg-acc/10 px-2 py-1 font-dm text-[10px] font-semibold uppercase tracking-[.14em] text-acc">Demonstration preview</span>
        <ShieldCheck size={15} className="text-t3" aria-hidden="true" />
      </div>
      <div className="grid md:grid-cols-[150px_1fr]">
        <aside className="hidden border-r border-b1 bg-s1/55 p-4 md:block" aria-label="Example portal navigation">
          <p className="font-syne text-sm font-bold">ScaleSmiths</p>
          <nav className="mt-7 grid gap-2 font-dm text-xs text-t3"><span className="rounded-md bg-acc/10 px-3 py-2 text-acc">Overview</span><span className="px-3 py-2">Timeline</span><span className="px-3 py-2">Requests</span><span className="px-3 py-2">Reports</span></nav>
        </aside>
        <m.div className="p-4 md:p-6" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={{ hidden: {}, visible: { transition: { staggerChildren: reducedMotion ? 0 : motionStagger.tight } } }}>
          <m.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="font-dm text-[10px] font-semibold uppercase tracking-[.14em] text-acc">Project workspace</p><h3 className="mt-1 font-syne text-xl font-bold">Example Growth Platform</h3><p className="mt-1 font-dm text-xs text-t3">Neutral demonstration data</p></div>
            <span className="rounded-full border border-acc/20 bg-acc/10 px-3 py-1 font-dm text-xs text-acc">Stage · Build</span>
          </m.div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3"><PreviewStat Icon={Clock3} label="Next milestone" value="Client review" /><PreviewStat Icon={ListChecks} label="Open requests" value="2" /><PreviewStat Icon={FileText} label="Published reports" value="1" /></div>
          <m.section variants={{ hidden: { opacity: 0, y: reducedMotion ? 0 : 8 }, visible: { opacity: 1, y: 0 } }} className="mt-3 rounded-xl border border-b1 bg-s1 p-4" aria-label="Example milestone progress">
            <div className="flex items-center justify-between"><h4 className="font-syne text-sm font-bold">Delivery timeline</h4><span className="font-dm text-[11px] text-t3">2 of 4 resolved</span></div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-b1"><m.div initial={reducedMotion ? { width: "50%" } : { width: 0 }} whileInView={{ width: "50%" }} viewport={{ once: true }} transition={motionTransitions.ambient} className="h-full bg-acc" /></div>
            <ol className="mt-4 grid gap-2 sm:grid-cols-2">{milestones.map((item) => <li key={item.label} className="flex items-center gap-2 font-dm text-xs text-t2">{item.complete ? <CheckCircle2 size={14} className="text-acc" aria-hidden="true" /> : <span className="ml-0.5 h-2.5 w-2.5 rounded-full border border-b2" aria-hidden="true" />}{item.label}</li>)}</ol>
          </m.section>
        </m.div>
      </div>
    </m.div>
  )
}

function PreviewStat({ Icon, label, value }: { Icon: typeof FileText; label: string; value: string }) {
  return <m.div variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0, transition: motionTransitions.ui } }} className="rounded-xl border border-b1 bg-s1 p-4"><Icon size={15} className="text-acc" aria-hidden="true" /><p className="mt-4 font-dm text-[10px] uppercase tracking-[.12em] text-t3">{label}</p><p className="mt-1 font-syne text-sm font-bold">{value}</p></m.div>
}
