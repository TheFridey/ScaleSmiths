import Link from "next/link"
import { ENQUIRY_CONSENT_COPY } from "@/lib/legal"

interface EnquiryConsentProps {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  tone?: "standard" | "interactive"
}

export function EnquiryConsent({ id, checked, onChange, tone = "standard" }: EnquiryConsentProps) {
  const descriptionId = `${id}-description`
  const interactive = tone === "interactive"

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${interactive ? "border-white/10 bg-white/[0.045]" : "border-b1 bg-s1"}`}>
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={descriptionId}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--acc)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc"
      />
      <div className="min-w-0 font-dm text-sm leading-relaxed">
        <label htmlFor={id} className={interactive ? "font-medium text-t1" : "text-t2"}>
          {ENQUIRY_CONSENT_COPY} <span className="text-acc" aria-hidden="true">*</span>
        </label>
        <p id={descriptionId} className="mt-1 text-xs leading-relaxed text-t3">
          This permission is only for handling this enquiry; marketing consent is not requested or inferred. Read our{" "}
          <Link href="/legal/privacy" className="underline decoration-white/30 underline-offset-2 hover:text-t1">privacy notice</Link>
          {" "}and{" "}
          <Link href="/legal/website-terms" className="underline decoration-white/30 underline-offset-2 hover:text-t1">website terms</Link>.
        </p>
      </div>
    </div>
  )
}
