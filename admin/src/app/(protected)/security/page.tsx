import type { Metadata } from "next"
import { MfaSecurityPanel } from "@/components/MfaSecurityPanel"
import { guardPageCapability } from "@/lib/server/rbac"

export const metadata: Metadata = { title: "Security" }

export const dynamic = "force-dynamic"

export default async function SecurityPage() {
  await guardPageCapability("settings.manage")
  return <MfaSecurityPanel />
}
