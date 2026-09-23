import type { Metadata } from "next"
import { INSIGHT_TOPIC_CLUSTERS, insightsForTopic, type InsightTopicSlug } from "./insights"
import { buildPageMetadata } from "./page-metadata"

export function insightCategoryMetadata(topic: InsightTopicSlug): Metadata {
  const cluster = INSIGHT_TOPIC_CLUSTERS[topic]
  return buildPageMetadata({
    title: `${cluster.label} Insights`,
    description: cluster.description,
    path: `/insights/${topic}`,
    robots: insightsForTopic(topic).length ? undefined : { index: false, follow: true },
  })
}
