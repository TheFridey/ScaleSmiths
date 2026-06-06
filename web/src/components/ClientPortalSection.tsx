import Link from "next/link"
import { ArrowRight, CheckCircle2, FileText, MessageSquare, PanelsTopLeft, ShieldCheck } from "lucide-react"
import { AnimateIn, GSAPReveal } from "./AnimateIn"

const features = [
  {
    title: "Build progress",
    body: "See the current phase, what is complete, what is waiting on review, and what comes next.",
    Icon: PanelsTopLeft,
  },
  {
    title: "Direct project chat",
    body: "Keep support questions, decisions, and launch notes tied to the workspace instead of scattered across inboxes.",
    Icon: MessageSquare,
  },
  {
    title: "Files and decisions",
    body: "Review briefs, brand assets, launch materials, handoff notes, and decision requests from one private place.",
    Icon: FileText,
  },
]

const checks = ["Private client sign-in", "Milestone timeline", "Review requests", "Launch checklist"]

export function ClientPortalSection() {
  return (
    <section aria-label="Client portal" className="px-6 py-24 md:px-12">
      <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <AnimateIn>
          <span className="font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">
            Client Portal
          </span>
          <h2 className="mt-2 font-syne text-[clamp(30px,5vw,52px)] font-extrabold tracking-[-0.025em]">
            Your project, visible from day one.
          </h2>
          <p className="mt-4 max-w-[540px] font-dm text-base leading-relaxed text-t2">
            Every active client gets a private workspace for progress, decisions, files, questions, and launch information. No mystery status updates. No digging through old threads.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/portal/login" prefetch={false} className="btn-primary font-dm text-sm">
              Sign In <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <Link href="/quote" prefetch={false} className="btn-ghost font-dm text-sm">
              Start a Project
            </Link>
          </div>
        </AnimateIn>

        <GSAPReveal className="grid gap-3 md:grid-cols-3" stagger={0.08}>
          {features.map(({ title, body, Icon }) => (
            <article key={title} className="rounded-2xl border border-b1 bg-s1 p-6">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[10px] border border-b2 bg-s2">
                <Icon size={19} className="text-acc" aria-hidden="true" />
              </div>
              <h3 className="font-syne text-lg font-bold">{title}</h3>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{body}</p>
            </article>
          ))}
          <article className="rounded-2xl border border-acc/20 bg-acc/10 p-6 md:col-span-3">
            <div className="mb-5 flex items-center gap-3">
              <ShieldCheck size={19} className="text-acc" aria-hidden="true" />
              <h3 className="font-syne text-lg font-bold">Built for calm delivery</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {checks.map((check) => (
                <div key={check} className="flex items-center gap-2 font-dm text-sm text-t2">
                  <CheckCircle2 size={14} className="shrink-0 text-acc" aria-hidden="true" />
                  {check}
                </div>
              ))}
            </div>
          </article>
        </GSAPReveal>
      </div>
    </section>
  )
}
