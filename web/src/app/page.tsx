import { Hero }         from "@/components/Hero"
import { Ticker }       from "@/components/Ticker"
import { Services }     from "@/components/Services"
import { Process }      from "@/components/Process"
import { ClientPortalSection } from "@/components/ClientPortalSection"
import { Portfolio }    from "@/components/Portfolio"
import { ProofSection } from "@/components/ProofSection"
import { FitSection }   from "@/components/FitSection"
import { BuildProofBlocks } from "@/components/BuildProofBlocks"
import { Testimonials } from "@/components/Testimonials"
import { TechStack }    from "@/components/TechStack"
import { FAQ }          from "@/components/FAQ"
import { CTA }          from "@/components/CTA"
import { InlineCTA }    from "@/components/InlineCTA"

export default function HomePage() {
  return (
    <>
      <Hero />
      <InlineCTA
        label="Start smart"
        title="Know what to build before you spend."
        body="Send the brief and we will map the highest-leverage route: site, store, portal, app, or infrastructure."
      />
      <Ticker />
      <BuildProofBlocks />
      <Services />
      <InlineCTA
        label="Scope"
        title="Not sure which tier fits?"
        body="We will recommend the smallest build that can still move the business outcome you care about."
      />
      <Process />
      <ClientPortalSection />
      <Portfolio limit={2} />
      <InlineCTA
        label="Proof to plan"
        title="Want your version of this?"
        body="Bring the business problem. We will turn the relevant proof into a practical project shape."
      />
      <ProofSection />
      <FitSection />
      <Testimonials />
      <TechStack />
      <FAQ />
      <InlineCTA
        label="Questions answered"
        title="Ready for the honest version?"
        body="A strategy call will tell you what to build, what to avoid, and what budget makes sense."
      />
      <CTA />
    </>
  )
}
