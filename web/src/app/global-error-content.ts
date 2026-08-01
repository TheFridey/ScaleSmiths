import * as Sentry from "@sentry/nextjs"
import { createElement } from "react"

const capturedGlobalErrors = new WeakSet<Error>()

export function captureGlobalRenderError(error: Error & { digest?: string }) {
  if (capturedGlobalErrors.has(error)) return
  capturedGlobalErrors.add(error)
  Sentry.captureException(error)
}

export function renderGlobalErrorFallback(reset: () => void) {
  return createElement("main", { style: { minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" } },
    createElement("section", { "aria-labelledby": "global-error-title", style: { maxWidth: 560, textAlign: "center" } },
      createElement("p", { style: { color: "#38bdf8", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" } }, "ScaleSmiths"),
      createElement("h1", { id: "global-error-title" }, "Something went wrong"),
      createElement("p", null, "We could not load this page safely. No private error details have been displayed."),
      createElement("button", { type: "button", onClick: reset, style: { marginTop: "1rem", padding: ".75rem 1rem", borderRadius: 8, border: 0, background: "#0ea5e9", color: "#fff", fontWeight: 700, cursor: "pointer" } }, "Try again"),
    ),
  )
}
