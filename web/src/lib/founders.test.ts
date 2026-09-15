import { describe, expect, it } from "vitest"
import {
  aboutMetadata,
  approachPillars,
  founderBySlug,
  founderFocusAreas,
  founderForProject,
  founderLinks,
  founderProfileHref,
  founderProfileMetadata,
  founderProjects,
  founders,
  originStatements,
  UNSUPPORTED_CLAIM_PATTERNS,
} from "./founders"
import { projects } from "./data"

const publishedCopy = [
  ...founders.flatMap((founder) => [
    founder.name,
    founder.role.text,
    founder.summary.text,
    founder.authorTitle,
    ...founder.responsibilities.map((item) => item.text),
    ...founder.involvement.map((item) => item.text),
  ]),
  ...originStatements.map((statement) => statement.text),
  ...approachPillars.map((pillar) => `${pillar.title} ${pillar.description}`),
  String(aboutMetadata.description),
].join("\n")

describe("founder data source", () => {
  it("centrally manages both founders named in the organisation data", () => {
    expect(founders.map((founder) => founder.name)).toEqual(["Rhys", "Trevor Newton-Bradley"])
    expect(founderBySlug("rhys")?.monogram).toBe("R")
    expect(founderBySlug("trevor-newton-bradley")?.monogram).toBe("TNB")
    expect(founderBySlug("nobody")).toBeUndefined()
  })

  it("cites repository evidence for every published statement", () => {
    for (const founder of founders) {
      const statements = [founder.role, founder.summary, ...founder.responsibilities, ...founder.involvement]
      for (const statement of statements) {
        expect(statement.text.length).toBeGreaterThan(0)
        expect(statement.evidence).toMatch(/^(web|admin|docs|scripts)\//)
      }
    }
    for (const statement of originStatements) {
      expect(statement.evidence).toMatch(/^(web|admin|docs|scripts)\//)
    }
  })

  it("publishes no qualification, employment-history, client-count or award claim", () => {
    for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
      expect(publishedCopy).not.toMatch(pattern)
    }
  })

  it("resolves selected work from the shared project data", () => {
    const rhys = founderBySlug("rhys")!
    expect(founderProjects(rhys).map((project) => project.slug)).toEqual([
      "glow-tanning",
      "pinkys-prints",
      "csds",
      "prymal",
      "veteranfinder",
    ])
    expect(founderProjects(founderBySlug("trevor-newton-bradley")!)).toHaveLength(1)
  })

  it("keeps founder credits consistent with the project credit lines", () => {
    for (const founder of founders) {
      for (const project of founderProjects(founder)) {
        expect(project.credit).toContain(founder.creditName)
      }
    }
  })

  it("does not imply that every published project has a named founder credit", () => {
    expect(founderForProject("precision-finish-plastering-rendering")).toBeUndefined()
    const attributed = founders.flatMap((founder) => founder.projectSlugs)
    expect(new Set(attributed).size).toBe(attributed.length)
    expect(attributed.length).toBeLessThan(projects.length)
  })

  it("publishes complementary commercial and technical focus areas", () => {
    expect(founderFocusAreas(founderBySlug("rhys")!)).toEqual(expect.arrayContaining(["Technical leadership", "Software engineering", "Architecture"]))
    expect(founderFocusAreas(founderBySlug("trevor-newton-bradley")!)).toEqual(expect.arrayContaining(["Commercial growth", "Client relationships", "Sales"]))
  })

  it("gives each founder a byline title", () => {
    expect(founderBySlug("rhys")?.authorTitle).toBe("Co-founder & Technical Lead")
    expect(founderBySlug("trevor-newton-bradley")?.authorTitle).toBe("Co-founder & Commercial Lead")
  })

  it("links each founder to related services that exist in the public site", () => {
    for (const founder of founders) {
      expect(founder.relatedServices.length).toBeGreaterThan(0)
      for (const service of founder.relatedServices) expect(service.href).toMatch(/^\/[a-z0-9/-]+$/)
    }
  })
})

describe("founder profile routes and metadata", () => {
  it("gives each founder a canonical profile route", () => {
    expect(founders.map(founderProfileHref)).toEqual(["/about/rhys", "/about/trevor-newton-bradley"])
  })

  it("publishes complete, founder-specific social metadata", () => {
    for (const founder of founders) {
      const metadata = founderProfileMetadata(founder)
      expect(metadata.alternates?.canonical).toBe(founderProfileHref(founder))
      expect(metadata.openGraph?.url).toBe(founderProfileHref(founder))
      expect(String(metadata.openGraph?.title)).toContain(founder.name)
      expect(String(metadata.description)).toContain(founder.name)
      expect(String(metadata.description)).toContain("Hucknall, Nottinghamshire")
      expect(String(metadata.description).length).toBeLessThanOrEqual(160)
    }
  })

  it("keeps the about page canonical and titled for founders", () => {
    expect(aboutMetadata.alternates?.canonical).toBe("/about")
    expect(aboutMetadata.openGraph?.url).toBe("/about")
    expect(String(aboutMetadata.title)).toMatch(/founders/i)
  })
})

describe("founder contact links", () => {
  const rhys = founderBySlug("rhys")!

  it("publishes nothing when configuration is absent or blank", () => {
    expect(founderLinks(rhys, {})).toEqual([])
    expect(founderLinks(rhys, { NEXT_PUBLIC_FOUNDER_RHYS_GITHUB: "   " })).toEqual([])
  })

  it("publishes only https and mailto configuration values", () => {
    const links = founderLinks(rhys, {
      NEXT_PUBLIC_FOUNDER_RHYS_GITHUB: "https://github.com/TheFridey",
      NEXT_PUBLIC_FOUNDER_RHYS_LINKEDIN: "javascript:alert(1)",
      NEXT_PUBLIC_FOUNDER_RHYS_EMAIL_URL: "mailto:hello@scalesmiths.co.uk",
    })

    expect(links).toEqual([
      { label: "GitHub", href: "https://github.com/TheFridey" },
      { label: "Email", href: "mailto:hello@scalesmiths.co.uk" },
    ])
  })

  it("rejects insecure and malformed configuration values", () => {
    for (const value of ["http://example.com", "not a url", "//example.com"]) {
      expect(founderLinks(rhys, { NEXT_PUBLIC_FOUNDER_RHYS_GITHUB: value })).toEqual([])
    }
  })
})
