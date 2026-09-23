import type { VentureStatus } from "./types"

const ALLOWED_TRANSITIONS: Readonly<Record<VentureStatus, readonly VentureStatus[]>> = {
  DISCOVERED: ["RESEARCHING", "KILL"],
  RESEARCHING: ["VALIDATION_CANDIDATE", "KILL"],
  VALIDATION_CANDIDATE: ["VALIDATING", "KILL"],
  VALIDATING: ["VALIDATED", "KILL"],
  VALIDATED: ["BUILD_APPROVED", "KILL"],
  BUILD_APPROVED: ["BUILDING", "KILL"],
  BUILDING: ["QA", "KILL"],
  QA: ["LAUNCH_APPROVAL", "BUILDING", "KILL"],
  LAUNCH_APPROVAL: ["LIVE", "QA", "KILL"],
  LIVE: ["MEASURING", "KILL"],
  MEASURING: ["SCALE", "MAINTAIN", "KILL"],
  SCALE: ["MEASURING", "KILL"],
  MAINTAIN: ["MEASURING", "KILL"],
  KILL: [],
}

export function canTransitionVenture(from: VentureStatus, to: VentureStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export function assertVentureTransition(from: VentureStatus, to: VentureStatus): void {
  if (!canTransitionVenture(from, to)) {
    throw new Error(`Invalid Venture Lab transition: ${from} -> ${to}`)
  }
}

export function allowedVentureTransitions(from: VentureStatus): readonly VentureStatus[] {
  return ALLOWED_TRANSITIONS[from]
}
