import { describe, expect, it } from "vitest"
import {
  aboutMetadata,
  approachPillars,
  buildAboutSchemas,
  founderBySlug,
  founderFocusAreas,
  founderForProject,
  founderLinks,
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
      const statements = [founder.role, ...founder.responsibilities, ...founder.involvement]
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

  it("marks unevidenced biography categories as awaiting founder confirmation", () => {
    for (const founder of founders) {
      expect(founder.awaitingConfirmation.length).toBeGreaterThan(0)
      expect(founder.awaitingConfirmation.some((item) => /photograph/i.test(item))).toBe(true)
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

  it("attributes every published project to exactly one founder", () => {
    for (const project of projects) {
      expect(founderForProject(project.slug)?.slug).toBeDefined()
    }
    const attributed = founders.flatMap((founder) => founder.projectSlugs)
    expect(new Set(attributed).size).toBe(attributed.length)
    expect(attributed).toHaveLength(projects.length)
  })

  it("derives areas of focus from recorded project technology", () => {
    const focus = founderFocusAreas(founderBySlug("rhys")!)
    const tags = new Set(founderProjects(founderBySlug("rhys")!).flatMap((project) => project.tags))

    expect(focus.length).toBeGreaterThan(0)
    expect(focus.length).toBeLessThanOrEqual(10)
    for (const area of focus) expect(tags.has(area)).toBe(true)
    expect(new Set(focus).size).toBe(focus.length)
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

describe("about page metadata and structured data", () => {
  it("declares a canonical /about route", () => {
    expect(aboutMetadata.alternates?.canonical).toBe("/about")
    expect(aboutMetadata.openGraph?.url).toBe("/about")
    expect(String(aboutMetadata.title)).toMatch(/founders/i)
  })

  it("publishes AboutPage, Organization, Person and breadcrumb entities", () => {
    const schemas = buildAboutSchemas("https://scalesmiths.co.uk/", {})
    const types = schemas.map((schema) => JSON.stringify(schema["@type"]))

    expect(types).toContain('"AboutPage"')
    expect(types).toContain('["Organization","ProfessionalService"]')
    expect(types.filter((type) => type === '"Person"')).toHaveLength(founders.length)
    expect(types).toContain('"BreadcrumbList"')
  })

  it("links people to the shared organisation identifier consistently", () => {
    const schemas = buildAboutSchemas("https://scalesmiths.co.uk", {})
    const organisation = schemas.find((schema) => String(JSON.stringify(schema["@type"])).includes("Organization")) as Record<string, unknown>
    const people = schemas.filter((schema) => schema["@type"] === "Person") as Array<Record<string, unknown>>

    expect(organisation["@id"]).toBe("https://scalesmiths.co.uk/#org")
    expect(organisation.founder).toEqual([
      { "@id": "https://scalesmiths.co.uk/about#rhys" },
      { "@id": "https://scalesmiths.co.uk/about#trevor-newton-bradley" },
    ])
    for (const person of people) {
      expect(person.worksFor).toEqual({ "@id": "https://scalesmiths.co.uk/#org" })
      expect(String(person["@id"])).toMatch(/^https:\/\/scalesmiths\.co\.uk\/about#/)
      expect(person.sameAs).toBeUndefined()
    }
  })

  it("only advertises configured https profiles as sameAs", () => {
    const schemas = buildAboutSchemas("https://scalesmiths.co.uk", {
      NEXT_PUBLIC_FOUNDER_RHYS_GITHUB: "https://github.com/TheFridey",
      NEXT_PUBLIC_FOUNDER_RHYS_EMAIL_URL: "mailto:hello@scalesmiths.co.uk",
    })
    const rhys = schemas.find((schema) => schema["@id"] === "https://scalesmiths.co.uk/about#rhys") as Record<string, unknown>

    expect(rhys.sameAs).toEqual(["https://github.com/TheFridey"])
  })

  it("records the Hucknall founding location", () => {
    const schemas = buildAboutSchemas("https://scalesmiths.co.uk", {})
    const organisation = schemas.find((schema) => String(JSON.stringify(schema["@type"])).includes("Organization")) as Record<string, unknown>

    expect(JSON.stringify(organisation.foundingLocation)).toContain("Hucknall")
    expect(JSON.stringify(organisation.foundingLocation)).toContain("Nottinghamshire")
  })
})
