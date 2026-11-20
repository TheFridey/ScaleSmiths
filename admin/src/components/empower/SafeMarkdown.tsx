import { Fragment, type ReactNode } from "react"
import { Lexer, type Token, type Tokens } from "marked"

/*
 * Operation Empower B1.2 (AP-ENG-02): restricted Markdown for approved lessons.
 * Only marked's tokeniser is used; tokens are mapped to React elements from a fixed allow-list. There is no HTML string and no
 * dangerouslySetInnerHTML anywhere, so raw HTML in a lesson can only ever appear as escaped text. Images render as their alt text
 * (no remote fetches). Links must be HTTPS to an allow-listed host, or a Partner Portal path; anything else renders as plain text.
 */
export const MARKDOWN_LINK_HOSTS = ["scalesmiths.co.uk", "ico.org.uk", "gov.uk"] as const
/** Internal destinations a lesson may link to. Founder, API and other admin routes are refused even though they are same-origin. */
const INTERNAL_PREFIXES = ["/partner/academy", "/partner"] as const

export function safeHref(raw: string): { href: string; external: boolean } | null {
  const href = raw.trim()
  if (!href || /[\u0000-\u001f\u007f\s\\]/.test(href)) return null
  if (href.startsWith("/")) {
    if (href.startsWith("//")) return null
    let url: URL
    try { url = new URL(href, "https://portal.invalid") } catch { return null }
    if (url.origin !== "https://portal.invalid") return null
    const path = url.pathname
    if (!INTERNAL_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))) return null
    if (/\/\.\.?(\/|$)/.test(href) || path.includes("/api/")) return null
    return { href: url.pathname + url.search + url.hash, external: false }
  }
  if (href.startsWith("#")) return /^#[A-Za-z0-9_-]{1,80}$/.test(href) ? { href, external: false } : null
  let url: URL
  try { url = new URL(href) } catch { return null }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  if (!MARKDOWN_LINK_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return null
  return { href: url.toString(), external: true }
}

const MAX_SOURCE = 30000
type Align = "left" | "center" | "right" | null

function inline(tokens: Token[] | undefined, key: string): ReactNode {
  if (!tokens) return null
  return tokens.map((t, i) => <Fragment key={`${key}-${i}`}>{inlineToken(t, `${key}-${i}`)}</Fragment>)
}

function inlineToken(t: Token, key: string): ReactNode {
  switch (t.type) {
    case "text": { const x = t as Tokens.Text; return x.tokens ? inline(x.tokens, key) : x.text }
    case "escape": return (t as Tokens.Escape).text
    case "strong": return <strong>{inline((t as Tokens.Strong).tokens, key)}</strong>
    case "em": return <em>{inline((t as Tokens.Em).tokens, key)}</em>
    case "del": return <del>{inline((t as Tokens.Del).tokens, key)}</del>
    case "codespan": return <code>{(t as Tokens.Codespan).text}</code>
    case "br": return <br />
    case "link": {
      const x = t as Tokens.Link, target = safeHref(x.href)
      const label = inline(x.tokens, key)
      if (!target) return <span className="md-blocked-link">{label}</span>
      return target.external
        ? <a href={target.href} target="_blank" rel="noopener noreferrer nofollow">{label}<span className="sr-only"> (opens in a new tab)</span></a>
        : <a href={target.href}>{label}</a>
    }
    case "image": return (t as Tokens.Image).text ? `[Image: ${(t as Tokens.Image).text}]` : null
    case "html": return (t as Tokens.HTML).text // escaped by React: shown as literal text, never interpreted
    default: return "raw" in t ? String(t.raw) : null
  }
}

function block(t: Token, key: string): ReactNode {
  switch (t.type) {
    case "space": case "def": return null
    case "heading": {
      // Lesson pages already use h1 and h2; author headings start at h3 so the outline stays logical.
      const x = t as Tokens.Heading, level = Math.min(6, Math.max(3, x.depth + 2))
      const H = `h${level}` as "h3" | "h4" | "h5" | "h6"
      return <H>{inline(x.tokens, key)}</H>
    }
    case "paragraph": return <p>{inline((t as Tokens.Paragraph).tokens, key)}</p>
    case "text": { const x = t as Tokens.Text; return <p>{x.tokens ? inline(x.tokens, key) : x.text}</p> }
    case "blockquote": return <blockquote>{(t as Tokens.Blockquote).tokens.map((c, i) => <Fragment key={`${key}-${i}`}>{block(c, `${key}-${i}`)}</Fragment>)}</blockquote>
    case "list": {
      const x = t as Tokens.List
      const items = x.items.map((item, i) => <li key={`${key}-${i}`}>{item.task ? (item.checked ? "☑ " : "☐ ") : null}{item.tokens.map((c, j) => <Fragment key={`${key}-${i}-${j}`}>{c.type === "text" ? inlineToken(c, `${key}-${i}-${j}`) : block(c, `${key}-${i}-${j}`)}</Fragment>)}</li>)
      return x.ordered ? <ol start={typeof x.start === "number" && x.start > 1 ? x.start : undefined}>{items}</ol> : <ul>{items}</ul>
    }
    case "code": return <pre><code>{(t as Tokens.Code).text}</code></pre>
    case "hr": return <hr />
    case "table": {
      const x = t as Tokens.Table
      const align = (a: Align) => (a ? { textAlign: a } : undefined)
      return <div className="md-table" role="region" aria-label="Table" tabIndex={0}><table>
        <thead><tr>{x.header.map((h, i) => <th key={i} scope="col" style={align(x.align[i] as Align)}>{inline(h.tokens, `${key}-h${i}`)}</th>)}</tr></thead>
        <tbody>{x.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} style={align(x.align[c] as Align)}>{inline(cell.tokens, `${key}-${r}-${c}`)}</td>)}</tr>)}</tbody>
      </table></div>
    }
    case "html": return <p>{(t as Tokens.HTML).text}</p>
    default: return "raw" in t ? <p>{String(t.raw)}</p> : null
  }
}

export function SafeMarkdown({ source, className }: { source: string; className?: string }) {
  const text = typeof source === "string" ? source.slice(0, MAX_SOURCE) : ""
  let tokens: Token[]
  try { tokens = new Lexer({ gfm: true, breaks: false }).lex(text) } catch { return <div className={className}><p>{text}</p></div> }
  return <div className={className}>{tokens.map((t, i) => <Fragment key={i}>{block(t, String(i))}</Fragment>)}</div>
}
