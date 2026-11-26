import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { AcademyShell } from "./AcademyShell"
import { ResourceCentre } from "./ResourceCentre"

/**
 * The browser acceptance depends on `<main data-content-state>` being a truthful readiness signal:
 * `loading` while an asynchronous region is still empty, `ready` once content is on screen. These
 * tests pin that contract at the component boundary, so a later refactor that drops the attribute
 * fails here rather than silently restoring the intermittent browser failure.
 */
const shell = (props: Omit<Parameters<typeof AcademyShell>[0], 'children'>) => renderToStaticMarkup(<AcademyShell {...props}><p>content</p></AcademyShell>)

describe("AcademyShell declares content readiness", () => {
  it("defaults to ready for server-rendered pages", () => {
    expect(shell({ current: "agreement" })).toContain('data-content-state="ready"')
  })

  it("publishes loading while an asynchronous region is empty", () => {
    expect(shell({ current: "resources", contentState: "loading" })).toContain('data-content-state="loading"')
  })

  it("keeps the rest of the frame unchanged", () => {
    const html = shell({ current: "agreement" })
    expect(html).toContain('id="academy-main"')
    expect(html).toContain('class="ac-main"')
  })

  it("exposes the same state to assistive technology, which ignores data attributes", () => {
    expect(shell({ current: "resources", contentState: "loading" })).toContain('aria-busy="true"')
    expect(shell({ current: "agreement" })).toContain('aria-busy="false"')
  })
})

describe("the API-backed partner pages start in the loading state", () => {
  it("Resource Centre renders loading until its data arrives", () => {
    // Server render is the first paint: no fetch has run, so the content the page will show does not exist yet.
    expect(renderToStaticMarkup(<ResourceCentre nav={{ resources: true }} />)).toContain('data-content-state="loading"')
  })
})
