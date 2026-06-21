import type { Metadata } from "next"
import { ForgeProjectForm } from "@/components/forge/ForgeProjectForm"

export const metadata: Metadata = { title: "New Forge Project" }

export default function NewForgeProjectPage() {
  return <ForgeProjectForm mode="create" />
}
