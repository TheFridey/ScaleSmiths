import { buildApiCatalog } from "@/lib/agent-discovery"

export const dynamic = "force-static"

// RFC 9727 API catalog, serialised as an RFC 9264 linkset. Served with the registered
// application/linkset+json media type so agents can content-negotiate it.
export function GET() {
  return new Response(JSON.stringify(buildApiCatalog(), null, 2), {
    headers: {
      "Content-Type": "application/linkset+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
