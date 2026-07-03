export interface ForgePanel {
  id: string
  label: string
  description: string
  color: string
}

export const forgePanels: ForgePanel[] = [
  {
    id: "website",
    label: "Website",
    description: "The public surface that explains the offer, captures intent, and routes visitors into the right next action.",
    color: "#67e8f9",
  },
  {
    id: "crm",
    label: "CRM",
    description: "The operating memory for enquiries, customer status, next steps, and follow-up ownership.",
    color: "#14f1b2",
  },
  {
    id: "quotes",
    label: "Quotes",
    description: "A structured path from customer need to prepared proposal, without promising an automatic sale.",
    color: "#fde68a",
  },
  {
    id: "seo",
    label: "SEO",
    description: "The visibility layer that helps relevant buyers find the business through structured pages and signals.",
    color: "#93c5fd",
  },
  {
    id: "automations",
    label: "Automations",
    description: "The repeatable actions that keep reminders, handoffs, and follow-ups moving without manual chasing.",
    color: "#c4b5fd",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "The measurement layer for understanding which journeys are working and where the system should improve.",
    color: "#fca5a5",
  },
]

export function getForgePanel(id: string | null) {
  return forgePanels.find((panel) => panel.id === id) ?? null
}
