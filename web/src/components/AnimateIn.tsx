"use client"
import { motion, useInView } from "framer-motion"
import { useRef } from "react"
export { GSAPReveal } from "./GSAPReveal"

interface AnimateInProps {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
  once?: boolean
}

export function AnimateIn({ children, className, delay = 0, y = 22, once = true }: AnimateInProps) {
  const ref = useRef(null)
  const inView = useInView(ref, { once, amount: 0.12 })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  )
}

interface StaggerProps {
  children: React.ReactNode
  className?: string
  staggerDelay?: number
}

export function StaggerIn({ children, className, staggerDelay = 0.08 }: StaggerProps) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.12 })
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: staggerDelay } },
  }
  const item = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
  }
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={container}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
            <motion.div key={i} variants={item}>{child}</motion.div>
          ))
        : <motion.div variants={item}>{children}</motion.div>
      }
    </motion.div>
  )
}
