import { describe, expect, it } from "vitest"
import { quoteThanksMetadata } from "./metadata"

describe("quote thanks metadata", () => {
  it("keeps the thank-you page out of search indexes", () => {
    expect(quoteThanksMetadata.robots).toEqual({ index: false, follow: false })
  })
})
