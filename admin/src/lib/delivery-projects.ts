export const DELIVERY_PROJECT_STATUSES = ["active", "paused", "completed", "cancelled"] as const
export const DELIVERY_PROJECT_PHASES = ["discovery", "strategy", "design", "build", "review", "launch", "ongoing"] as const
export const DELIVERY_MILESTONE_STATUSES = ["planned", "active", "blocked", "completed", "skipped"] as const
export const DELIVERY_DELIVERABLE_STATUSES = ["planned", "in_progress", "in_review", "approved", "delivered", "cancelled"] as const
export const DELIVERY_DECISION_STATUSES = ["open", "resolved", "cancelled"] as const

export type DeliveryProjectStatus = (typeof DELIVERY_PROJECT_STATUSES)[number]
export type DeliveryProjectPhase = (typeof DELIVERY_PROJECT_PHASES)[number]
export type DeliveryMilestoneStatus = (typeof DELIVERY_MILESTONE_STATUSES)[number]
export type DeliveryDeliverableStatus = (typeof DELIVERY_DELIVERABLE_STATUSES)[number]
export type DeliveryDecisionStatus = (typeof DELIVERY_DECISION_STATUSES)[number]

const PROJECT_TRANSITIONS: Record<DeliveryProjectStatus, readonly DeliveryProjectStatus[]> = {
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: [],
  cancelled: [],
}

const MILESTONE_TRANSITIONS: Record<DeliveryMilestoneStatus, readonly DeliveryMilestoneStatus[]> = {
  planned: ["active", "blocked", "completed", "skipped"],
  active: ["blocked", "completed", "skipped"],
  blocked: ["active", "completed", "skipped"],
  completed: [],
  skipped: [],
}

const DELIVERABLE_TRANSITIONS: Record<DeliveryDeliverableStatus, readonly DeliveryDeliverableStatus[]> = {
  planned: ["in_progress", "cancelled"],
  in_progress: ["in_review", "cancelled"],
  in_review: ["in_progress", "approved", "cancelled"],
  approved: ["delivered"],
  delivered: [],
  cancelled: [],
}

export class DeliveryProjectError extends Error {
  constructor(message: string, public readonly status = 400) { super(message) }
}

export function calculateProjectProgress(milestones: readonly { status: DeliveryMilestoneStatus; weight: number }[]) {
  const included = milestones.filter((milestone) => milestone.status !== "skipped")
  const totalWeight = included.reduce((sum, milestone) => sum + milestone.weight, 0)
  if (totalWeight === 0) return 0
  const completedWeight = included.reduce((sum, milestone) => sum + (milestone.status === "completed" ? milestone.weight : 0), 0)
  return Math.round((completedWeight / totalWeight) * 100)
}

export function assertProjectTransition(from: DeliveryProjectStatus, to: DeliveryProjectStatus) {
  if (from === to) return
  if (!PROJECT_TRANSITIONS[from].includes(to)) throw new DeliveryProjectError(`Project cannot move from ${from} to ${to}.`, 409)
}

export function assertMilestoneTransition(from: DeliveryMilestoneStatus, to: DeliveryMilestoneStatus) {
  if (from === to) return
  if (!MILESTONE_TRANSITIONS[from].includes(to)) throw new DeliveryProjectError(`Milestone cannot move from ${from} to ${to}.`, 409)
}

export function assertDeliverableTransition(from: DeliveryDeliverableStatus, to: DeliveryDeliverableStatus) {
  if (from === to) return
  if (!DELIVERABLE_TRANSITIONS[from].includes(to)) throw new DeliveryProjectError(`Deliverable cannot move from ${from} to ${to}.`, 409)
}

export function requiredText(value: unknown, label: string, maxLength = 180) {
  if (typeof value !== "string" || !value.trim()) throw new DeliveryProjectError(`${label} is required.`)
  return value.trim().slice(0, maxLength)
}

export function optionalText(value: unknown, maxLength = 4000) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null
}

export function optionalPositiveId(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new DeliveryProjectError(`${label} must be a positive integer.`)
  return id
}

export function optionalUuid(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new DeliveryProjectError(`${label} is invalid.`)
  return value
}

export function optionalDate(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new DeliveryProjectError(`${label} is invalid.`)
  return date
}

export function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new DeliveryProjectError(`${label} is invalid.`)
  return value as T
}

export function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  return fallback
}

export function positionValue(value: unknown, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback
  const position = Number(value)
  if (!Number.isInteger(position) || position < 0) throw new DeliveryProjectError("Position must be zero or greater.")
  return position
}

export function weightValue(value: unknown, fallback = 1) {
  if (value === undefined || value === null || value === "") return fallback
  const weight = Number(value)
  if (!Number.isInteger(weight) || weight <= 0 || weight > 100) throw new DeliveryProjectError("Milestone weight must be between 1 and 100.")
  return weight
}
