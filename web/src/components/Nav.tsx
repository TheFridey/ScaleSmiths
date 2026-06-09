"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogIn, Menu, X } from "lucide-react"
import { Logo } from "./Logo"
import { cn } from "@/lib/utils"

const links = [
  { href: "/work", label: "Our Work" },
  { href: "/services", label: "Services" },
  { href: "/quote", label: "Get a Quote" },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  function NavLink({ lk, onClick }: { lk: (typeof links)[number]; onClick?: () => void }) {
    return (
      <Link
        href={lk.href}
        prefetch={false}
        aria-current={pathname === lk.href ? "page" : undefined}
        className={cn(
          "text-sm font-medium transition-colors",
          pathname === lk.href ? "text-t1" : "text-t2 hover:text-t1",
        )}
        onClick={onClick}
      >
        {lk.label}
      </Link>
    )
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-bg/90 backdrop-blur-xl border-b border-b1"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <nav
        aria-label="Main navigation"
        className="max-w-[1240px] mx-auto px-6 md:px-12 h-[70px] flex items-center gap-10"
      >
        <Logo showName={false} size={38} />

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8 ml-auto">
          {links.map((lk) => (
            <NavLink key={lk.href} lk={lk} />
          ))}
          <Link
            href="/portal/login"
            prefetch={false}
            className="inline-flex items-center gap-1.5 rounded-lg border border-b2 px-4 py-2 font-dm text-sm font-medium text-t2 transition-colors hover:border-b3 hover:bg-s2 hover:text-t1"
          >
            <LogIn size={14} aria-hidden="true" />
            Your Portal
          </Link>
          <Link href="/quote" prefetch={false} className="btn-sm">
            Start a Project
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden ml-auto text-t2"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-s1 border-b border-b1 px-6 py-4 flex flex-col gap-4">
          {links.map((lk) => (
            <NavLink key={lk.href} lk={lk} onClick={() => setOpen(false)} />
          ))}
          <Link
            href="/portal/login"
            prefetch={false}
            className="flex items-center justify-center gap-2 rounded-lg border border-b2 px-4 py-2.5 font-dm text-sm font-medium text-t2"
            onClick={() => setOpen(false)}
          >
            <LogIn size={15} aria-hidden="true" />
            Your Portal
          </Link>
          <Link href="/quote" prefetch={false} className="btn-sm text-center" onClick={() => setOpen(false)}>
            Start a Project
          </Link>
        </div>
      )}
    </header>
  )
}
