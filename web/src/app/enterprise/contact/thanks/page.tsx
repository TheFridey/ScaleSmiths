import Link from "next/link"
import { ArrowRight, CheckCircle2, FileText, Search, Wrench } from "lucide-react"
import { metadataForEnterpriseContactThanksPage } from "@/lib/enterprise-contact-page"

export const metadata = metadataForEnterpriseContactThanksPage()

export default function EnterpriseContactThanksPage() {
  return (
    <section className="px-6 py-20 md:px-12">
      <div className="mx-auto max-w-[900px] text-center">
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-acc/20 bg-acc/10">
          <CheckCircle2 size={28} className="text-acc" aria-hidden="true" />
        </div>
        <h1 className="font-syne text-[clamp(36px,6vw,64px)] font-extrabold leading-none tracking-[-0.03em]">
          Discovery enquiry received.
        </h1>
        <p className="mx-auto mt-5 max-w-[620px] font-dm text-base leading-relaxed text-t2">
          We will review the organisational context, system requirements and project constraints before replying through the contact route you provided.
        </p>

        <div className="mt-10 grid gap-3 text-left md:grid-cols-3">
          {[
            { Icon: Search, title: "Qualify", copy: "We check whether the opportunity fits founder-led enterprise engineering." },
            { Icon: FileText, title: "Prepare", copy: "Useful prep: current systems, integrations, security constraints and success criteria." },
            { Icon: Wrench, title: "Next step", copy: "If there is a fit, we propose a focused discovery conversation — not a sales pitch." },
          ].map(({ Icon, title, copy }) => (
            <div key={title} className="rounded-2xl border border-b1 bg-s1 p-5">
              <Icon size={17} className="mb-4 text-acc" aria-hidden="true" />
              <h2 className="font-syne text-lg font-bold">{title}</h2>
              <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{copy}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/enterprise" prefetch={false} className="btn-primary font-dm">
            Back to Enterprise <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/enterprise/delivery" prefetch={false} className="btn-ghost font-dm">
            How delivery works
          </Link>
        </div>
      </div>
    </section>
  )
}
