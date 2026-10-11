import type { MetadataRoute } from "next"
export default function manifest(): MetadataRoute.Manifest {
  return { id: "/command-centre", name: "ScaleSmiths Command Centre", short_name: "ScaleSmiths", description: "Private ScaleSmiths commercial operations", start_url: "/command-centre", scope: "/", display: "standalone", background_color: "#111214", theme_color: "#111214", icons: [{ src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" }, { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" }] }
}
