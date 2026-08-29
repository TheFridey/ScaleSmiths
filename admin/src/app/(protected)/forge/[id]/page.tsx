import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ForgeProjectDetail } from "@/components/forge/ForgeProjectDetail"
import { loadForgeProjectPageData } from "@/lib/server/forge-page-data"
import { getDeliveryProjectLinkForForge } from "@/lib/server/delivery-project-service"

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

  const [data, deliveryProject] = await Promise.all([loadForgeProjectPageData(id), getDeliveryProjectLinkForForge(id)])

  if (!data) notFound()

  return <div className="space-y-4">
    {deliveryProject ? <div className="rounded-xl border border-acc/30 bg-acc/10 px-4 py-3 text-sm"><span className="text-t2">Delivery project:</span>{" "}<Link href={`/projects/${deliveryProject.id}`} className="font-semibold text-acc hover:underline">{deliveryProject.name}</Link><span className="ml-2 text-xs text-t3">{deliveryProject.currentPhase} · {deliveryProject.status}</span></div> : null}
    <ForgeProjectDetail {...data} />
  </div>
}
