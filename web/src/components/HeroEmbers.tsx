"use client"

import { useReducedMotion } from "motion/react"

/**
 * Sparse rising forge embers for the hero. Decorative only — disabled when
 * the visitor prefers reduced motion.
 */
const EMBERS = [
  { x: "8%", size: 3.5, dur: 11, delay: 0, drift: "12px", opacity: 0.7 },
  { x: "16%", size: 2.5, dur: 13, delay: 2.1, drift: "-10px", opacity: 0.5 },
  { x: "24%", size: 4.5, dur: 10, delay: 4.4, drift: "18px", opacity: 0.75 },
  { x: "33%", size: 2.5, dur: 14, delay: 1.2, drift: "-6px", opacity: 0.55 },
  { x: "41%", size: 4, dur: 12, delay: 5.8, drift: "14px", opacity: 0.62 },
  { x: "49%", size: 2.5, dur: 15, delay: 3.3, drift: "-16px", opacity: 0.48 },
  { x: "57%", size: 3.5, dur: 11.5, delay: 0.7, drift: "8px", opacity: 0.7 },
  { x: "64%", size: 3, dur: 13.5, delay: 6.2, drift: "-12px", opacity: 0.52 },
  { x: "72%", size: 4.5, dur: 10.5, delay: 2.8, drift: "20px", opacity: 0.72 },
  { x: "79%", size: 2.5, dur: 14.5, delay: 4.9, drift: "-8px", opacity: 0.45 },
  { x: "86%", size: 3.5, dur: 12.5, delay: 1.6, drift: "10px", opacity: 0.64 },
  { x: "93%", size: 3, dur: 13, delay: 7.1, drift: "-14px", opacity: 0.55 },
  { x: "12%", size: 2, dur: 9.5, delay: 8.2, drift: "6px", opacity: 0.4 },
  { x: "68%", size: 2, dur: 9, delay: 5.1, drift: "-5px", opacity: 0.38 },
  { x: "38%", size: 2, dur: 10.5, delay: 9.4, drift: "9px", opacity: 0.42 },
  { x: "82%", size: 2, dur: 11, delay: 3.9, drift: "-11px", opacity: 0.4 },
] as const

export function HeroEmbers() {
  const reducedMotion = useReducedMotion()

  if (reducedMotion) {
    // Static glow only — no animation when motion is reduced
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
            // CSS custom properties for the keyframe animation
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
