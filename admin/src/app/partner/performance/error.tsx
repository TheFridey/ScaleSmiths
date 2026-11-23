"use client"

export default function PerformanceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main role="alert" style={{ padding: "2rem", maxWidth: 800, margin: "auto" }}>
    <h1>Your performance is temporarily unavailable</h1>
    <p>No information has been changed. You can try loading the page again.</p>
    <button type="button" onClick={reset} style={{ borderRadius: 12, border: "1px solid #d8ad63", padding: "12px 20px", cursor: "pointer" }}>Try again</button>
  </main>
}
