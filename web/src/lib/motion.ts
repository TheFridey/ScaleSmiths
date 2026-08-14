import type { Transition, Variants } from "motion/react"

export const motionTransitions = {
  snap: { type: "spring", stiffness: 520, damping: 38, mass: 0.55 },
  ui: { type: "spring", stiffness: 360, damping: 32, mass: 0.7 },
  gentle: { type: "spring", stiffness: 190, damping: 26, mass: 0.9 },
  lively: { type: "spring", stiffness: 300, damping: 24, mass: 0.75 },
  ambient: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
} satisfies Record<string, Transition>

export const motionDistances = {
  micro: 4,
  enter: 22,
  section: 44,
} as const

export const motionStagger = {
  tight: 0.05,
  normal: 0.08,
  relaxed: 0.12,
} as const

export const motionDurations = {
  instant: 0.12,
  ui: 0.2,
  gentle: 0.48,
  ambient: 0.72,
} as const

export const reveal: Variants = {
  hidden: (custom?: { distance?: number }) => ({ opacity: 0, y: custom?.distance ?? motionDistances.enter }),
  visible: { opacity: 1, y: 0, transition: motionTransitions.gentle },
}

export const revealSoft: Variants = {
  hidden: { opacity: 0, y: motionDistances.micro },
  visible: { opacity: 1, y: 0, transition: motionTransitions.ambient },
}

export const revealMask: Variants = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: "0%", transition: motionTransitions.ambient },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: motionStagger.normal } },
}

export const staggerItem: Variants = reveal

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: motionDurations.gentle } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: motionTransitions.gentle },
}

export const slideIn: Variants = {
  hidden: { opacity: 0, x: motionDistances.enter },
  visible: { opacity: 1, x: 0, transition: motionTransitions.gentle },
}

export const sharedLayout = { layout: true } as const

export const routeTransition: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: motionDurations.ui } },
  exit: { opacity: 0, transition: { duration: motionDurations.instant } },
}
