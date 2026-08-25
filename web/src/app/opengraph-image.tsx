import { ImageResponse } from "next/og"

export const alt = "ScaleSmiths"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #05070d 0%, #0b1020 54%, #020617 100%)",
          color: "#f8fafc",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 78% 20%, rgba(33, 150, 243, 0.28), transparent 30%), radial-gradient(circle at 12% 88%, rgba(14, 165, 233, 0.18), transparent 28%)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "18px", zIndex: 1 }}>
          <div
            style={{
              width: "68px",
              height: "68px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid #38bdf8",
              color: "#38bdf8",
              fontSize: "30px",
              fontWeight: 800,
            }}
          >
            SS
          </div>
          <div style={{ display: "flex", fontSize: "34px", fontWeight: 700, letterSpacing: "0.08em" }}>
            <span>Scale</span>
            <span style={{ color: "#38bdf8" }}>Smiths</span>
          </div>
        </div>

        <div style={{ zIndex: 1, maxWidth: "860px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "82px", lineHeight: 0.94, fontWeight: 800 }}>
            Forge Your Digital Edge
          </div>
          <div style={{ marginTop: "28px", fontSize: "28px", lineHeight: 1.35, color: "#cbd5e1" }}>
            Founder-led business growth and engineering for ambitious UK businesses.
          </div>
        </div>

        <div style={{ zIndex: 1, display: "flex", alignItems: "center", gap: "12px", color: "#94a3b8", fontSize: "24px" }}>
          <span style={{ color: "#38bdf8" }}>Hucknall, Nottinghamshire</span>
          <span>Working nationally</span>
        </div>
      </div>
    ),
    size,
  )
}
