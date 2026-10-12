import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import path from "node:path"

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params
  if (!["192", "512", "180"].includes(raw)) return new Response("Not found", { status: 404 })
  const size = Number(raw)
  const mark = await readFile(path.join(process.cwd(), "public", "brand", "favicon.png"))
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#15181b" }}>
    {/* ImageResponse renders the local brand asset into installable PNG sizes. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`data:image/png;base64,${mark.toString("base64")}`} alt="" width={Math.round(size * .72)} height={Math.round(size * .72)} />
  </div>, { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } })
}
