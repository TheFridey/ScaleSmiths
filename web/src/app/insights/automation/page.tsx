import { InsightCategoryPage } from "@/components/insights/InsightCategoryPage"
import { insightCategoryMetadata } from "@/lib/insight-category-metadata"
export const metadata = insightCategoryMetadata("automation")
export default function Page() { return <InsightCategoryPage topic="automation" /> }
