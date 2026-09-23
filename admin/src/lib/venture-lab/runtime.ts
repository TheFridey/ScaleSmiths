export interface VentureLabRuntimeState {
  paused: boolean
  pausedAt?: string | null
  pausedBy?: string | null
  pauseReason?: string | null
}

export function assertAgentMutationAllowed(state: VentureLabRuntimeState): void {
  if (state.paused) {
    throw new Error("Venture Lab is paused. Agent-originated mutations are blocked.")
  }
}

export function activateEmergencyStop(
  current: VentureLabRuntimeState,
  actorId: string,
  reason: string,
  at = new Date().toISOString(),
): VentureLabRuntimeState {
  if (!actorId.trim()) throw new Error("Emergency STOP requires an authenticated actor.")
  if (!reason.trim()) throw new Error("Emergency STOP requires a reason.")

  if (current.paused) return current

  return {
    paused: true,
    pausedAt: at,
    pausedBy: actorId,
    pauseReason: reason.trim(),
  }
}

export function resumeVentureLab(
  current: VentureLabRuntimeState,
  actorId: string,
): VentureLabRuntimeState {
  if (!actorId.trim()) throw new Error("Resume requires an authenticated human actor.")
  if (!current.paused) return current

  return {
    paused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
  }
}
