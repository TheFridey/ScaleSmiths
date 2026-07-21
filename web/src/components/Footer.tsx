import { Logo } from "./Logo"
import { LEGAL_LINKS } from "@/lib/legal"

const links = [
  { href: "/", label: "Home" },
  { href: "/work", label: "Our Work" },
  { href: "/services", label: "Services" },
  { href: "/local-growth", label: "Local Growth" },
  { href: "/custom-systems", label: "Custom Systems" },
  { href: "/about", label: "About" },
  { href: "/quote", label: "Get a Quote" },
  ...LEGAL_LINKS,
]

export function Footer() {
  return (
    <footer className="border-t border-b1 px-6 py-10 md:px-12">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Logo size={22} />
          <span className="ml-1 font-dm text-xs text-t3">Strategy. Systems. Scale.</span>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3">
          {links.map((lk) => (
            <a key={lk.href} href={lk.href} className="text-sm text-t2 transition-colors hover:text-t1">
              {lk.label}
            </a>
          ))}
        </nav>
        <address className="not-italic">
          <span className="font-dm text-xs text-t3">
            Copyright 2026 ScaleSmiths. Hucknall, Nottinghamshire, UK.
          </span>
        </address>
      </div>
    </footer>
  )
}
