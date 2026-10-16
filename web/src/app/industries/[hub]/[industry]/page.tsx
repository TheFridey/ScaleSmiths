import { notFound } from "next/navigation"
import { IndustryPageView } from "@/components/industries/IndustryPageView"
import {
  getIndustryPage,
  metadataForIndustryPage,
  publishedIndustryPages,
} from "@/lib/industries"

export function generateStaticParams() {
  return publishedIndustryPages().map((page) => ({
    hub: page.hubSlug,
    industry: page.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hub: string; industry: string }>
}) {
  const { hub, industry } = await params
  return metadataForIndustryPage(hub, industry) ?? {}
}

export default async function IndustryDetailPage({
  params,
}: {
  params: Promise<{ hub: string; industry: string }>
}) {
  const { hub, industry } = await params
  const page = getIndustryPage(industry)
  if (!page || page.hubSlug !== hub) notFound()
  return <IndustryPageView page={page} />
}
