"use client"

import { useEffect } from "react"
import { motion, useMotionValue, useSpring } from "framer-motion"
import { useLenis } from "./SmoothScroll"

export function ScrollProgress() {
  const lenis = useLenis()
  const progress = useMotionValue(0)
  const scaleX = useSpring(progress, { stiffness: 100, damping: 30 })

  useEffect(() => {
    if (!lenis) return

    const handleScroll = ({ progress: nextProgress }: { progress: number }) => {
      progress.set(nextProgress)
    }

    progress.set(lenis.progress)
    lenis.on("scroll", handleScroll)

    return () => {
      lenis.off("scroll", handleScroll)
    }
  }, [lenis, progress])

  return (
    <motion.div
      aria-hidden="true"
      className="fixed left-0 top-0 h-[2px] w-full origin-left"
      style={{ scaleX, zIndex: 200, backgroundColor: "var(--acc)" }}
    />
  )
}
