import { publishedInsights } from "../../lib/insights"
import { siteBaseUrl } from "../../lib/site-identity"

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")
}

export function GET() {
  const base = siteBaseUrl()
  const items = publishedInsights().map((article) => {
    const url = `${base}/insights/${article.slug}`
    return `<item><title>${xml(article.title)}</title><link>${xml(url)}</link><guid isPermaLink="true">${xml(url)}</guid><description>${xml(article.description)}</description><pubDate>${new Date(`${article.datePublished}T00:00:00.000Z`).toUTCString()}</pubDate></item>`
  }).join("")
  const body = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>ScaleSmiths Insights</title><link>${xml(`${base}/insights`)}</link><description>Practical guidance on websites, SEO, development, automation and infrastructure.</description><language>en-gb</language><lastBuildDate>${new Date("2026-09-23T00:00:00.000Z").toUTCString()}</lastBuildDate>${items}</channel></rss>`
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600, s-maxage=3600" } })
}
