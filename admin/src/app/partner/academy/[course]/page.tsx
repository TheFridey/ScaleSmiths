import { partnerObjectionsEnabled } from "@/lib/server/empower-objections"
import { partnerWorkspaceEnabled } from "@/lib/server/empower-guidance"
import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled, partnerResourcesEnabled, partnerKnowledgeEnabled } from "@/lib/server/empower-partner"
import { AcademyCourse } from "@/components/empower/AcademyCourse"
export const dynamic = "force-dynamic"
export default async function AcademyCoursePage({ params }: { params: Promise<{ course: string }> }) {
  await guardPageCapability("expansion.partner")
  if (!partnerAcademyEnabled()) notFound()
  const { course } = await params
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(course) || course.length > 120) notFound()
  return <AcademyCourse slug={course} nav={{ academy: true, resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled(), objections: partnerObjectionsEnabled(), guidance: partnerWorkspaceEnabled() }} />
}
