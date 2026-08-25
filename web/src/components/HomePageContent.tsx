import { CTA } from "@/components/CTA"
import { FAQ } from "@/components/FAQ"
import { FitSection } from "@/components/FitSection"
import { Hero } from "@/components/Hero"
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
import { publicClaimMap, selectVerifiedPublicClaims, type PublicClaim } from "@/lib/public-claims"
import { getVerifiedPublicClaims } from "@/lib/public-claims.server"

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

  return (
    <>
      <Hero verifiedStats={heroStats} />
      <ServiceRouteChooser compact />
      <BuildProofBlocks />
      <EntryProducts />
      <Testimonials testimonials={testimonials} />
      <Services claims={serviceClaims} />
      <DigitalEstate />
      <ClientPortalSection />
      <Portfolio limit={2} />
      <FitSection />
      <Process verifiedDeliveryClaim={processClaims.get("process.built-on-time")?.approvedWording} />
      <FAQ items={faqs.map((faq) => faq.q === "How much does a website cost?"
        ? { ...faq, a: verifiedPricingAnswer(faqClaims) }
        : faq.q === "How long does a project take?"
          ? { ...faq, a: verifiedTimelineAnswer(faqClaims) }
          : faq)} />
      <CTA />
    </>
  )
}

function mapForComponents(claims: readonly PublicClaim[], ...components: string[]) {
  const selected = components.flatMap((component) => selectVerifiedPublicClaims(claims, { route: "/", component }))
  return publicClaimMap([...new Map(selected.map((claim) => [claim.id, claim])).values()])
}

function verifiedPricingAnswer(claims: ReturnType<typeof publicClaimMap>) {
  const values = ["price.foundation", "price.growth", "price.forge"]
    .map((id) => claims.get(id)?.approvedWording)
    .filter((value): value is string => Boolean(value))
  return values.length === 3
    ? `Current verified guidance: Foundation ${values[0]}; Growth ${values[1]}; Forge ${values[2]}. Final pricing follows a scoped proposal.`
    : "Project pricing is scoped from the agreed outcome, complexity, integrations, content and delivery risk. Any current verified guidance appears on the pricing page."
}

function verifiedTimelineAnswer(claims: ReturnType<typeof publicClaimMap>) {
  const values = ["timeline.foundation", "timeline.growth", "timeline.forge"]
    .map((id) => claims.get(id)?.approvedWording)
    .filter((value): value is string => Boolean(value))
  return values.length === 3
    ? `${values.join(" ")} The agreed proposal records the delivery assumptions.`
    : "Delivery timing is confirmed after discovery because content readiness, integrations, review cycles and technical risk materially affect the schedule."
}
