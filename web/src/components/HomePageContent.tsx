import { ClientTrustStrip } from "@/components/ClientTrustStrip"
import { CTA } from "@/components/CTA"
import { ExperienceQuerySync } from "@/components/ExperiencePreference"
import { FAQ } from "@/components/FAQ"
import { FeaturedCaseStudy, FEATURED_CASE_STUDY_SLUG } from "@/components/FeaturedCaseStudy"
import { FitSection } from "@/components/FitSection"
import { FoundersSection } from "@/components/FoundersSection"
import { Hero } from "@/components/Hero"
import { HeroApproachBand } from "@/components/HeroApproachBand"
import { DigitalEstate } from "@/components/DigitalEstate"
import { ClientPortalSection } from "@/components/ClientPortalSection"
import { BuildProofBlocks } from "@/components/BuildProofBlocks"
import { EntryProducts } from "@/components/EntryProducts"
import { Portfolio } from "@/components/Portfolio"
import { Process } from "@/components/Process"
import { Services } from "@/components/Services"
import { ServiceRouteChooser } from "@/components/ServiceRouteChooser"
import { Testimonials } from "@/components/Testimonials"
import { faqs } from "@/lib/data"
import { libraryFaqs } from "@/lib/faq-library"
import { publishedStartingPrices } from "@/lib/published-starting-prices"
import { publicClaimMap, selectVerifiedPublicClaims, type PublicClaim } from "@/lib/public-claims"
import { getVerifiedPublicClaims } from "@/lib/public-claims.server"
import { JsonLd } from "@/components/JsonLd"
import { buildFaqSchema } from "@/lib/structured-data"

export async function HomePageContent() {
  const publicClaims = await getVerifiedPublicClaims({ route: "/" })
  const heroClaims = mapForComponents(publicClaims, "hero_stats")
  const serviceClaims = mapForComponents(publicClaims, "services_intro", "service_pricing", "retainer_pricing")
  const processClaims = mapForComponents(publicClaims, "process")
  const faqClaims = mapForComponents(publicClaims, "faq")
  const heroStats = ["hero.projects-delivered", "hero.revenue-generated"]
    .map((id) => heroClaims.get(id)?.approvedWording)
    .filter((value): value is string => Boolean(value))
  const testimonials = selectVerifiedPublicClaims(publicClaims, { route: "/", component: "testimonials" })
    .filter((claim) => ["testimonial", "attributed_quote", "paid_for_itself"].includes(claim.claimType))
    .filter((claim) => claim.attributionName && claim.attributionBusiness)
    .map((claim) => ({ id: claim.id, quote: claim.approvedWording, name: claim.attributionName as string, business: claim.attributionBusiness as string }))

  const faqItems = [
    ...faqs.map((faq) => faq.q === "How much does a website cost?"
      ? { ...faq, a: verifiedPricingAnswer(faqClaims) }
      : faq.q === "How long does a project take?"
        ? { ...faq, a: verifiedTimelineAnswer(faqClaims) }
        : faq),
    ...libraryFaqs(["website-included", "after-enquiry", "improvement-measurement"]),
  ]

  // Problem and offer first, then proof, then the detailed routes.
  return (
    <>
      <JsonLd data={buildFaqSchema(faqItems)} />
      <ExperienceQuerySync />
      <Hero />
      <HeroApproachBand verifiedStats={heroStats} />
      <ClientTrustStrip />
      <Portfolio limit={2} excludeSlugs={[FEATURED_CASE_STUDY_SLUG]} />
      <ServiceRouteChooser compact />
      <Services claims={serviceClaims} />
      <EntryProducts />
      <FoundersSection />
      <Testimonials testimonials={testimonials} />
      <FeaturedCaseStudy />
      <BuildProofBlocks />
      <Process verifiedDeliveryClaim={processClaims.get("process.built-on-time")?.approvedWording} />
      <DigitalEstate />
      <ClientPortalSection />
      <FitSection />
      <FAQ items={faqItems} />
      <CTA />
    </>
  )
}

function mapForComponents(claims: readonly PublicClaim[], ...components: string[]) {
  const selected = components.flatMap((component) => selectVerifiedPublicClaims(claims, { route: "/", component }))
  return publicClaimMap([...new Map(selected.map((claim) => [claim.id, claim])).values()])
}

function verifiedPricingAnswer(claims: ReturnType<typeof publicClaimMap>) {
  const starting = publishedStartingPrices
    .map((item) => `${item.name}: ${item.priceLabel}`)
    .join(". ")
  const values = ["price.foundation", "price.growth", "price.forge"]
    .map((id) => claims.get(id)?.approvedWording)
    .filter((value): value is string => Boolean(value))
  const verified = values.length === 3
    ? ` Additional verified guidance: Foundation ${values[0]}; Growth ${values[1]}; Forge ${values[2]}.`
    : ""
  return `${starting}. A starting price is the entry point for an agreed scope, not unlimited work or a guaranteed outcome. The written proposal sets the price.${verified}`
}

function verifiedTimelineAnswer(claims: ReturnType<typeof publicClaimMap>) {
  const values = ["timeline.foundation", "timeline.growth", "timeline.forge"]
    .map((id) => claims.get(id)?.approvedWording)
    .filter((value): value is string => Boolean(value))
  return values.length === 3
    ? `${values.join(" ")} The agreed proposal records the delivery assumptions.`
    : "Delivery timing is confirmed after discovery because content readiness, integrations, review cycles and technical risk materially affect the schedule."
}
