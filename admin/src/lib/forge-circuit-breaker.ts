import { clampInt, type RetryCategory } from "./forge-retry-policy"

export type BreakerState = "closed" | "open" | "half-open"

export interface ProviderBreakerState {
  state: BreakerState
  failures: number[]
  consecutiveFailures: number
  lastCategory: RetryCategory | null
  openedAt: number | null
  opensUntil: number | null
  halfOpenInFlight: boolean
}

export interface BreakerConfig {
  failureThreshold: number
  cooldownMs: number
  windowMs: number
}

export interface BreakerTransition {
  from: BreakerState
  to: BreakerState
}

const TRIP_CATEGORIES: ReadonlySet<RetryCategory> = new Set(["rate_limit", "timeout", "unavailable", "network"])

export function isTripCategory(category: RetryCategory): boolean {
  return TRIP_CATEGORIES.has(category)
}

export function createBreakerState(): ProviderBreakerState {
  return {
    state: "closed",
    failures: [],
    consecutiveFailures: 0,
    lastCategory: null,
    openedAt: null,
    opensUntil: null,
    halfOpenInFlight: false,
  }
}

export function evaluateAttempt(
  state: ProviderBreakerState,
  now: number,
  config: BreakerConfig,
): { next: ProviderBreakerState; allowed: boolean; transition: BreakerTransition | null; reason: string } {
  if (state.state === "closed") {
    return { next: state, allowed: true, transition: null, reason: "closed" }
  }
  if (state.state === "open") {
    if (state.opensUntil !== null && now >= state.opensUntil) {
      const next: ProviderBreakerState = { ...state, state: "half-open", halfOpenInFlight: true }
      return { next, allowed: true, transition: { from: "open", to: "half-open" }, reason: "half-open probe" }
    }
    return { next: state, allowed: false, transition: null, reason: "circuit open (cooling down)" }
  }
  // half-open: allow only a single probe at a time
  if (state.halfOpenInFlight) {
    return { next: state, allowed: false, transition: null, reason: "half-open probe already in flight" }
  }
  return { next: { ...state, halfOpenInFlight: true }, allowed: true, transition: null, reason: "half-open probe" }
}

export function recordSuccess(
  state: ProviderBreakerState,
  now: number,
): { next: ProviderBreakerState; transition: BreakerTransition | null } {
  void now
  if (state.state === "half-open" || state.state === "open") {
    return {
      next: createBreakerState(),
      transition: { from: state.state, to: "closed" },
    }
  }
  return { next: { ...state, consecutiveFailures: 0 }, transition: null }
}

export function recordFailure(
  state: ProviderBreakerState,
  category: RetryCategory,
  now: number,
  config: BreakerConfig,
): { next: ProviderBreakerState; transition: BreakerTransition | null } {
  if (!isTripCategory(category)) {
    return { next: state, transition: null }
  }

  // Half-open probe failed: re-open immediately and restart the cooldown.
  if (state.state === "half-open") {
    const next: ProviderBreakerState = {
      ...state,
      state: "open",
      lastCategory: category,
      consecutiveFailures: state.consecutiveFailures + 1,
      openedAt: now,
      opensUntil: now + config.cooldownMs,
      halfOpenInFlight: false,
    }
    return { next, transition: { from: "half-open", to: "open" } }
  }

  const failures = [...state.failures.filter((ts) => now - ts < config.windowMs), now]
  const consecutiveFailures = state.consecutiveFailures + 1

  if (state.state === "closed" && failures.length >= config.failureThreshold) {
    const next: ProviderBreakerState = {
      ...state,
      state: "open",
      failures,
      consecutiveFailures,
      lastCategory: category,
      openedAt: now,
      opensUntil: now + config.cooldownMs,
      halfOpenInFlight: false,
    }
    return { next, transition: { from: "closed", to: "open" } }
  }

  return {
    next: { ...state, failures, consecutiveFailures, lastCategory: category },
    transition: null,
  }
}

export function resolveBreakerConfig(env: Record<string, string | undefined>): BreakerConfig {
  return {
    failureThreshold: clampInt(env.FORGE_AI_BREAKER_FAILURE_THRESHOLD, 5, 2, 100),
    cooldownMs: clampInt(env.FORGE_AI_BREAKER_COOLDOWN_MS, 30_000, 1_000, 600_000),
    windowMs: clampInt(env.FORGE_AI_BREAKER_WINDOW_MS, 60_000, 1_000, 3_600_000),
  }
}
