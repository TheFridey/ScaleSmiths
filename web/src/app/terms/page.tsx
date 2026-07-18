import Link from "next/link"
import { LegalDocument, LegalSection } from "@/components/LegalDocument"
import { PRIVACY_CONTACT_EMAIL, termsMetadata } from "@/lib/legal"

export const metadata = termsMetadata

export default function TermsPage() {
  return (
    <LegalDocument
      title="Website terms"
      introduction="These terms apply when you browse scalesmiths.co.uk, submit an enquiry, or use the ScaleSmiths client portal. A signed proposal, statement of work, or client agreement may add to or replace parts of these terms for paid services."
    >
      <LegalSection title="About ScaleSmiths">
        <p>ScaleSmiths is a digital services business operating from Hucknall, Nottinghamshire, United Kingdom. Contact us at <a className="text-t1 underline underline-offset-2" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.</p>
      </LegalSection>

      <LegalSection title="Using this website">
        <p>You may use this website for lawful personal or business evaluation of ScaleSmiths services. You must not attempt to defeat access controls, probe or disrupt infrastructure, introduce malicious code, scrape at a level that impairs the service, impersonate another person, or use forms and portal routes for spam, fraud, unlawful content, or unauthorised access.</p>
        <p>We may restrict abusive traffic, suspend compromised portal access, and preserve evidence needed to investigate security incidents.</p>
      </LegalSection>

      <LegalSection title="Enquiries, proposals, and contracts">
        <p>Submitting an enquiry asks ScaleSmiths to review and contact you about the proposed work. It does not create a contract, reserve delivery capacity, or oblige either party to proceed.</p>
        <p>Website pricing, timelines, examples, and service descriptions are general guidance. A binding scope, price, delivery plan, assumptions, dependencies, intellectual-property position, support arrangement, and payment schedule must be agreed in the applicable proposal or contract.</p>
        <p>You are responsible for ensuring information you provide is accurate and that you have authority to share it. Do not submit unnecessary special-category information, passwords, API keys, payment-card data, or other secrets through an enquiry form.</p>
      </LegalSection>

      <LegalSection title="Client portal">
        <p>Portal access is limited to authorised clients and their approved users. Credentials are personal to the recipient, must be protected, and must not be shared outside the authorised team. Tell ScaleSmiths promptly if credentials or a portal session may be compromised.</p>
        <p>Portal requests, messages, approvals, reports, and timestamps may form part of the project delivery record. Internal notes and Forge records are not necessarily visible in the client portal. Portal availability and response targets are governed by the relevant client agreement where one exists.</p>
      </LegalSection>

      <LegalSection title="Content and intellectual property">
        <p>Unless a separate agreement states otherwise, ScaleSmiths owns or licenses the website design, software, branding, text, graphics, and other materials on this site. You may view and make reasonable internal copies for evaluating our services, but may not reproduce, sell, publish, reverse engineer, or create a competing derivative from protected materials without permission.</p>
        <p>Names, logos, examples, and third-party materials remain the property of their respective owners. Project-specific ownership and licence terms are set by the relevant client agreement, not by these website terms.</p>
      </LegalSection>

      <LegalSection title="Accuracy, links, and availability">
        <p>We aim to keep public information useful and current, but it may contain errors or become outdated. It is not legal, financial, security, accessibility, or other professional advice for your circumstances.</p>
        <p>Links to third-party sites are provided for context. ScaleSmiths does not control their content, availability, privacy practices, or security. The website may be changed, paused, or withdrawn for maintenance, security, or operational reasons.</p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>Nothing in these terms excludes or limits liability where doing so would be unlawful, including liability for fraud, fraudulent misrepresentation, or death or personal injury caused by negligence.</p>
        <p>Subject to that qualification, ScaleSmiths is not responsible under these website terms for losses caused solely by reliance on general public content, unauthorised use, third-party services, or events outside reasonable control. Liability for paid services is governed by the applicable client agreement.</p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>Our <Link className="text-t1 underline underline-offset-2" href="/privacy">privacy notice</Link> explains how website, enquiry, portal, analytics, monitoring, and hosting information is handled. Enquiry-processing permission is not marketing consent.</p>
      </LegalSection>

      <LegalSection title="Changes and governing law">
        <p>We may update these terms when the website, operating model, or legal requirements change. The version and last-updated date identify the terms currently published.</p>
        <p>These website terms are governed by the laws of England and Wales. The courts of England and Wales have jurisdiction, subject to any mandatory rights that apply to you or a separate written agreement.</p>
      </LegalSection>
    </LegalDocument>
  )
}
