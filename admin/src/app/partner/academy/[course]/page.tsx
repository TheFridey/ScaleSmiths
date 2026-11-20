import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { partnerAcademyEnabled } from "@/lib/server/empower-academy"
import { AcademyCourse } from "@/components/empower/AcademyCourse"
export const dynamic = "force-dynamic"
export default async function AcademyCoursePage({ params }: { params: Promise<{ course: string }> }) {
  await guardPageCapability("expansion.partner")
  if (!partnerAcademyEnabled()) notFound()
  const { course } = await params
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(course) || course.length > 120) notFound()
  return <AcademyCourse slug={course} />
}
