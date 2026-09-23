import { InsightCategoryPage } from "@/components/insights/InsightCategoryPage"
import { insightCategoryMetadata } from "@/lib/insight-category-metadata"
export const metadata = insightCategoryMetadata("seo")
export default function Page() { return <InsightCategoryPage topic="seo" /> }
