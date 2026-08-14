export const managedBusinessEmail = {
  name: "ScaleSmiths Managed Business Email",
  shortName: "Managed Business Email",
  slug: "/services/managed-business-email",
  onboardingPath: "/services/managed-business-email/get-started",
  standalone: {
    startingPriceGbp: 15,
    billingCadence: null,
    mailboxes: 3,
    storagePerMailboxGb: 5,
    setupIncluded: true,
  },
  features: [
    "Custom-domain business email",
    "Three professional mailboxes",
    "5GB storage per mailbox",
    "Webmail access",
    "Desktop and mobile compatibility",
    "Aliases and forwarding",
    "Spam filtering",
    "TLS-secured transport",
    "SPF, DKIM and DMARC configuration",
    "Mailbox administration and password-reset support",
    "Initial mailbox and DNS setup",
  ],
  faq: [
    { q: "What do I get for £15?", a: "Three professional custom-domain mailboxes with 5GB storage per mailbox, managed initial setup, webmail, compatible desktop and mobile access, aliases, forwarding, spam filtering, email authentication configuration and ongoing technical support." },
    { q: "Do you set it up for me?", a: "Yes. Initial setup is included at no additional setup charge. With appropriate access to your domain's DNS management, ScaleSmiths configures the required email records, authentication and initial mailboxes." },
    { q: "Do I need to understand DNS?", a: "No. ScaleSmiths handles the required technical configuration. We arrange appropriate DNS access during onboarding; never submit domain or registrar passwords through the public form." },
    { q: "Can I use the email on my phone?", a: "Yes. The service works with compatible desktop and mobile email clients as well as webmail. Microsoft 365 or Google Workspace licences are not included." },
    { q: "Can you move my current email?", a: "ScaleSmiths can assess and assist with migrations from existing providers where practical. Migration scope depends on the current provider, mailbox volume and complexity, and is agreed before work begins." },
    { q: "What if I need more than three mailboxes?", a: "Tell us what the organisation needs. Requirements beyond the starting package are scoped separately; no unconfirmed higher tier or allowance is implied." },
    { q: "Do I need a ScaleSmiths website?", a: "No. Managed Business Email is available as a standalone service, even when another team manages your website." },
    { q: "Do I need to transfer my domain?", a: "Not necessarily. ScaleSmiths needs appropriate access to configure the required DNS records, but a domain transfer is not automatically required." },
    { q: "Are SPF, DKIM and DMARC included?", a: "Yes. ScaleSmiths configures these domain-authentication records to help receiving mail systems verify legitimate messages. This supports good configuration but is not a guarantee that every message will be delivered." },
  ],
} as const

export function managedBusinessEmailPriceLabel() {
  return `£${managedBusinessEmail.standalone.startingPriceGbp}`
}

export function buildManagedBusinessEmailSchema(baseUrl = "https://scalesmiths.co.uk") {
  const url = `${baseUrl.replace(/\/$/, "")}${managedBusinessEmail.slug}`
  return [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      name: managedBusinessEmail.name,
      description: "Professional custom-domain email, configured, authenticated and supported by ScaleSmiths.",
      url,
      provider: { "@type": "Organization", name: "ScaleSmiths", url: baseUrl },
      offers: {
        "@type": "Offer",
        priceCurrency: "GBP",
        price: managedBusinessEmail.standalone.startingPriceGbp,
        description: "Starting service with three mailboxes, 5GB per mailbox and initial setup included. Billing cadence is confirmed during onboarding.",
        url: `${baseUrl.replace(/\/$/, "")}${managedBusinessEmail.onboardingPath}`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: managedBusinessEmail.faq.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ]
}
