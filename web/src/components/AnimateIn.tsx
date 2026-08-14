"use client"
import { m, useReducedMotion } from "motion/react"
import { Children } from "react"
import { motionDistances, motionStagger, motionTransitions, reveal, staggerContainer, staggerItem } from "@/lib/motion"

interface AnimateInProps {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
}

export function AnimateIn({ children, className, delay = 0, y = 22, once = true }: AnimateInProps) {
  const reducedMotion = useReducedMotion()
  return (
    <m.div
      className={className}
      variants={reveal}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once, amount: 0.12 }}
      custom={{ distance: y || motionDistances.enter }}
      transition={{ ...motionTransitions.gentle, delay }}
    >
      {children}
    </m.div>
  )
}

interface StaggerProps {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
}

export function StaggerIn({ children, className, staggerDelay = 0.08 }: StaggerProps) {
  const reducedMotion = useReducedMotion()
  return (
    <m.div
      className={className}
      variants={{ ...staggerContainer, visible: { transition: { staggerChildren: staggerDelay || motionStagger.normal } } }}
      initial={reducedMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
    >
      {Children.map(children, (child) => <m.div variants={staggerItem}>{child}</m.div>)}
    </m.div>
  )
}
