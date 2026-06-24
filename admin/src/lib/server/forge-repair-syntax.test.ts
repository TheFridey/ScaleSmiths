import { describe, expect, it } from "vitest"
import type { ForgeRepairPatch } from "@/lib/forge-qa"
import { validateForgeRepairPatchSyntax } from "./forge-repair-syntax"

function patch(path: string, content: string): ForgeRepairPatch {
  return { path, content, reason: "test" }
}

describe("validateForgeRepairPatchSyntax", () => {
  it("accepts well-formed TypeScript replacements", async () => {
    const result = await validateForgeRepairPatchSyntax([
      patch("src/lib/site-data.ts", "export const site = { name: \"Acme\" } as const\n"),
      patch("src/components/Hero.tsx", "export function Hero() { return <div>hi</div> }\n"),
    ])
    expect(result).toEqual({ ok: true })
  })

  it("rejects a truncated replacement with an unterminated string literal", async () => {
    // Mimics an AI repair response cut off at the token budget mid-string.
    const truncated = "export const site = {\n  \"businessName\": \"RTX Gam"
    const result = await validateForgeRepairPatchSyntax([patch("src/lib/site-data.ts", truncated)])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("src/lib/site-data.ts")
      expect(result.error).toContain("TS1002")
      expect(result.error).toContain("truncated")
    }
  })

  it("rejects unbalanced braces from a cut-off object literal", async () => {
    const truncated = "export const site = {\n  name: \"Acme\",\n  nav: [{ label: \"Home\""
    const result = await validateForgeRepairPatchSyntax([patch("src/lib/site-data.ts", truncated)])
    expect(result.ok).toBe(false)
  })

  it("ignores non-source files such as markdown and json-less assets", async () => {
    const result = await validateForgeRepairPatchSyntax([
      patch("README.md", "# Notes\n\nthis is not \"valid typescript but should be skipped"),
    ])
    expect(result).toEqual({ ok: true })
  })

  it("does not flag type errors, only syntax (real typecheck runs separately)", async () => {
    // Semantically wrong but syntactically valid: should pass this gate.
    const result = await validateForgeRepairPatchSyntax([
      patch("src/lib/site-data.ts", "export const n: number = \"not a number\"\n"),
    ])
    expect(result).toEqual({ ok: true })
  })
})
