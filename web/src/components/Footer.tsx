import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Logo } from "./Logo"
import { LEGAL_LINKS } from "@/lib/legal"

const primaryLinks = [
  { href: "/work", label: "Work" }, { href: "/services", label: "Services" },
  { href: "/local-growth", label: "Local Growth" }, { href: "/custom-systems", label: "Custom Systems" },
  { href: "/about", label: "About" }, { href: "/quote", label: "Start a Project" },
]

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-b1 bg-[#050d17] px-6 pb-8 pt-20 md:px-12 md:pt-28">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-14 border-b border-b1 pb-16 md:grid-cols-[1fr_auto] md:items-end">
          <div><p className="font-dm text-xs font-semibold uppercase tracking-[.16em] text-acc">The next useful move</p><p className="mt-4 max-w-[760px] font-syne text-[clamp(34px,6vw,72px)] font-extrabold leading-[.96] tracking-[-.04em]">Strategy aligned.<br />Systems engineered.<br />Growth managed.</p></div>
          <Link href="/quote" prefetch={false} className="group inline-flex w-fit items-center gap-3 border-b border-acc pb-2 font-dm text-sm font-semibold text-t1 transition-colors hover:text-acc">Discuss the project <ArrowUpRight size={16} className="transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none" aria-hidden="true" /></Link>
        </div>

        <div className="grid gap-10 py-10 md:grid-cols-[1fr_1.5fr]">
          <div className="flex items-start gap-3"><Logo size={26} /><p className="max-w-[280px] font-dm text-sm leading-relaxed text-t2">Managed digital infrastructure for ambitious organisations.</p></div>
          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">{primaryLinks.map((link) => <Link key={link.href} href={link.href} prefetch={false} className="footer-link font-dm text-sm text-t2">{link.label}</Link>)}</nav>
        </div>

        <div className="overflow-hidden border-y border-b1 py-5" aria-label="ScaleSmiths"><p className="whitespace-nowrap text-center font-syne text-[clamp(54px,13.5vw,176px)] font-extrabold leading-[.82] tracking-[-.065em] text-t1">SCALESMITHS</p></div>

        <div className="mt-7 flex flex-col gap-4 font-dm text-xs text-t3 sm:flex-row sm:items-center sm:justify-between"><address className="not-italic">Hucknall, Nottinghamshire · Working across the UK</address><div className="flex flex-wrap gap-5">{LEGAL_LINKS.map((link) => <Link key={link.href} href={link.href} className="footer-link">{link.label}</Link>)}</div><span>© 2026 ScaleSmiths</span></div>
      </div>
    </footer>
  )
}
