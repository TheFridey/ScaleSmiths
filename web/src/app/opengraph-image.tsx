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
          background: "linear-gradient(135deg, #050403 0%, #141210 52%, #0b0a08 100%)",
          color: "#f5efe6",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 78% 18%, rgba(232, 160, 69, 0.28), transparent 32%), radial-gradient(circle at 14% 88%, rgba(180, 80, 20, 0.20), transparent 30%)",
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
              border: "2px solid #e8a045",
              color: "#e8a045",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.04em",
            }}
          >
            {"<>"}
          </div>
          <div style={{ display: "flex", fontSize: "34px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <span style={{ color: "#d8d0c6" }}>Scale</span>
            <span style={{ color: "#e8a045" }}>Smiths</span>
          </div>
        </div>

        <div style={{ zIndex: 1, maxWidth: "900px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "82px", lineHeight: 0.94, fontWeight: 800 }}>
            Forge Your Digital Edge
          </div>
          <div style={{ marginTop: "28px", fontSize: "28px", lineHeight: 1.35, color: "#c9bdb0" }}>
            Founder-led business growth and engineering for ambitious UK businesses.
          </div>
        </div>

        <div style={{ zIndex: 1, display: "flex", alignItems: "center", gap: "12px", color: "#95887a", fontSize: "24px" }}>
          <span style={{ color: "#e8a045" }}>Hucknall, Nottinghamshire</span>
          <span>Working nationally</span>
        </div>
      </div>
    ),
    size,
  )
}
