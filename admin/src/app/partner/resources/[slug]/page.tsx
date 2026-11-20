import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerResourcesEnabled } from "@/lib/server/empower-partner"
import { ResourceView } from "@/components/empower/ResourceView"
export const dynamic = "force-dynamic"
export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  await guardPageCapability("expansion.partner")
  if (!partnerResourcesEnabled()) notFound()
  const { slug } = await params
  if (slug.length > 160 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound()
  return <ResourceView slug={slug} nav={{ academy: partnerAcademyEnabled(), resources: true }} />
}
