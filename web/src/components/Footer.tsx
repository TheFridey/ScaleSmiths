import Link from "next/link"
import { Logo } from "./Logo"
import { LEGAL_LINKS } from "@/lib/legal"
import { CookieSettingsButton } from "./CookieSettingsButton"

const navigationGroups = [
  {
    label: "Explore",
    links: [{ href: "/work", label: "Work" }, { href: "/services", label: "Services" }, { href: "/about", label: "About" }],
  },
  {
    label: "Build",
    links: [{ href: "/local-growth", label: "Local Growth" }, { href: "/custom-systems", label: "Custom Systems" }, { href: "/services/managed-business-email", label: "Managed Business Email" }],
  },
  {
    label: "Find & grow",
    links: [{ href: "/services/business-growth-audit", label: "Business Growth Audit" }, { href: "/digital-growth-partnership", label: "Digital Growth Partnership" }, { href: "/quote", label: "Start a Project" }],
  },
]

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-b1 bg-[#050d17] px-6 pb-8 pt-14 sm:pb-28 md:px-12 md:pt-20">
      <div className="mx-auto max-w-[1240px]">
        <div className="grid gap-12 pb-14 md:grid-cols-[minmax(260px,1fr)_minmax(420px,1.45fr)] md:gap-16 md:pb-16">
          <div>
            <Logo size={42} />
            <p className="mt-5 max-w-[360px] font-dm text-sm leading-relaxed text-t2">Founder-led business growth and engineering for ambitious organisations.</p>
          </div>
          <nav aria-label="Footer navigation" className="grid gap-9 sm:grid-cols-3 sm:gap-6">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="font-dm text-[11px] font-semibold uppercase tracking-[.16em] text-t3">{group.label}</p>
                <ul className="mt-4 grid gap-3">
                  {group.links.map((link) => <li key={link.href}><Link href={link.href} prefetch={false} className="footer-link inline-flex min-h-6 items-center font-dm text-sm text-t2">{link.label}</Link></li>)}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="grid gap-5 border-t border-b1 pt-7 font-dm text-xs text-t3 lg:grid-cols-[1fr_auto_auto] lg:items-center lg:gap-8">
          <address className="not-italic">Hucknall, Nottinghamshire · Working across the UK</address>
          <div className="flex flex-wrap gap-x-5 gap-y-3">{LEGAL_LINKS.map((link) => <Link key={link.href} href={link.href} className="footer-link inline-flex min-h-6 items-center">{link.label}</Link>)}<CookieSettingsButton /></div>
          <span>© 2026 ScaleSmiths</span>
        </div>
      </div>
    </footer>
  )
}
