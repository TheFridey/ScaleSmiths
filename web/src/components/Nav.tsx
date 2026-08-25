"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { ArrowUpRight, LogIn, Menu, X } from "lucide-react"
import { Logo } from "./Logo"
import { cn } from "@/lib/utils"
import { motionTransitions, staggerContainer, staggerItem } from "@/lib/motion"

const links = [
  { href: "/work", label: "Work" },
  { href: "/local-growth", label: "Local Growth" },
  { href: "/custom-systems", label: "Custom Systems" },
  { href: "/digital-growth-partnership", label: "Growth Partnership" },
  { href: "/about", label: "About" },
]

const serviceLink = { href: "/services/managed-business-email", label: "Managed Business Email" }
const auditLink = { href: "/services/business-growth-audit", label: "Business Growth Audit" }

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 72)
    handler()
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const panel = panelRef.current
    const focusable = panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []
    focusable[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        toggleRef.current?.focus()
        return
      }
      if (event.key !== "Tab" || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const closeMenu = () => setOpen(false)

  return (
    <header className={cn(
      "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300",
      scrolled ? "border-b1/80 bg-bg/94 shadow-[0_12px_40px_rgba(0,0,0,.18)] backdrop-blur-md" : "border-transparent bg-bg/35",
    )}>
      <nav aria-label="Main navigation" className={cn(
        "relative z-50 mx-auto flex max-w-[1320px] items-center gap-10 px-6 transition-[height] duration-300 md:px-12",
        scrolled ? "h-[62px]" : "h-[78px]",
      )}>
        <Logo showName={false} size={scrolled ? 33 : 38} />

        <div className="ml-auto hidden items-center gap-7 md:flex">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link key={link.href} href={link.href} prefetch={false} aria-current={active ? "page" : undefined}
                className={cn("group relative py-2 font-dm text-[13px] font-medium tracking-[.01em]", active ? "text-t1" : "text-t2 hover:text-t1")}>
                {link.label}
                {active ? (
                  <m.span layoutId="active-nav" className="absolute inset-x-0 -bottom-0.5 h-px bg-acc" transition={motionTransitions.ui} />
                ) : (
                  <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-t3 transition-transform duration-200 group-hover:scale-x-100" />
                )}
              </Link>
            )
          })}
          <Link href="/portal/login" prefetch={false} className="group inline-flex items-center gap-2 border-l border-b1 pl-5 font-dm text-[13px] font-medium text-t2 transition-colors hover:text-t1">
            <LogIn size={14} className="text-acc" aria-hidden="true" />
            Client Portal
            <ArrowUpRight size={12} className="text-t3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          <Link href="/quote" prefetch={false} className="btn-sm group">
            Start a Project <ArrowUpRight size={13} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </div>

        <button ref={toggleRef} type="button" className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-b1 bg-s1/70 text-t1 md:hidden"
          onClick={() => setOpen((value) => !value)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-navigation">
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      </nav>

      <AnimatePresence initial={false}>
        {open && (
          <m.div className={cn("fixed inset-x-0 bottom-0 z-40 bg-black/55 md:hidden", scrolled ? "top-[62px]" : "top-[78px]")}
            initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.18 }}
            onMouseDown={(event) => event.target === event.currentTarget && closeMenu()}>
            <m.div ref={panelRef} id="mobile-navigation" role="dialog" aria-modal="true" aria-label="Site navigation"
              className="ml-auto flex h-full w-[min(88vw,420px)] flex-col border-l border-b1 bg-bg px-7 pb-8 pt-8 shadow-2xl"
              initial={reducedMotion ? false : { x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={reducedMotion ? { duration: 0 } : motionTransitions.gentle}>
              <m.div variants={staggerContainer} initial={reducedMotion ? false : "hidden"} animate="visible" className="flex flex-col">
                {links.map((link) => (
                  <m.div key={link.href} variants={staggerItem}>
                    <Link href={link.href} prefetch={false} onClick={closeMenu} className="flex min-h-14 items-center border-b border-b1 font-syne text-xl font-bold text-t1">{link.label}</Link>
                  </m.div>
                ))}
                <m.div variants={staggerItem}>
                  <Link href={auditLink.href} prefetch={false} onClick={closeMenu} className="flex min-h-14 items-center border-b border-b1 font-syne text-lg font-bold text-t1">
                    {auditLink.label}<span className="ml-auto font-dm text-[10px] font-semibold uppercase tracking-[.1em] text-acc">£395</span>
                  </Link>
                </m.div>
                <m.div variants={staggerItem}>
                  <Link href={serviceLink.href} prefetch={false} onClick={closeMenu} className="flex min-h-14 items-center border-b border-b1 font-syne text-lg font-bold text-t1">
                    {serviceLink.label}<span className="ml-auto font-dm text-[10px] font-semibold uppercase tracking-[.1em] text-acc">From £15</span>
                  </Link>
                </m.div>
              </m.div>
              <div className="mt-auto grid gap-3 pt-8">
                <Link href="/portal/login" prefetch={false} onClick={closeMenu} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-b2 font-dm text-sm font-medium text-t1">
                  <LogIn size={15} className="text-acc" aria-hidden="true" /> Client Portal
                </Link>
                <Link href="/quote" prefetch={false} onClick={closeMenu} className="btn-sm min-h-12 justify-center">Start a Project</Link>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  )
}
