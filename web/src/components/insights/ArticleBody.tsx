import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { headingId, type InsightBlock } from "@/lib/insights"

const isDevelopment = process.env.NODE_ENV !== "production"
const LINK_PATTERN = /\[([^\]]+)\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g

/** Renders `[label](/path)` links inside plain text. Nothing else is interpreted. */
export function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let cursor = 0
  for (const match of text.matchAll(LINK_PATTERN)) {
    const [whole, label, href] = match
    const index = match.index ?? 0
    if (index > cursor) parts.push(text.slice(cursor, index))
    parts.push(
      href.startsWith("/") ? (
        <Link key={index} href={href} prefetch={false} className="text-t1 underline decoration-acc/60 underline-offset-4 hover:decoration-acc">{label}</Link>
      ) : (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="text-t1 underline decoration-acc/60 underline-offset-4 hover:decoration-acc">{label}</a>
      ),
    )
    cursor = index + whole.length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

function Block({ block }: { block: InsightBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 id={headingId(block.text)} className="mt-14 scroll-mt-28 font-syne text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-.02em] first:mt-0">{block.text}</h2>
    case "subheading":
      return <h3 className="mt-9 font-syne text-xl font-bold">{block.text}</h3>
    case "paragraph":
      return <p className="mt-5 font-dm text-[17px] leading-[1.8] text-t2"><InlineText text={block.text} /></p>
    case "list": {
      const List = block.ordered ? "ol" : "ul"
      return (
        <List className={`mt-5 grid gap-2 pl-5 font-dm text-[17px] leading-[1.75] text-t2 ${block.ordered ? "list-decimal" : "list-disc"} marker:text-acc`}>
          {block.items.map((item) => <li key={item} className="pl-1"><InlineText text={item} /></li>)}
        </List>
      )
    }
    case "quote":
      return (
        <figure className="mt-8 border-l-2 border-acc pl-6">
          <blockquote className="font-syne text-xl font-bold leading-snug text-t1"><p>{block.text}</p></blockquote>
          {block.cite ? <figcaption className="mt-3 font-dm text-sm text-t3">{block.cite}</figcaption> : null}
        </figure>
      )
    case "callout":
      return (
        <aside className="mt-8 rounded-xl border border-b1 bg-s1 p-5">
          <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">{block.title}</p>
          <p className="mt-2 font-dm text-[15px] leading-relaxed text-t2"><InlineText text={block.text} /></p>
        </aside>
      )
    case "image":
      return (
        <figure className="mt-8">
          <Image src={block.src} alt={block.alt} width={block.width} height={block.height} sizes="(min-width: 1024px) 760px, 100vw" className="h-auto w-full rounded-xl border border-b1" />
          {block.caption ? <figcaption className="mt-3 font-dm text-sm text-t3">{block.caption}</figcaption> : null}
        </figure>
      )
    case "code":
      return (
        <pre className="mt-6 overflow-x-auto rounded-xl border border-b1 bg-bg p-5 font-mono text-sm leading-relaxed text-t2">
          <code data-language={block.language}>{block.code}</code>
        </pre>
      )
    case "diagram":
      return (
        <figure className="mt-8 overflow-hidden rounded-xl border border-acc/25 bg-[linear-gradient(180deg,rgba(232,160,69,0.06),transparent_40%),#0a0908]">
          {block.title ? (
            <figcaption className="border-b border-b1 px-5 py-3 font-dm text-xs font-semibold uppercase tracking-[.12em] text-acc">
              {block.title}
            </figcaption>
          ) : null}
          <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-t2">
            <code>{block.code}</code>
          </pre>
        </figure>
      )
    case "authorNote":
      return isDevelopment ? (
        <p className="mt-5 rounded-lg border border-dashed border-b2 px-4 py-3 font-dm text-sm text-t3">Author note (dev only): {block.text}</p>
      ) : null
  }
}

export function ArticleBody({ blocks }: { blocks: InsightBlock[] }) {
  return <div>{blocks.map((block, index) => <Block key={index} block={block} />)}</div>
}

export function TableOfContents({ items }: { items: Array<{ id: string; text: string }> }) {
  if (items.length < 3) return null
  return (
    <nav aria-label="On this page" className="rounded-2xl border border-b1 bg-s1 p-5">
      <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">On this page</p>
      <ol className="mt-4 grid gap-2.5">
        {items.map((item) => (
          <li key={item.id}>
            <a href={`#${item.id}`} className="font-dm text-sm leading-snug text-t2 transition-colors hover:text-t1">{item.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
