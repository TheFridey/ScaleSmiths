import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { JsonLd } from "@/components/JsonLd"
import { siteBaseUrl } from "@/lib/site-identity"
import { buildBreadcrumbSchema } from "@/lib/structured-data"

export interface BreadcrumbItem {
  name: string
  href?: string
}

export function Breadcrumbs({ items, className = "" }: { items: readonly BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`font-dm text-xs text-t3 ${className}`.trim()}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li key={`${item.name}-${index}`} className="contents">
              {index > 0 ? <ChevronRight size={12} aria-hidden="true" /> : null}
              {current || !item.href ? (
                <span aria-current={current ? "page" : undefined} className={current ? "text-t1" : undefined}>{item.name}</span>
              ) : (
                <Link href={item.href} prefetch={false} className="rounded-sm hover:text-t1">{item.name}</Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * The visible trail plus its matching BreadcrumbList schema, from one declaration, so the two
 * cannot drift apart. `items` is ordered root-first; the last entry is the current page and is
 * rendered as text rather than a link.
 */
export function PageBreadcrumbs({ items, className }: { items: ReadonlyArray<{ name: string; path: string }>; className?: string }) {
  return (
    <>
      <JsonLd data={buildBreadcrumbSchema(siteBaseUrl(), items)} />
      <Breadcrumbs
        className={className}
        items={items.map((item, index) => ({ name: item.name, href: index < items.length - 1 ? item.path : undefined }))}
      />
    </>
  )
}
