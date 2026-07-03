"use client"

import { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Nav } from "@/components/Nav"
import { Footer } from "@/components/Footer"
import { PageTransition } from "@/components/PageTransition"

interface SiteChromeProps {
  children: ReactNode
}

export function SiteChrome({ children }: SiteChromeProps) {
  const pathname = usePathname()
  const isInteractiveJourney = pathname === "/interactive"

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-acc focus:text-white focus:rounded-md">
        Skip to content
      </a>
      {!isInteractiveJourney && <Nav />}
      <PageTransition>
        <main id="main">{children}</main>
      </PageTransition>
      {!isInteractiveJourney && <Footer />}
    </>
  )
}
