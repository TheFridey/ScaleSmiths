"use client"

import { LazyMotion, MotionConfig } from "motion/react"

const loadFeatures = () => import("./motion-features").then((module) => module.default)

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  )
}
