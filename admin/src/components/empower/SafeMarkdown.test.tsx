import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { SafeMarkdown, safeHref } from "./SafeMarkdown"

const html = (source: string) => renderToStaticMarkup(<SafeMarkdown source={source} />)

describe("SafeMarkdown renders the supported subset", () => {
  it("renders headings from h3, paragraphs, emphasis, lists, quotes, code and tables", () => {
    const out = html("# Title\n\nSome **bold** and *italic* and `code`.\n\n- one\n- two\n\n1. first\n2. second\n\n> quoted\n\n```\nnpm run build\n```\n\n| A | B |\n|---|:-:|\n| 1 | 2 |")
    expect(out).toContain("<h3>Title</h3>")
    expect(out).toContain("<strong>bold</strong>")
    expect(out).toContain("<em>italic</em>")
    expect(out).toContain("<code>code</code>")
    expect(out).toContain("<ul><li>one</li><li>two</li></ul>")
    expect(out).toContain("<ol><li>first</li><li>second</li></ol>")
    expect(out).toContain("<blockquote><p>quoted</p></blockquote>")
    expect(out).toContain("<pre><code>npm run build</code></pre>")
    expect(out).toContain('<th scope="col">A</th>')
    expect(out).toContain('<td style="text-align:center">2</td>')
  })
  it("renders allowed links safely", () => {
    expect(html("[ICO](https://ico.org.uk/for-organisations/)")).toContain('<a href="https://ico.org.uk/for-organisations/" target="_blank" rel="noopener noreferrer nofollow">ICO')
    expect(html("[Next lesson](/partner/academy/c01?lesson=x)")).toContain('<a href="/partner/academy/c01?lesson=x">Next lesson</a>')
  })
})

describe("SafeMarkdown refuses adversarial content", () => {
  const vectors = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "<iframe src=\"https://evil.example\"></iframe>",
    "<a href=\"javascript:alert(1)\">x</a>",
    "<svg onload=alert(1)>",
    "<style>body{display:none}</style>",
    "Hello <b onclick=\"alert(1)\">there</b>",
  ]
  for (const vector of vectors) it(`never emits live markup for ${vector}`, () => {
    const out = html(vector)
    expect(out).not.toMatch(/<(script|img|iframe|svg|style|b)\b/i)
    // No event-handler attribute on any real element (the escaped text may still show the characters).
    expect(out).not.toMatch(/<[a-z][^>]*\son[a-z]+=/i)
    expect(out).toContain("&lt;")
  })
  const badLinks = [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)",
    "//evil.example/x", "https://evil.example", "http://ico.org.uk/x", "https://ico.org.uk.evil.example", "https://user:pass@ico.org.uk", "https://ico.org.uk:8443/x",
    "/api/expansion", "/expansion", "/admin-users", "/partner/../expansion", "/partner/academy/../../api/partner", "&#106;avascript:alert(1)", "\\\\evil.example",
  ]
  for (const link of badLinks) it(`does not link ${JSON.stringify(link)}`, () => {
    expect(safeHref(link)).toBeNull()
    const out = html(`[click](${link.includes(" ") || link.includes("\t") ? `<${link}>` : link})`)
    expect(out).not.toMatch(/<a\b/)
  })
  it("renders images as alt text without fetching anything", () => {
    const out = html("![Tracking pixel](https://evil.example/p.gif)")
    expect(out).not.toMatch(/<img/)
    expect(out).toContain("[Image: Tracking pixel]")
  })
  it("caps very large input", () => {
    expect(html("a".repeat(40000)).length).toBeLessThan(31000)
  })
})
