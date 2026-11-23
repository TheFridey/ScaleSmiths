/** B2.5 read-only workspace loading state, announced to assistive technology. */
export default function PerformanceLoading() {
  return <main id="academy-main" role="status" aria-live="polite" style={{ padding: "2rem", maxWidth: 900, margin: "auto" }}>
    <p style={{ letterSpacing: ".15em", color: "#d8ad63", fontSize: 12 }}>OPERATION ASCEND / B2.5</p>
    <h1>Loading your performance…</h1>
    <p>Retrieving your recorded opportunities, commission and recognition.</p>
  </main>
}
