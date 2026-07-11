import { MfaSecurityPanel } from "@/components/MfaSecurityPanel"
import { guardPageCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"

export default async function SecurityPage() {
  await guardPageCapability("settings.manage")
  return <MfaSecurityPanel />
}
