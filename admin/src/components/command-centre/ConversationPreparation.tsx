"use client"
import { Copy } from "lucide-react"
import { useState } from "react"
import {
  prepareCommercialConversation,
  type CommercialContext,
} from "@/lib/commercial-intelligence"
export function ConversationPreparation({
  context,
}: {
  context: CommercialContext
}) {
  const [notice, setNotice] = useState("")
  return (
    <details>
      <summary>Conversation preparation and email draft</summary>
      {prepareCommercialConversation(context).map((suggestion) => (
        <section key={suggestion.kind}>
          <h3>
            {suggestion.kind === "email_draft"
              ? "Email draft · template"
              : "Call preparation · recorded context"}
          </h3>
          <textarea
            aria-label={
              suggestion.kind === "email_draft"
                ? "Unsent email draft"
                : "Call preparation notes"
            }
            readOnly
            value={suggestion.text}
            rows={9}
          />
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(suggestion.text)
                setNotice("Copied. No message has been sent.")
              } catch {
                setNotice("Clipboard unavailable.")
              }
            }}
          >
            <Copy size={17} /> Copy draft
          </button>
        </section>
      ))}
      {notice && <p role="status">{notice}</p>}
    </details>
  )
}
