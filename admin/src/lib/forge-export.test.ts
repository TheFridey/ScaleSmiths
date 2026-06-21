import { describe, expect, it } from "vitest"
import {
  FORGE_EXPORT_ARTIFACT_KIND,
  appendForgeExportRecord,
  buildForgeSeoChecklistJson,
  buildForgeSeoChecklistMarkdown,
  filterForgeExportableFiles,
  forgeExportContentType,
  forgeExportFilename,
  isForgeExportableFile,
  readForgeExportArtifact,
  type ForgeExportRecord,
} from "./forge-export"
import { createForgeZipArchive } from "./server/forge-zip"
import { buildForgeSeoPack, type ForgeSeoBusiness, type ForgeSeoPageInput } from "./forge-seo"

describe("forge export allowlist / denylist", () => {
  it("allows ordinary generated workspace files", () => {
    for (const path of [
      "package.json",
      "next.config.mjs",
      "src/app/page.tsx",
      "src/app/sitemap.ts",
      "src/components/Hero.tsx",
      "src/lib/seo.ts",
      "README.md",
      "public/favicon.ico",
    ]) {
      expect(isForgeExportableFile(path).ok).toBe(true)
    }
  })

  it("denies env files, secrets, and credential configs", () => {
    for (const path of [
      ".env",
      ".env.local",
      ".env.production",
      "src/.env",
      ".npmrc",
      ".netrc",
      "certs/server.pem",
      "keys/private.key",
      "id_rsa",
      "config/secret.json",
      "src/lib/credentials.ts",
      "deploy.pfx",
    ]) {
      expect(isForgeExportableFile(path).ok).toBe(false)
    }
  })

  it("denies node_modules, build output, VCS, and internal app directories", () => {
    for (const path of [
      "node_modules/react/index.js",
      ".next/server/app.js",
      ".git/config",
      ".turbo/cache.json",
      ".vercel/project.json",
      "admin/src/lib/schema.ts",
      "web/src/app/page.tsx",
    ]) {
      expect(isForgeExportableFile(path).ok).toBe(false)
    }
  })

  it("denies path traversal and absolute paths", () => {
    expect(isForgeExportableFile("../admin/secrets.ts").ok).toBe(false)
    expect(isForgeExportableFile("/etc/passwd").ok).toBe(false)
    expect(isForgeExportableFile("C:/Windows/system32").ok).toBe(false)
    expect(isForgeExportableFile("src/..\\..\\x").ok).toBe(false)
    expect(isForgeExportableFile("").ok).toBe(false)
  })

  it("partitions a file list into included and excluded with reasons", () => {
    const { included, excluded } = filterForgeExportableFiles([
      "src/app/page.tsx",
      "package.json",
      ".env",
      "node_modules/x/index.js",
      "keys/site.pem",
    ])
    expect(included).toEqual(["src/app/page.tsx", "package.json"])
    expect(excluded.map((entry) => entry.path)).toEqual([".env", "node_modules/x/index.js", "keys/site.pem"])
    expect(excluded.every((entry) => typeof entry.reason === "string" && entry.reason.length > 0)).toBe(true)
  })

  it("builds safe filenames and content types per kind", () => {
    expect(forgeExportFilename("site", "Acme Repairs", "2026-06-21")).toBe("acme-repairs-site-2026-06-21.zip")
    expect(forgeExportFilename("proposal", "Acme Repairs", "2026-06-21")).toBe("acme-repairs-proposal-2026-06-21.md")
    expect(forgeExportFilename("handover", "Acme Repairs", "2026-06-21")).toBe("acme-repairs-handover-pack-2026-06-21.zip")
    expect(forgeExportContentType("proposal")).toContain("markdown")
    expect(forgeExportContentType("site")).toBe("application/zip")
    expect(forgeExportContentType("handover")).toBe("application/zip")
  })
})

describe("forge export records", () => {
  function record(kind: ForgeExportRecord["kind"], createdAt: string): ForgeExportRecord {
    return { kind, filename: `${kind}.zip`, contentType: "application/zip", fileCount: 3, byteSize: 100, excludedCount: 1, actor: "admin", createdAt }
  }

  it("appends records newest-first and reads them back", () => {
    let records: ForgeExportRecord[] = []
    records = appendForgeExportRecord(records, record("site", "2026-06-20T10:00:00.000Z"))
    records = appendForgeExportRecord(records, record("proposal", "2026-06-21T10:00:00.000Z"))
    expect(records[0].kind).toBe("proposal")

    const state = readForgeExportArtifact({ kind: FORGE_EXPORT_ARTIFACT_KIND, records })
    expect(state.records.length).toBe(2)
    expect(state.lastExportAt).toBe("2026-06-21T10:00:00.000Z")
    expect(readForgeExportArtifact(null).records).toEqual([])
  })
})

describe("forge SEO checklist export", () => {
  function pack() {
    const business: ForgeSeoBusiness = {
      businessName: "Acme Repairs",
      industry: "Industrial repairs",
      siteUrl: "https://acme.example",
      primaryLocation: "Nottingham",
      serviceAreas: ["Nottingham", "Derby"],
      telephone: null,
      email: null,
      sameAs: [],
    }
    const page: ForgeSeoPageInput = {
      title: "Emergency Repairs",
      path: "/emergency-repairs",
      template: "service",
      keyword: "emergency repairs nottingham",
      metaDescription: "Fast emergency industrial repairs across Nottingham and Derby from Acme Repairs with an accredited team and rapid response.",
      h1: "Emergency industrial repairs in Nottingham",
      heroSubheading: "When equipment fails, Acme Repairs restores production fast across Nottingham with an accredited team and clear next steps.",
      bodyText: "Acme Repairs handles urgent breakdowns for manufacturers in Nottingham, diagnosing faults and restoring production quickly.",
      faqItems: [
        { question: "How fast can you attend?", answer: "Acme Repairs aims to attend emergencies across Nottingham within hours depending on the equipment." },
        { question: "Do you cover Derby?", answer: "Yes, Acme Repairs covers Nottingham and Derby for emergency repairs and maintenance." },
      ],
      serviceName: "Emergency Repairs",
      trustElements: ["Accredited engineers"],
      localSeoCopy: "Acme Repairs supports manufacturers across Nottingham and Derby.",
    }
    return buildForgeSeoPack(business, [page])
  }

  it("exports the SEO checklist as markdown and JSON", () => {
    const seo = pack()
    const markdown = buildForgeSeoChecklistMarkdown(seo)
    expect(markdown).toContain("# SEO / AEO / GEO Checklist — Acme Repairs")
    expect(markdown).toContain("## SEO (Google)")
    expect(markdown).toMatch(/- \[x\]|\[ \]/)

    const json = JSON.parse(buildForgeSeoChecklistJson(seo))
    expect(json.business).toBe("Acme Repairs")
    expect(json.score.overall).toBe(seo.score.overall)
    expect(Array.isArray(json.checklist)).toBe(true)
  })
})

describe("forge zip archive", () => {
  it("creates a valid ZIP container with a central directory", () => {
    const zip = createForgeZipArchive([
      { path: "proposal.md", content: "# Proposal\n".repeat(50) },
      { path: "seo-checklist.json", content: JSON.stringify({ score: 90 }) },
    ])

    expect(Buffer.isBuffer(zip)).toBe(true)
    // Local file header signature "PK\x03\x04".
    expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
    // End of central directory signature "PK\x05\x06" appears near the end.
    expect(zip.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true)
    // Both entry names are present in the central directory.
    expect(zip.includes(Buffer.from("proposal.md"))).toBe(true)
    expect(zip.includes(Buffer.from("seo-checklist.json"))).toBe(true)
  })
})
