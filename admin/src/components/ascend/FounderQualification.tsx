"use client"

import { useEffect, useId, useState } from "react"
import type { Qualification } from "@/lib/partner-qualification"
import { QualificationChecklist } from "./QualificationChecklist"

/**
 * Operation Ascend B2.2: founders inspect exactly the factors the partner sees, derived from the stored discovery record.
 * Renders nothing while the qualification switch is off (the API answers 404).
 */
export function FounderQualification({ opportunityId }: { opportunityId: string }) {
  const [q, setQ] = useState<Qualification | null>(null), [error, setError] = useState(""), headingId = useId()
  useEffect(() => {
    const c = new AbortController()
    fetch(`/api/expansion/qualification?id=${encodeURIComponent(opportunityId)}`, { cache: "no-store", signal: c.signal })
      .then(async (r) => { if (r.status === 404) return; const b = await r.json(); if (!r.ok) throw new Error(b.error || "Qualification is unavailable."); setQ(b.qualification) })
      .catch((e: Error) => { if (e.name !== "AbortError") setError(e.message) })
    return () => c.abort()
  }, [opportunityId])
  if (!q && !error) return null
  return <details className="qa-founder" open><summary id={headingId}>Qualification readiness (how it is derived)</summary>
    {error ? <p role="alert">{error}</p> : <QualificationChecklist q={q!} headingId={headingId} />}
  </details>
}
