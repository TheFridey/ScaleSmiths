import type { ReactNode } from "react"
import { buildPageMetadata } from "@/lib/page-metadata"

export const metadata = buildPageMetadata({
  title: "Start a Project Brief",
  description: "Tell ScaleSmiths about your business, what needs changing and your timeline. The founders review every brief and reply with a considered next step.",
  path: "/quote",
})

export default function QuoteLayout({ children }: { children: ReactNode }) {
  return children
}