import { BuildProofBlocks } from "@/components/BuildProofBlocks"
import { CTA } from "@/components/CTA"
import { ClientPortalSection } from "@/components/ClientPortalSection"
import { FAQ } from "@/components/FAQ"
import { FitSection } from "@/components/FitSection"
import { Hero } from "@/components/Hero"
import { InlineCTA } from "@/components/InlineCTA"
import { Portfolio } from "@/components/Portfolio"
import { Process } from "@/components/Process"
import { ProofSection } from "@/components/ProofSection"
import { Services } from "@/components/Services"
import { TechStack } from "@/components/TechStack"
import { Testimonials } from "@/components/Testimonials"
import { Ticker } from "@/components/Ticker"
import { faqs } from "@/lib/data"
import { publicClaimMap, selectVerifiedPublicClaims, type PublicClaim } from "@/lib/public-claims"
import { getVerifiedPublicClaims } from "@/lib/public-claims.server"

export async function HomePageContent() {
  const publicClaims = await getVerifiedPublicClaims({ route: "/" })
  const heroClaims = mapForComponents(publicClaims, "hero_stats")
  const serviceClaims = mapForComponents(publicClaims, "services_intro", "service_pricing", "retainer_summary", "retainer_pricing")
  const processClaims = mapForComponents(publicClaims, "process")
  const portalClaims = mapForComponents(publicClaims, "client_portal")
  const projectClaims = mapForComponents(publicClaims, "project_outcomes")
  const faqClaims = mapForComponents(publicClaims, "faq")
  const heroStats = ["hero.projects-delivered", "hero.revenue-generated", "hero.retainer-retention-rate"]
    .map((id) => heroClaims.get(id)?.approvedWording)
    .filter((value): value is string => Boolean(value))
  const testimonials = selectVerifiedPublicClaims(publicClaims, { route: "/", component: "testimonials" })
    .filter((claim) => ["testimonial", "attributed_quote", "paid_for_itself"].includes(claim.claimType))
    .filter((claim) => claim.attributionName && claim.attributionBusiness)
    .map((claim) => ({ id: claim.id, quote: claim.approvedWording, name: claim.attributionName as string, business: claim.attributionBusiness as string }))

  return (
    <>
      <Hero verifiedStats={heroStats} />
      <InlineCTA
        label="Start smart"
        title="Know what to build before you spend."
        body="Send the brief and we will map the highest-leverage route: site, store, portal, app, or infrastructure."
      />
      <Ticker />
      <BuildProofBlocks />
      <Services claims={serviceClaims} />
      <InlineCTA
        label="Scope"
        title="Not sure which tier fits?"
        body="We will recommend the smallest build that can still move the business outcome you care about."
      />
      <Process verifiedDeliveryClaim={processClaims.get("process.built-on-time")?.approvedWording} verifiedRetentionClaim={processClaims.get("process.most-clients-retain")?.approvedWording} />
      <ClientPortalSection verifiedAvailabilityClaim={portalClaims.get("portal.every-active-client")?.approvedWording} />
      <Portfolio limit={2} />
      <InlineCTA
        label="Proof to plan"
        title="Want your version of this?"
        body="Bring the business problem. We will turn the relevant proof into a practical project shape."
      />
      <ProofSection claims={projectClaims} />
      <FitSection />
      <Testimonials testimonials={testimonials} />
      <TechStack />
      <FAQ items={faqs.map((faq) => faq.q === "How much does a website cost?"
        ? { ...faq, a: verifiedPricingAnswer(faqClaims) }
        : faq.q === "How long does a project take?"
          ? { ...faq, a: verifiedTimelineAnswer(faqClaims) }
          : faq)} />
      <InlineCTA
        label="Questions answered"
        title="Ready for the honest version?"
        body="A strategy call will tell you what to build, what to avoid, and what budget makes sense."
      />
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
