import { InsightCategoryPage } from "@/components/insights/InsightCategoryPage"
import { insightCategoryMetadata } from "@/lib/insight-category-metadata"
export const metadata = insightCategoryMetadata("infrastructure")
export default function Page() { return <InsightCategoryPage topic="infrastructure" /> }
