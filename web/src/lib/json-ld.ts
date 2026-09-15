/**
 * Serialises structured data for a `<script type="application/ld+json">` tag. `<` is escaped
 * so no string value can terminate the script element early.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}
