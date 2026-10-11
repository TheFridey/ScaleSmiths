import type { ProspectStage } from "./prospects"
export interface CommercialContext {
  businessName: string; stage: ProspectStage; painPoints: string | null; opportunityNotes: string | null; nextAction: string | null
}
export interface CommercialSuggestion {
  kind: "briefing" | "email_draft" | "call_preparation"; text: string; source: "template" | "ai"; requiresConfirmation: true
}
export interface CommercialSuggestionProvider {
  suggest(context: CommercialContext): Promise<CommercialSuggestion[]>
}
export function prepareCommercialConversation(context: CommercialContext): CommercialSuggestion[] {
  return [
    { kind: "email_draft", source: "template", requiresConfirmation: true, text: `Hello,\n\nI'm getting in touch from ScaleSmiths about ${context.businessName}. We help businesses improve their websites, enquiries and digital infrastructure.\n\nWould you be open to a short conversation about your current priorities?\n\nBest regards,\nScaleSmiths` },
    { kind: "call_preparation", source: "template", requiresConfirmation: true, text: `Business: ${context.businessName}\nRecorded next action: ${context.nextAction ?? "Not recorded"}\nRecorded problems: ${context.painPoints ?? "Not recorded"}\nRecorded notes: ${context.opportunityNotes ?? "Not recorded"}\n\nDiscovery questions:\nWhat is your main business growth priority?\nWhere do your current enquiries come from?\nWhat happens between an enquiry and a booked job?\nWho makes the final decision and what is the timeframe?\n\nAgree a concrete next action before ending the conversation.` },
  ]
}
