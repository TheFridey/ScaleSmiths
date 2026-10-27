import { publishedStartingPrices, STARTING_PRICE_BOUNDARY } from "./published-starting-prices"

export const INTERNATIONAL_PATH = "/international"

export const internationalDelivery = {
  metaTitle: "International Clients | ScaleSmiths",
  description:
    "How a UK-founded ScaleSmiths project runs remotely: discovery, time zones, communication, GBP billing and support. No overseas offices.",
  h1: "A UK company that can deliver the work where you are.",
  intro:
    "ScaleSmiths is founded and based in Hucknall, Nottinghamshire. The company works with clients outside the UK when the project can be delivered remotely and the commercial and legal fit is sound. There is no overseas office, and there is no local team invented for a sales page.",
  sections: [
    {
      title: "How a remote project runs",
      body: "Discovery is written down before a build starts. You get one owner, a shared plan, and decisions recorded so a time-zone gap does not turn into a memory gap. Work is released in stages you can review. The website, the system and the accounts that run them are set up so your business can keep them.",
    },
    {
      title: "Time zones and communication",
      body: "Core hours are UK business hours. Overlap with your day is agreed at the start, including which decisions can wait for a call and which are handled in writing. The default is email and scheduled calls. We do not imply a 24-hour desk.",
    },
    {
      title: "Billing",
      body: "Proposals and invoices are in GBP. The published figures are the Business Growth Audit at £395 and business email from £15/month. Website builds, partnerships and multi-country or operational systems are scoped individually. We do not publish converted prices in other currencies.",
    },
    {
      title: "After launch",
      body: "A Growth Partnership is an agreed scope of ongoing improvement, not an unlimited retainer. Support, search and changes are written into that scope. If a partnership is not the right next step, you still leave with the system and a way to contact the founders.",
    },
  ],
  faqs: [
    {
      q: "Do you have an office in my country?",
      a: "No. The company is UK-based. International work is remote. A published project for a computer-repair firm in Pennsylvania is delivery evidence, not a US office.",
    },
    {
      q: "Which language do you work in?",
      a: "English. We do not publish translated regional sites until there is a real page for that audience.",
    },
    {
      q: "How are international projects priced?",
      a: `${STARTING_PRICE_BOUNDARY} Enterprise and unusually complex work is quoted after discovery rather than from a rate card.`,
    },
    {
      q: "Who do we speak to?",
      a: "The founders. A project does not get passed to an unnamed offshore team.",
    },
  ],
}

const PUBLISHED_INTERNATIONAL_PRICE_IDS = new Set(["audit", "email"])

export function internationalPriceLines() {
  return publishedStartingPrices
    .filter((item) => PUBLISHED_INTERNATIONAL_PRICE_IDS.has(item.id))
    .map((item) => ({
      name: item.name,
      priceLabel: item.priceLabel,
      href: item.href,
      note: item.note,
    }))
}
