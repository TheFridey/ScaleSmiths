import type { Metadata } from "next"
import { ForgeProjectIntake } from "@/components/forge/ForgeProjectIntake"

export const metadata: Metadata = { title: "New Forge Project" }

export default function NewForgeProjectPage() {
  return <ForgeProjectIntake />
}
