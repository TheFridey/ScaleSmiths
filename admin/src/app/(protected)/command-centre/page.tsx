import type { Metadata } from "next"
import { guardPageCapability } from "@/lib/server/rbac"
import { CommandCentre } from "@/components/command-centre/CommandCentre"
export const metadata: Metadata = { title: "Command Centre" }
export const dynamic = "force-dynamic"
export default async function CommandCentrePage() {
  await guardPageCapability("leads.read")
  return <CommandCentre />
}
