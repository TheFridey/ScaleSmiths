import type { Metadata } from "next"
import { QuoteBriefWizard } from "@/components/QuoteBriefWizard"
import { StrategyCallForm } from "@/components/StrategyCallForm"
import { ENQUIRY_INTENTS, parseEnquiryIntent } from "@/lib/enquiry-intents"
import { buildPageMetadata } from "@/lib/page-metadata"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>
}): Promise<Metadata> {
  const params = await searchParams
  const raw = Array.isArray(params.intent) ? params.intent[0] : params.intent
  const intent = parseEnquiryIntent(raw)

  if (intent === "strategy_call" || intent === "discovery_call") {
    return buildPageMetadata({
      title: ENQUIRY_INTENTS[intent],
      description: "Tell ScaleSmiths what you are trying to solve. The founders review every request and reply with a sensible next step.",
      path: `/quote?intent=${intent}`,
    })
  }

  return buildPageMetadata({
    title: "Start a Project Brief",
    description: "Tell ScaleSmiths about your business, what needs changing and your timeline. The founders review every brief and reply with a considered next step.",
    path: "/quote",
  })
}

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string | string[] }>
}) {
  const params = await searchParams
  const raw = Array.isArray(params.intent) ? params.intent[0] : params.intent
  const intent = parseEnquiryIntent(raw)

  if (intent === "strategy_call" || intent === "discovery_call") {
    return <StrategyCallForm intent={intent} />
  }

  return <QuoteBriefWizard />
}
