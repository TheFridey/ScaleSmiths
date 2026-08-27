import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("admin middleware cache policy", () => {
  it("marks both continued and generated dynamic responses private and non-cacheable", async () => {
    const middleware = await readFile(new URL("../middleware.ts", import.meta.url), "utf8")

    expect(middleware).toContain('const PRIVATE_NO_STORE = "private, no-store, max-age=0"')
    expect(middleware.match(/response\.headers\.set\("Cache-Control", PRIVATE_NO_STORE\)/g)).toHaveLength(2)
  })

  it("keeps immutable Next.js assets outside middleware", async () => {
    const middleware = await readFile(new URL("../middleware.ts", import.meta.url), "utf8")

    expect(middleware).toContain('(?!_next/static|_next/image|favicon.ico)')
  })
})
