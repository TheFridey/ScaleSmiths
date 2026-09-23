import { describe, expect, it } from "vitest"
import { buildPageMetadata } from "./page-metadata"

describe("page metadata", () => {
  it("builds a canonical and complete social preview from one input", () => {
    const metadata = buildPageMetadata({ title: "Example", description: "A unique page description.", path: "/example" })
    expect(metadata.alternates).toEqual({ canonical: "/example" })
    expect(metadata.openGraph).toMatchObject({ title: "Example | ScaleSmiths", url: "/example", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] })
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: ["/opengraph-image"] })
  })

  it("includes article author and publication fields", () => {
    const metadata = buildPageMetadata({ title: "Article", description: "Article description.", path: "/insights/article", type: "article", authors: [{ name: "Rhys", url: "/about/rhys" }], publishedTime: "2026-09-01", modifiedTime: "2026-09-10", section: "Technical SEO" })
    expect(metadata.authors).toEqual([{ name: "Rhys", url: "/about/rhys" }])
    expect(metadata.openGraph).toMatchObject({ type: "article", publishedTime: "2026-09-01", modifiedTime: "2026-09-10", section: "Technical SEO", authors: ["Rhys"] })
  })
})
