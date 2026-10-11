import { ImageResponse } from "next/og"
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params
  if (!["192", "512", "180"].includes(raw)) return new Response("Not found", { status: 404 })
  const size = Number(raw)
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111214", color: "#d1b266", fontWeight: 800, fontSize: size * .32, border: `${size * .035}px solid #8e783e` }}>SS</div>, { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } })
}
