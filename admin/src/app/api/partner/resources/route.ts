import { NextResponse } from "next/server"
import { downloadResource, getResource, listResources } from "@/lib/server/empower-resources"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
export const dynamic = "force-dynamic"
/**
 * Partner Resource Centre (Operation Empower B1.3), read-only. 404 unless PARTNER_RESOURCE_CENTRE_ENABLED=true.
 *   ?q=&category=&audience=   list or ranked search      ?slug=   one resource      ?download=   Markdown text file
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    const download = params.get("download")
    if (download) {
      const file = await downloadResource({ slug: download })
      return new NextResponse(file.text, { headers: { ...expansionHeaders, "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${file.filename}"`, "X-Content-Type-Options": "nosniff" } })
    }
    const slug = params.get("slug")
    if (slug) return NextResponse.json(await getResource({ slug }), { headers: expansionHeaders })
    return NextResponse.json(await listResources({ q: params.get("q") ?? undefined, category: params.get("category") ?? undefined, audience: params.get("audience") ?? undefined }), { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
