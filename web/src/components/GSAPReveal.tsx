"use client"

import { ReactNode, useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

interface GSAPRevealProps {
  children: ReactNode
  className?: string
  stagger?: number
  y?: number
  delay?: number
}

export function GSAPReveal({
  children,
  className,
  stagger = 0.08,
  y = 24,
  delay = 0,
}: GSAPRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return

    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>(":scope > *", ref.current)

      gsap.fromTo(
        items,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          delay,
          duration: 0.7,
          ease: "power3.out",
          stagger,
          scrollTrigger: {
            trigger: ref.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        },
      )
    }, ref)

    return () => ctx.revert()
  }, [delay, stagger, y])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
