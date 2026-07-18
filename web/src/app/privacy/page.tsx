import Link from "next/link"
import { LegalDocument, LegalSection } from "@/components/LegalDocument"
import { PrivacyStorageControls } from "@/components/PrivacyStorageControls"
import { PRIVACY_CONTACT_EMAIL, privacyMetadata } from "@/lib/legal"

export const metadata = privacyMetadata

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy notice"
      introduction="This notice explains how ScaleSmiths handles personal information when you use scalesmiths.co.uk, submit an enquiry, use the client portal, or interact with services we operate for clients."
    >
      <LegalSection title="Who is responsible for your information?">
        <p>
          ScaleSmiths is a digital services business operating from Hucknall, Nottinghamshire, United Kingdom. ScaleSmiths is the data controller for information collected through this website, its enquiry routes, and its client portal unless a separate agreement says otherwise.
        </p>
        <p>
          Contact us about privacy, a rights request, or a data protection complaint at{" "}
          <a className="text-t1 underline underline-offset-2" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
          Please do not send identity documents until we ask for an appropriate verification method.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-t1">Enquiries:</strong> name, email address, business name, website, industry, project type, budget and timeline ranges, goals, requested services, preferred contact method, an optional phone number, and the brief you submit.</li>
          <li><strong className="text-t1">Client portal:</strong> account email, password hash, client identifier, support requests, messages, affected URLs, attachment metadata, project timeline information, and published reports.</li>
          <li><strong className="text-t1">Security and operations:</strong> request and correlation identifiers, login and enquiry rate-limit keys derived by hashing IP addresses or email identifiers, timestamps, delivery status, and restricted infrastructure logs. Network providers may process IP addresses and request headers to deliver and protect the service.</li>
          <li><strong className="text-t1">Privacy-minimised experience analytics:</strong> a random session identifier, event name, page path without its query string, coarse device class, normal or interactive preference, journey step, referrer hostname, limited campaign labels, and allowlisted error or interface metadata. The analytics record does not contain form answers, names, email addresses, phone numbers, full referrer URLs, or raw IP addresses.</li>
          <li><strong className="text-t1">Client-site analytics:</strong> where a client has authorised a connection, ScaleSmiths may ingest daily aggregate metrics such as sessions, conversions, search performance, Core Web Vitals, errors, and uptime. Configuration and metrics are isolated by client. A client may be the controller for visitor information collected on its own website.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Why we use it and our lawful bases">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead><tr className="border-b border-b2 text-t1"><th className="py-3 pr-4">Purpose</th><th className="py-3 pr-4">Draft lawful basis</th></tr></thead>
            <tbody className="divide-y divide-b1">
              <tr><td className="py-3 pr-4">Receive, assess, reply to, and retain an enquiry</td><td className="py-3 pr-4">Steps you ask us to take before a contract and our legitimate interests in responding to genuine business enquiries. The required checkbox records your permission for this enquiry processing; it does not create marketing consent.</td></tr>
              <tr><td className="py-3 pr-4">Deliver contracted work, portal access, support, reporting, and account administration</td><td className="py-3 pr-4">Performance of a contract and legitimate interests in operating and documenting the client relationship.</td></tr>
              <tr><td className="py-3 pr-4">Protect accounts, prevent abuse, investigate failures, and maintain service reliability</td><td className="py-3 pr-4">Legitimate interests in service security and, where applicable, compliance with legal obligations.</td></tr>
              <tr><td className="py-3 pr-4">Understand aggregate website journeys and improve normal and interactive experiences</td><td className="py-3 pr-4">Legitimate interests in improving the service. Device storage is limited to statistical and appearance purposes, with the objection controls below and automatic respect for GPC and DNT.</td></tr>
              <tr><td className="py-3 pr-4">Maintain financial, contractual, security, or regulatory records</td><td className="py-3 pr-4">Legal obligation and legitimate interests in establishing, exercising, or defending legal claims.</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          We do not ask for marketing consent in either enquiry form and do not infer it from enquiry-processing permission. If ScaleSmiths introduces optional direct marketing, it must use a separate, specific choice and its own unsubscribe route.
        </p>
        <p>
          Enquiries receive an internal lead-quality score from the submitted commercial fields to help prioritise review. It does not make a solely automated decision with legal or similarly significant effects; a person reviews the enquiry.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and browser storage">
        <p>
          ScaleSmiths does not use advertising cookies or cross-site tracking. Functional storage remembers a choice you make or keeps a portal session secure. First-party statistical storage supports aggregate service improvement and can be disabled below without preventing access to the website.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><code>ss-client-session</code>: essential, HTTP-only client-portal authentication cookie; expires after eight hours.</li>
          <li><code>ss_experience_preference</code> and <code>scalesmiths.experience</code>: remember the normal or interactive experience you explicitly choose; the cookie lasts up to one year and the local preference remains until reset or browser storage is cleared.</li>
          <li><code>scalesmiths.v2.industry</code>: remembers the industry selected in the interactive journey until you clear saved choices or browser storage.</li>
          <li><code>scalesmiths.analytics.session</code> and <code>scalesmiths.analytics.sent</code>: tab/session-scoped identifiers used for first-party event grouping and duplicate prevention.</li>
          <li><code>ss_exp_id</code> and <code>ss_exp_variant</code>: only written when the controlled experience experiment is enabled; maintain a consistent anonymous variant for up to 90 days.</li>
          <li><code>ss_analytics_opt_out</code>: remembers that this browser objected to experience analytics for up to one year.</li>
        </ul>
        <p>
          GPC or DNT signals stop experience-event collection and prevent experiment assignment storage. The choice below provides a simple browser-specific objection route even when those signals are unavailable.
        </p>
        <div id="storage-choices" className="scroll-mt-24 pt-2"><PrivacyStorageControls /></div>
      </LegalSection>

      <LegalSection title="Who receives information">
        <p>Access is limited to authorised ScaleSmiths personnel and service providers needed for the relevant purpose. Current categories include:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong className="text-t1">Resend</strong>, which delivers enquiry notifications and acknowledgements and therefore receives the email content needed for those messages.</li>
          <li><strong className="text-t1">PostgreSQL and the ScaleSmiths hosting environment</strong>, which store application records and encrypted operational backups.</li>
          <li><strong className="text-t1">Cloudflare and host network infrastructure</strong>, where configured for DNS, proxying, traffic security, and availability.</li>
          <li><strong className="text-t1">Sentry</strong>, when production monitoring is enabled. Monitoring is server-side, uses redaction and an allowlist, and is configured not to send enquiry bodies, portal messages, cookies, credentials, or generated source code.</li>
          <li>Professional advisers, insurers, authorities, or courts where disclosure is necessary and lawful.</li>
        </ul>
        <p>We do not sell personal information and do not provide enquiry details to advertising networks.</p>
      </LegalSection>

      <LegalSection title="International transfers">
        <p>
          Some technology providers may make information accessible from outside the UK. Where this is a restricted transfer, ScaleSmiths uses an applicable UK adequacy regulation, an appropriate safeguard such as the UK International Data Transfer Agreement or UK Addendum with a data protection test, or a lawful exception. Contact us to ask for information about the safeguard relevant to your data.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep information">
        <p>
          We keep information only while it is needed for the purpose described, an active or reasonably anticipated client relationship, security and audit requirements, or applicable legal, tax, insurance, and dispute periods. We consider the record type, sensitivity, relationship status, contractual obligations, and whether a record can be deleted or anonymised.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Enquiries become eligible for deletion or reduction when they are closed or no longer commercially active, unless a continuing legal or business reason applies.</li>
          <li>Portal records are normally retained for the client relationship and a proportionate period afterwards to support delivery history, disputes, and legal obligations.</li>
          <li>Rate-limit records use ten-minute enforcement windows; expired operational records are not used to profile visitors and are subject to database housekeeping.</li>
          <li>The internal experience dashboard analyses the most recent 30 days. Event-level data is retained only while necessary for service analytics and is then eligible for aggregation or removal.</li>
          <li>Client analytics connections specify a retention window between 30 and 730 days, currently defaulting to 395 days. The client’s agreement and source obligations may require a shorter period.</li>
          <li>Monitoring, network, backup, and security records follow restricted operational retention schedules appropriate to incident investigation and recovery.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          ScaleSmiths uses access controls, encrypted transport, password hashing, HTTP-only secure production session cookies, rate limiting, data minimisation, monitoring redaction, separate production database roles, encrypted backups, and restricted admin and Forge access. No internet service can be guaranteed completely secure; suspected incidents are assessed and handled under the incident process.
        </p>
      </LegalSection>

      <LegalSection title="Your rights and objections">
        <p>
          Depending on the circumstances, you may ask for access, correction, deletion, restriction, or portability of your personal information. You may object to processing based on legitimate interests and may withdraw consent where consent is the basis used. A withdrawal does not make earlier lawful processing unlawful. Rights can be limited by exemptions or competing legal obligations.
        </p>
        <div className="rounded-xl border border-acc/25 bg-acc/5 p-5 text-t1">
          <strong>Your right to object:</strong> you may object to processing based on legitimate interests, including privacy-minimised analytics, by using the storage control above or emailing us. We do not currently use enquiry information for direct marketing.
        </div>
        <p>
          Email <a className="text-t1 underline underline-offset-2" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a> to exercise a right. We may request proportionate information to verify identity. You may first complain to ScaleSmiths using the same address. If you remain dissatisfied, you may complain to the{" "}
          <a className="text-t1 underline underline-offset-2" href="https://ico.org.uk/make-a-complaint/data-protection-complaints/" rel="noreferrer">Information Commissioner&apos;s Office</a>.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this notice">
        <p>We will update the version and date when this notice changes materially. A new purpose that is incompatible with the original collection purpose will be assessed before information is reused.</p>
        <p>For the website-use terms that sit alongside this notice, read the <Link className="text-t1 underline underline-offset-2" href="/terms">website terms</Link>.</p>
      </LegalSection>
    </LegalDocument>
  )
}
