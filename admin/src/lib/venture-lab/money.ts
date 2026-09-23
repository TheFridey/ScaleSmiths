const MAX_MINOR_UNITS = Number.MAX_SAFE_INTEGER

export function assertMinorUnits(value: number, field = "amountMinor"): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} must be a safe integer number of minor currency units.`)
  }
  if (value < 0) {
    throw new Error(`${field} cannot be negative.`)
  }
  if (value > MAX_MINOR_UNITS) {
    throw new Error(`${field} exceeds the safe integer boundary.`)
  }
  return value
}

export function formatGbpMinor(value: number): string {
  assertMinorUnits(value)
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value / 100)
}

export const EXPERIMENT_ZERO_CAPITAL = Object.freeze({
  foundingCapitalMinor: 10_000,
  protectedReserveMinor: 7_500,
  experimentAllocationMinor: 2_500,
})
