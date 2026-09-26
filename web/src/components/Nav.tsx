"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { ArrowUpRight, ChevronDown, LogIn, Menu, X } from "lucide-react"
import { Logo } from "./Logo"
import { cn } from "@/lib/utils"
import { motionTransitions, staggerContainer, staggerItem } from "@/lib/motion"

/**
 * Five top-level destinations, with the service routes gathered under one group rather than
 * competing for space in the bar. Everything a visitor arriving from search needs — what we do,
 * proof, writing, who we are, and the answers — is reachable in one interaction.
 */
const serviceLinks = [
  { href: "/services", label: "All services", description: "Every route in one place, from local growth to custom systems." },
  { href: "/local-growth", label: "Local growth", description: "Websites and search work for businesses selling in a place." },
  { href: "/custom-systems", label: "Custom systems", description: "Applications, portals, integrations and automation." },
  { href: "/enterprise", label: "Enterprise", description: "Bespoke platforms for complex operational and multi-site software." },
  { href: "/digital-growth-partnership", label: "Digital Growth Partnership", description: "Ongoing, prioritised improvement after launch." },
  { href: "/services/business-growth-audit", label: "Business Growth Audit", description: "A prioritised roadmap before committing to a build." },
  { href: "/services/managed-business-email", label: "Managed Business Email", description: "Custom-domain mailboxes, configured and supported." },
]

const links = [
  { href: "/work", label: "Work" },
  { href: "/insights", label: "Insights" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
]

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)
  const pathname = usePathname()
  const reducedMotion = useReducedMotion()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const servicesRef = useRef<HTMLDivElement>(null)
  const servicesTriggerRef = useRef<HTMLButtonElement>(null)
  const servicesMenuId = useId()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 72)
    handler()
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => {
    setOpen(false)
    setServicesOpen(false)
  }, [pathname])

  // The services menu closes on Escape or on a click outside it, and returns focus to its trigger.
  useEffect(() => {
    if (!servicesOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setServicesOpen(false)
      servicesTriggerRef.current?.focus()
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!servicesRef.current?.contains(event.target as Node)) setServicesOpen(false)
    }
    const onFocusIn = (event: FocusEvent) => {
      if (!servicesRef.current?.contains(event.target as Node)) setServicesOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("focusin", onFocusIn)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("focusin", onFocusIn)
    }
  }, [servicesOpen])

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
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const servicesActive = serviceLinks.some((link) => isActive(link.href))

  return (
    <header className={cn(
      "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300",
      scrolled ? "border-b1/80 bg-bg/94 shadow-[0_12px_40px_rgba(0,0,0,.22)] backdrop-blur-md" : "border-transparent bg-bg/45 backdrop-blur-sm",
    )}>
      <nav aria-label="Main navigation" className={cn(
        "relative z-50 mx-auto flex max-w-[1320px] items-center gap-10 px-6 transition-[height] duration-300 md:px-12",
        scrolled ? "h-[62px]" : "h-[78px]",
      )}>
        <Logo showName={false} size={scrolled ? 38 : 44} />

        <div className="ml-auto hidden items-center gap-7 md:flex">
          <div
            ref={servicesRef}
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              ref={servicesTriggerRef}
              type="button"
              onClick={() => setServicesOpen(true)}
              aria-expanded={servicesOpen}
              aria-controls={servicesMenuId}
              className={cn("group relative inline-flex items-center gap-1.5 py-2 font-dm text-[13px] font-medium tracking-[.01em]", servicesActive ? "text-t1" : "text-t2 hover:text-t1")}
            >
              Services
              <ChevronDown size={13} aria-hidden="true" className={cn("transition-transform", servicesOpen && "rotate-180")} />
              {servicesActive ? (
                <m.span layoutId="active-nav" className="absolute inset-x-0 -bottom-0.5 h-px bg-acc" transition={motionTransitions.ui} />
              ) : (
                <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-t3 transition-transform duration-200 group-hover:scale-x-100" />
              )}
            </button>
            <AnimatePresence initial={false}>
              {servicesOpen ? (
                <m.div
                  id={servicesMenuId}
                  initial={reducedMotion ? false : { opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: reducedMotion ? 0 : 0.16 }}
                  className="absolute left-1/2 top-full z-50 w-[min(92vw,600px)] -translate-x-1/2 pt-4"
                >
                  <ul className="grid gap-px overflow-hidden rounded-2xl border border-b1 bg-b1 shadow-[0_24px_60px_rgba(0,0,0,.35)] sm:grid-cols-2">
                    {serviceLinks.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          prefetch={false}
                          aria-current={isActive(link.href) ? "page" : undefined}
                          className="flex h-full flex-col bg-bg px-5 py-4 transition-colors hover:bg-s1"
                        >
                          <span className={cn("font-syne text-sm font-bold", isActive(link.href) ? "text-acc" : "text-t1")}>{link.label}</span>
                          <span className="mt-1 font-dm text-xs leading-relaxed text-t3">{link.description}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </m.div>
              ) : null}
            </AnimatePresence>
          </div>

          {links.map((link) => {
            const active = isActive(link.href)
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

        <button ref={toggleRef} type="button" className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-control bg-s1/70 text-t1 md:hidden"
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
              className="ml-auto flex h-full w-[min(88vw,420px)] flex-col overflow-y-auto border-l border-b1 bg-bg px-7 pb-8 pt-8 shadow-2xl"
              initial={reducedMotion ? false : { x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={reducedMotion ? { duration: 0 } : motionTransitions.gentle}>
              <m.div variants={staggerContainer} initial={reducedMotion ? false : "hidden"} animate="visible" className="flex flex-col">
                {links.map((link) => (
                  <m.div key={link.href} variants={staggerItem}>
                    <Link href={link.href} prefetch={false} onClick={closeMenu} className="flex min-h-14 items-center border-b border-b1 font-syne text-xl font-bold text-t1">{link.label}</Link>
                  </m.div>
                ))}
                <m.p variants={staggerItem} className="pb-3 pt-7 font-dm text-[11px] font-semibold uppercase tracking-[.16em] text-t3">Services</m.p>
                {serviceLinks.map((link) => (
                  <m.div key={link.href} variants={staggerItem}>
                    <Link href={link.href} prefetch={false} onClick={closeMenu} className="flex min-h-14 items-center border-b border-b1 font-syne text-lg font-bold text-t1">
                      {link.label}
                    </Link>
                  </m.div>
                ))}
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
