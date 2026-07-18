import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Normal Website Experience",
  description:
    "Explore the standard ScaleSmiths website for strategy-led web development, e-commerce, portals, automation and digital infrastructure.",
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
}

export default function TraditionalPage() {
  permanentRedirect("/?experience=normal")
}
