"use client"

import { useReportWebVitals } from "next/web-vitals"
import { trackExperienceEvent } from "@/lib/experience-analytics-client"

const RATINGS = new Set(["good", "needs-improvement", "poor"])

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    trackExperienceEvent("web_vital", {
      metadata: {
        target: metric.name,
        metric: metric.name,
        value: Math.round(metric.value * 100) / 100,
        rating: RATINGS.has(metric.rating) ? metric.rating : "unknown",
        navigationType: metric.navigationType,
      },
    })
  })
  return null
}
