/**
 * Commercial engagement models shown on the homepage and pricing journeys.
 * Starting prices stay published on /pricing; they are not the homepage lead narrative.
 */
export const engagementModels = [
  {
    id: "business-websites-growth",
    eyebrow: "Transparent entry points",
    title: "Business Websites & Growth",
    description:
      "Practical websites, audits, managed email and Growth Partnerships for ambitious independent and growing businesses. Starting prices stay published; scope is agreed before work begins.",
    href: "/pricing#web-growth",
    cta: "View starting prices",
    secondaryHref: "/digital-growth-partnership",
    secondaryCta: "Growth Partnership",
  },
  {
    id: "established-transformation",
    eyebrow: "Corporate digital estate",
    title: "Established Business Transformation",
    description:
      "Evolution of websites, customer journeys, integrations and operational efficiency for multi-site and established organisations that have outgrown a brochure presence.",
    href: "/enterprise-websites",
    cta: "Enterprise websites",
    secondaryHref: "/enterprise",
    secondaryCta: "Enterprise systems",
  },
  {
    id: "custom-platforms-enterprise",
    eyebrow: "Independently scoped",
    title: "Custom Platforms & Enterprise Projects",
    description:
      "Bespoke architecture, workflows, security, migrations and support for complex platforms. Never sold against a website starting price. Scoped after discovery.",
    href: "/pricing#enterprise-systems",
    cta: "How complex work is priced",
    secondaryHref: "/custom-systems",
    secondaryCta: "Custom systems",
  },
] as const

export type EngagementModel = (typeof engagementModels)[number]
