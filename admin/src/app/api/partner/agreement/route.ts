import { NextResponse } from "next/server"
import { acceptReissuedAgreement, acceptedAgreementDocument, partnerAgreementOverview } from "@/lib/server/partner-agreements"
import { expansionBody, expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
export const dynamic = "force-dynamic"

/** The signed-in partner's own agreement: issued version, latest acceptance, history, and a download of an accepted copy. */
export async function GET(request: Request) {
  try {
    const download = new URL(request.url).searchParams.get("download")
    if (download) {
      const { filename, text } = await acceptedAgreementDocument(download, "partner")
      return new NextResponse(text, { headers: { ...expansionHeaders, "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff" } })
    }
    return NextResponse.json(await partnerAgreementOverview(), { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}

/** Accept a version a founder reissued. Same-origin JSON only; the database fixes version, digest and time. */
export async function POST(request: Request) {
  try {
    const body = await expansionBody(request)
    return NextResponse.json(await acceptReissuedAgreement(body), { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
