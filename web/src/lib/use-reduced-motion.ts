"use client"

import { useEffect, useState } from "react"
import { useReducedMotion } from "motion/react"

/**
 * Reduced-motion preference that stays false for the server render and the
 * first client render. Reading the media query during hydration swaps markup
 * and styles, so the preference is applied on the following commit.
 */
export function usePrefersReducedMotion() {
  const preferred = useReducedMotion()
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    setReduce(preferred === true)
  }, [preferred])

  return reduce
}
