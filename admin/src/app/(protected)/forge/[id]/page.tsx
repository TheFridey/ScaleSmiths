import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ForgeProjectDetail } from "@/components/forge/ForgeProjectDetail"
import { loadForgeProjectPageData } from "@/lib/server/forge-page-data"

export const metadata: Metadata = { title: "Forge Project" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export default async function ForgeProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) notFound()

  const data = await loadForgeProjectPageData(id)

  if (!data) notFound()

  return <ForgeProjectDetail {...data} />
}
