import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Normal Website Experience",
  description:
    "Explore ScaleSmiths business growth and engineering services across websites, e-commerce, portals, automation and digital infrastructure.",
  alternates: { canonical: "/" },
  robots: { index: false, follow: true },
}

export default function TraditionalPage() {
  permanentRedirect("/?experience=normal")
}
