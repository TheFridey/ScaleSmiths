import { describe, expect, it } from "vitest"
import manifest from "../app/manifest"

describe("private admin installation metadata", () => {
  it("provides ordinary raster icons at both install sizes", () => {
    const value = manifest()
    expect(value.display).toBe("standalone")
    expect(value.start_url).toBe("/")
    for (const size of ["192x192", "512x512"]) {
      expect(value.icons?.some((icon) => icon.sizes === size && icon.type === "image/png" && icon.purpose === "any")).toBe(true)
    }
  })
})
