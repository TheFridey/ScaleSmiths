import { notFound } from "next/navigation"
import { LegalDocument, LegalSection } from "@/components/LegalDocument"
import { PrivacyStorageControls } from "@/components/PrivacyStorageControls"
import { legalMetadata, legalRoutes, type LegalSlug } from "@/lib/legal"
import { legalPolicies } from "@/lib/legal-policies"

export function generateStaticParams() { return legalRoutes.map((slug) => ({ slug })) }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; if (!legalRoutes.includes(slug as LegalSlug)) return {}; return legalMetadata(legalPolicies[slug as LegalSlug].title, slug as LegalSlug) }
export default async function LegalPolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!legalRoutes.includes(slug as LegalSlug)) notFound()
  const policy = legalPolicies[slug as LegalSlug]
  return <LegalDocument title={policy.title} introduction={policy.introduction}>{policy.sections.map((section) => <LegalSection key={section.title} title={section.title}>{section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul className="list-disc space-y-2 pl-5">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}{slug === "cookies" && section.title === "How choices work" && <div className="pt-4"><PrivacyStorageControls /></div>}</LegalSection>)}</LegalDocument>
}
