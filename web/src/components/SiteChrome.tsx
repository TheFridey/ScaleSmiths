"use client"

import { ReactNode, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { PageTransition } from "@/components/PageTransition"
import { trackExperienceEvent, trackQuoteCta } from "@/lib/experience-analytics-client"

interface SiteChromeProps {
  children: ReactNode
}

export function SiteChrome({ children }: SiteChromeProps) {
  const pathname = usePathname()
  const isInteractiveJourney = pathname === "/interactive"

  useEffect(() => {
    document.documentElement.dataset.scalesmithsHydrated = "true"
    return () => {
      delete document.documentElement.dataset.scalesmithsHydrated
    }
  }, [])

  useEffect(() => {
    function captureNavigation(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.("a")
      const href = anchor?.getAttribute("href")
      if (!href) return
      if (href.startsWith("/quote")) trackQuoteCta(`link:${pathname}`)
      if (/^https?:\/\//.test(href) && !href.includes(window.location.hostname)) {
        trackExperienceEvent("navigation_exit", { metadata: { target: new URL(href).hostname } })
      }
    }

    document.addEventListener("click", captureNavigation, { capture: true })
    return () => document.removeEventListener("click", captureNavigation, { capture: true })
  }, [pathname])

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-acc focus:text-white focus:rounded-md">
        Skip to content
      </a>
      {!isInteractiveJourney && <Nav />}
      <PageTransition>
        <main id="main" tabIndex={-1}>{children}</main>
      </PageTransition>
      {!isInteractiveJourney && <Footer />}
    </>
  )
}
