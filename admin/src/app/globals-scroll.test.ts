import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// B2.11: a global `body { overflow: hidden }` made every partner page that is not inside the
// founder app shell unscrollable (agreement, Academy, handoffs, activation, recovery, withdrawal).
// The lock is now scoped to documents that contain `.admin-shell`, which scrolls internally.
const css = readFileSync(join(__dirname, "globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")

function rulesFor(selector: RegExp) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(",").some((s) => selector.test(s.trim())))
    .map(([, , body]) => body)
}

describe("document scrolling", () => {
  it("never locks html or body scrolling unconditionally", () => {
    for (const body of [...rulesFor(/^body$/), ...rulesFor(/^html$/)]) {
      expect(body).not.toMatch(/overflow(-y)?\s*:\s*(hidden|clip)/)
    }
    // A fixed body height plus a lock elsewhere would clip content again; body may only set a minimum.
    for (const body of rulesFor(/^body$/)) expect(body).not.toMatch(/(^|;|\s)height\s*:/)
  })

  it("locks the document only when the founder app shell is mounted", () => {
    const scoped = rulesFor(/^html:has\(\.admin-shell\)( body)?$/)
    expect(scoped.join(";")).toMatch(/overflow\s*:\s*hidden/)
  })

  it("keeps the founder shell's own scroll region", () => {
    expect(rulesFor(/^\.admin-main$/).join(";")).toMatch(/overflow-y\s*:\s*auto/)
  })
})
