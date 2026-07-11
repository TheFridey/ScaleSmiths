import { describe, expect, it } from "vitest"
import { diffArtifactText } from "./forge-artifacts"

describe("artifact lineage diff", () => {
  it("reports additions, removals and replacements by line", () => {
    expect(diffArtifactText("one\ntwo", "one\nchanged\nthree")).toEqual([
      { line: 2, before: "two", after: "changed" },
      { line: 3, before: null, after: "three" },
    ])
  })
})
