"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { businessGrowthAudit } from "@/lib/business-growth-audit"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"

export function AuditAcquisitionLink({ source, className, children, start = false }: { source: "local_growth_check" | "quote"; className: string; children: ReactNode; start?: boolean }) {
  const target = `${start ? businessGrowthAudit.startPath : businessGrowthAudit.slug}?source=${source}`
  return <Link href={target} prefetch={false} className={className} onClick={() => trackExperienceEvent("quote_cta_clicked", { metadata: { source, intent: "business_growth_audit", target } })}>{children}</Link>
}
