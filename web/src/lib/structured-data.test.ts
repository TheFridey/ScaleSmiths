import { describe, expect, it } from "vitest"
import { serializeJsonLd } from "./json-ld"
import { projects } from "./data"
import { founderBySlug, founders } from "./founders"
import {
  buildAboutSchemas,
  buildCaseStudySchemas,
  buildFounderProfileSchemas,
  buildOrganizationSchema,
  buildPersonSchema,
  buildWebsiteSchema,
} from "./structured-data"
import { teamImages } from "./team-images"

const base = "https://scalesmiths.co.uk"
const orgRef = { "@id": `${base}/#org` }

describe("organisation entity", () => {
  it("publishes one identified professional service with verified identity only", () => {
    const org = buildOrganizationSchema(base, {})

    expect(org["@id"]).toBe(`${base}/#org`)
    expect(org["@type"]).toEqual(["Organization", "ProfessionalService"])
    expect(org.address).toMatchObject({ addressLocality: "Hucknall", addressRegion: "Nottinghamshire", addressCountry: "GB" })
    expect(org.email).toBe("hello@scalesmiths.co.uk")
    expect(JSON.stringify(org.foundingLocation)).toContain("Hucknall")
    // Unverified identifiers must stay absent rather than guessed.
    for (const unverified of ["legalName", "telephone", "foundingDate", "vatID", "sameAs"]) {
      expect(org).not.toHaveProperty(unverified)
    }
  })

  it("links founders to their profile-page Person identifiers", () => {
    const org = buildOrganizationSchema(base, {})
    expect(org.founder.map((person) => person["@id"])).toEqual([
      `${base}/about/rhys#person`,
      `${base}/about/trevor-newton-bradley#person`,
    ])
  })

  it("advertises only configured https business profiles as sameAs", () => {
    const org = buildOrganizationSchema(base, {
      NEXT_PUBLIC_SCALESMITHS_LINKEDIN_URL: "https://www.linkedin.com/company/example",
      NEXT_PUBLIC_SCALESMITHS_INSTAGRAM_URL: "http://insecure.example",
      NEXT_PUBLIC_SCALESMITHS_FACEBOOK_URL: "javascript:alert(1)",
    })
    expect(org.sameAs).toEqual(["https://www.linkedin.com/company/example"])
  })

  it("publishes the website as published by the organisation", () => {
    expect(buildWebsiteSchema(base)).toMatchObject({ "@id": `${base}/#website`, publisher: orgRef })
  })
})

describe("founder entities", () => {
  it("connects each Person to ScaleSmiths via worksFor", () => {
    for (const founder of founders) {
      const person = buildPersonSchema(founder, base, {})
      expect(person.worksFor).toEqual(orgRef)
      expect(person["@id"]).toBe(`${base}/about/${founder.slug}#person`)
      expect(person).not.toHaveProperty("sameAs")
      const photo = teamImages[founder.photo]
      if (photo.available) {
        expect(person.image).toBe(`${base}${photo.src}`)
      } else {
        expect(person).not.toHaveProperty("image")
      }
    }
  })

  it("only advertises configured https founder profiles as sameAs", () => {
    const rhys = buildPersonSchema(founderBySlug("rhys")!, base, {
      NEXT_PUBLIC_FOUNDER_RHYS_GITHUB: "https://github.com/TheFridey",
      NEXT_PUBLIC_FOUNDER_RHYS_EMAIL_URL: "mailto:hello@scalesmiths.co.uk",
    })
    expect(rhys.sameAs).toEqual(["https://github.com/TheFridey"])
  })

  it("publishes a ProfilePage whose main entity is the founder", () => {
    const [profile, breadcrumb] = buildFounderProfileSchemas(founderBySlug("trevor-newton-bradley")!, base, {}) as unknown as [{ "@type": string; mainEntity: { name: string } }, { itemListElement: Array<{ item: string }> }]
    expect(profile["@type"]).toBe("ProfilePage")
    expect(profile.mainEntity.name).toBe("Trevor Newton-Bradley")
    expect(breadcrumb.itemListElement.map((item) => item.item)).toEqual([
      base,
      `${base}/about`,
      `${base}/about/trevor-newton-bradley`,
    ])
  })

  it("keeps the about page free of a second Organization declaration", () => {
    const schemas = buildAboutSchemas(base, {})
    const types = schemas.map((schema) => JSON.stringify(schema["@type"]))
    expect(types).toContain('"AboutPage"')
    expect(types).toContain('"BreadcrumbList"')
    expect(types.filter((type) => type === '"Person"')).toHaveLength(founders.length)
    expect(types.some((type) => type.includes("Organization"))).toBe(false)
  })
})

describe("case study schema", () => {
  it("attributes case studies to the organisation and credits the delivering founder", () => {
    const project = projects.find((candidate) => candidate.slug === "glow-tanning")!
    const [article] = buildCaseStudySchemas(project, base, founderBySlug("rhys")) as unknown as [{ "@type": string; author: { "@id": string }; contributor: { "@id": string }; image: { url: string } }]
    expect(article["@type"]).toBe("Article")
    expect(article.author["@id"]).toBe(`${base}/#org`)
    expect(article.contributor["@id"]).toBe(`${base}/about/rhys#person`)
    expect(article.image.url).toBe(`${base}/images/projects/glow-tanning/hero.jpg`)
  })

  it("omits a founder credit where the project has none", () => {
    const project = projects.find((candidate) => candidate.slug === "precision-finish-plastering-rendering")!
    const [article] = buildCaseStudySchemas(project, base) as Array<Record<string, unknown>>
    expect(article).not.toHaveProperty("contributor")
  })
})

describe("JSON-LD serialisation", () => {
  it("cannot close the surrounding script element", () => {
    expect(serializeJsonLd({ text: "</script><script>alert(1)</script>" })).not.toContain("</script>")
  })
})
