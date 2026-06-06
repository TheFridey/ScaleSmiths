import Link from "next/link"
import { Logo } from "./Logo"

const links = [
  { href: "/", label: "Home" },
  { href: "/work", label: "Our Work" },
  { href: "/services", label: "Services" },
  { href: "/quote", label: "Get a Quote" },
]

export function Footer() {
  return (
    <footer className="border-t border-b1 px-6 py-10 md:px-12">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <Logo size={22} />
          <span className="ml-1 font-dm text-xs text-t3">Strategy. Systems. Scale.</span>
        </div>
        <nav aria-label="Footer navigation" className="flex gap-6">
          {links.map((lk) => (
            <Link key={lk.href} href={lk.href} className="text-sm text-t2 transition-colors hover:text-t1">
              {lk.label}
            </Link>
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
