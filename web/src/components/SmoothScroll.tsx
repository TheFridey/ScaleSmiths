"use client"

import { createContext, ReactNode, useContext, useEffect, useState } from "react"
import Lenis from "lenis"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

interface SmoothScrollProps {
  children: ReactNode
}

export const LenisContext = createContext<Lenis | null>(null)

export function useLenis() {
  return useContext(LenisContext)
}

export function SmoothScroll({ children }: SmoothScrollProps) {
  const [lenis, setLenis] = useState<Lenis | null>(null)

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger)

    const lenisInstance = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    })

    setLenis(lenisInstance)
    lenisInstance.on("scroll", ScrollTrigger.update)

    let frame = 0
    const raf = (time: number) => {
      lenisInstance.raf(time)
      frame = requestAnimationFrame(raf)
    }

    frame = requestAnimationFrame(raf)

    return () => {
      setLenis(null)
      lenisInstance.off("scroll", ScrollTrigger.update)
      cancelAnimationFrame(frame)
      lenisInstance.destroy()
    }
  }, [])

  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
}
