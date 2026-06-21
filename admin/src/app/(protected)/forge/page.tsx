import type { Metadata } from "next"
import { desc } from "drizzle-orm"
import { ForgeDashboard } from "@/components/forge/ForgeDashboard"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeProjects } from "@/lib/schema"

export const metadata: Metadata = { title: "Forge" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function ForgePage() {
  const [projects, recentActivity] = await Promise.all([
    db
      .select({
        id: forgeProjects.id,
        name: forgeProjects.name,
        businessName: forgeProjects.businessName,
        industry: forgeProjects.industry,
        websiteUrl: forgeProjects.websiteUrl,
        status: forgeProjects.status,
        priority: forgeProjects.priority,
        deadline: forgeProjects.deadline,
        updatedAt: forgeProjects.updatedAt,
      })
      .from(forgeProjects)
      .orderBy(desc(forgeProjects.updatedAt)),
    db
      .select({
        id: forgeActivityLogs.id,
        action: forgeActivityLogs.action,
        message: forgeActivityLogs.message,
        actor: forgeActivityLogs.actor,
        createdAt: forgeActivityLogs.createdAt,
      })
      .from(forgeActivityLogs)
      .orderBy(desc(forgeActivityLogs.createdAt))
      .limit(6),
  ])

  return <ForgeDashboard projects={projects} recentActivity={recentActivity} />
}
