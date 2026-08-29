import { NextResponse } from "next/server"
import { DeliveryProjectError } from "@/lib/delivery-projects"
import { AdminIdentityError } from "@/lib/admin-users"

export async function projectPayload(request: Request) {
  const value = await request.json().catch(() => null)
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DeliveryProjectError("Invalid project payload.")
  return value as Record<string, unknown>
}

export function projectId(value: string, label = "Project ID") {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new DeliveryProjectError(`${label} is invalid.`)
  return id
}

export function projectFailure(error: unknown) {
  if (error instanceof DeliveryProjectError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
  if (error instanceof AdminIdentityError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
  console.error("Delivery project operation failed", error)
  return NextResponse.json({ ok: false, error: "Unable to update delivery project." }, { status: 500 })
}
