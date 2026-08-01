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
      createElement("p", { style: { color: "#38bdf8", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" } }, "ScaleSmiths Admin"),
      createElement("h1", { id: "global-error-title" }, "The workspace could not be loaded"),
      createElement("p", null, "The error was recorded safely. No operational or request details are shown here."),
      createElement("button", { type: "button", onClick: reset, style: { marginTop: "1rem", padding: ".75rem 1rem", borderRadius: 8, border: 0, background: "#0284c7", color: "#fff", fontWeight: 700, cursor: "pointer" } }, "Retry workspace"),
    ),
  )
}
