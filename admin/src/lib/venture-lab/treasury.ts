import { assertMinorUnits, EXPERIMENT_ZERO_CAPITAL } from "./money"

export interface SimulatedSpend {
  idempotencyKey: string
  amountMinor: number
  purpose: string
}

export interface SimulatedTreasury {
  foundingCapitalMinor: number
  protectedReserveMinor: number
  experimentAllocationMinor: number
  committedMinor: number
  spentMinor: number
  processedIdempotencyKeys: readonly string[]
}

export function createExperimentZeroTreasury(): SimulatedTreasury {
  return {
    ...EXPERIMENT_ZERO_CAPITAL,
    committedMinor: 0,
    spentMinor: 0,
    processedIdempotencyKeys: [],
  }
}

export function availableExperimentMinor(treasury: SimulatedTreasury): number {
  return treasury.experimentAllocationMinor - treasury.committedMinor - treasury.spentMinor
}

export function reserveSimulatedSpend(
  treasury: SimulatedTreasury,
  request: SimulatedSpend,
): SimulatedTreasury {
  const amount = assertMinorUnits(request.amountMinor)
  const key = request.idempotencyKey.trim()

  if (!key) throw new Error("Simulated spend requires an idempotency key.")
  if (!request.purpose.trim()) throw new Error("Simulated spend requires a purpose.")
  if (amount === 0) throw new Error("Simulated spend must be greater than zero.")
  if (treasury.processedIdempotencyKeys.includes(key)) {
    throw new Error(`Duplicate idempotency key: ${key}`)
  }

  const available = availableExperimentMinor(treasury)
  if (amount > available) {
    throw new Error(`Spend exceeds experiment allocation: requested ${amount}, available ${available}.`)
  }

  return {
    ...treasury,
    committedMinor: treasury.committedMinor + amount,
    processedIdempotencyKeys: [...treasury.processedIdempotencyKeys, key],
  }
}

export function settleSimulatedSpend(
  treasury: SimulatedTreasury,
  amountMinor: number,
): SimulatedTreasury {
  const amount = assertMinorUnits(amountMinor)
  if (amount === 0) throw new Error("Settlement must be greater than zero.")
  if (amount > treasury.committedMinor) {
    throw new Error("Cannot settle more than the currently committed simulated amount.")
  }

  return {
    ...treasury,
    committedMinor: treasury.committedMinor - amount,
    spentMinor: treasury.spentMinor + amount,
  }
}
