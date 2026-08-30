import { NextResponse } from "next/server"
import { ProspectConversionError } from "@/lib/prospect-conversion"
import { AdminIdentityError } from "@/lib/admin-users"

export function parseId(value: string) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new ProspectConversionError("Invalid prospect id.", 400, "invalid_id")
  return id
}

export function conversionFailure(error: unknown) {
  if (error instanceof ProspectConversionError) return NextResponse.json({ ok: false, error: error.safeMessage }, { status: error.status })
  if (error instanceof AdminIdentityError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
  console.error("Prospect conversion failed", error)
  return NextResponse.json({ ok: false, error: "Unable to convert this opportunity." }, { status: 500 })
}
