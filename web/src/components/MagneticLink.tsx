"use client"

import type { MouseEvent, ReactNode } from "react"
import Link from "next/link"
import { m, useMotionValue, useSpring } from "motion/react"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"

export function MagneticLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion()
  const x = useSpring(useMotionValue(0), { stiffness: 420, damping: 32, mass: 0.55 })
  const y = useSpring(useMotionValue(0), { stiffness: 420, damping: 32, mass: 0.55 })

  const handleMove = (event: MouseEvent<HTMLAnchorElement>) => {
    if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return
    const rect = event.currentTarget.getBoundingClientRect()
    x.set(((event.clientX - rect.left) / rect.width - 0.5) * 5)
    y.set(((event.clientY - rect.top) / rect.height - 0.5) * 4)
  }

  const reset = () => { x.set(0); y.set(0) }

  return (
    <m.div style={{ x, y }}>
      <Link href={href} prefetch={false} className={className} onMouseMove={handleMove} onMouseLeave={reset}>
        {children}
      </Link>
    </m.div>
  )
}
