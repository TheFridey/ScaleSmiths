"use client"

import { useReducedMotion } from "motion/react"

/**
 * Rising forge embers for the hero. Sized and lit to read clearly over the
 * molten atmosphere / video without turning into a particle blizzard.
 */
const EMBERS = [
  { x: "6%", size: 7, dur: 7.5, delay: 0, drift: "18px", opacity: 0.92 },
  { x: "12%", size: 4, dur: 9, delay: 1.4, drift: "-14px", opacity: 0.7 },
  { x: "18%", size: 9, dur: 6.8, delay: 2.8, drift: "22px", opacity: 0.95 },
  { x: "25%", size: 5, dur: 8.2, delay: 0.6, drift: "-10px", opacity: 0.78 },
  { x: "31%", size: 8, dur: 7.2, delay: 3.9, drift: "16px", opacity: 0.88 },
  { x: "38%", size: 4.5, dur: 9.5, delay: 1.9, drift: "-20px", opacity: 0.68 },
  { x: "44%", size: 10, dur: 6.5, delay: 0.3, drift: "12px", opacity: 0.98 },
  { x: "50%", size: 5.5, dur: 8.8, delay: 4.6, drift: "-16px", opacity: 0.75 },
  { x: "56%", size: 7.5, dur: 7, delay: 2.2, drift: "20px", opacity: 0.9 },
  { x: "62%", size: 4, dur: 9.2, delay: 5.1, drift: "-12px", opacity: 0.66 },
  { x: "68%", size: 9, dur: 6.9, delay: 1.1, drift: "24px", opacity: 0.94 },
  { x: "74%", size: 5, dur: 8.4, delay: 3.3, drift: "-18px", opacity: 0.8 },
  { x: "80%", size: 8, dur: 7.4, delay: 0.9, drift: "14px", opacity: 0.9 },
  { x: "86%", size: 4.5, dur: 9.8, delay: 4.2, drift: "-22px", opacity: 0.7 },
  { x: "92%", size: 7, dur: 7.8, delay: 2.5, drift: "10px", opacity: 0.86 },
  { x: "9%", size: 3.5, dur: 6.2, delay: 5.8, drift: "8px", opacity: 0.62 },
  { x: "22%", size: 3.5, dur: 6.4, delay: 4.8, drift: "-8px", opacity: 0.6 },
  { x: "47%", size: 3.5, dur: 5.8, delay: 3.6, drift: "11px", opacity: 0.64 },
  { x: "71%", size: 3.5, dur: 6.1, delay: 6.4, drift: "-9px", opacity: 0.58 },
  { x: "84%", size: 6, dur: 7.6, delay: 5.5, drift: "15px", opacity: 0.82 },
  { x: "35%", size: 6, dur: 8, delay: 6.8, drift: "-15px", opacity: 0.84 },
  { x: "58%", size: 5, dur: 7.1, delay: 7.2, drift: "13px", opacity: 0.76 },
] as const

export function HeroEmbers() {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    return <div className="hero-embers-static" aria-hidden="true" />
  }

  return (
    <div className="hero-embers" aria-hidden="true">
      {EMBERS.map((ember, index) => (
        <span
          key={index}
          className="hero-ember"
          style={{
            left: ember.x,
            ["--ember-size" as string]: `${ember.size}px`,
            ["--ember-dur" as string]: `${ember.dur}s`,
            ["--ember-delay" as string]: `${ember.delay}s`,
            ["--ember-drift" as string]: ember.drift,
            ["--ember-opacity" as string]: String(ember.opacity),
          }}
        />
      ))}
    </div>
  )
}
