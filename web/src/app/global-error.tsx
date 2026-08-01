"use client"

import { useEffect } from "react"
import { captureGlobalRenderError, renderGlobalErrorFallback } from "./global-error-content"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureGlobalRenderError(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#05070d", color: "#f5f7fa", fontFamily: "system-ui, sans-serif" }}>
        {renderGlobalErrorFallback(reset)}
      </body>
    </html>
  )
}
