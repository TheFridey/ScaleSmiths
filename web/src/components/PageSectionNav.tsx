"use client"

import { useEffect, useState } from "react"

export interface PageSectionNavItem {
  id: string
  label: string
}

/**
 * Sticky jump links for long technical pages (Enterprise, Delivery, flagship case studies).
 * Progressive disclosure via navigation, depth stays on the page; orientation stays visible.
 */
export function PageSectionNav({
  items,
  label = "On this page",
}: {
  items: readonly PageSectionNavItem[]
  label?: string
}) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    if (items.length === 0) return

    const nodes = items
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node))

    if (nodes.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]?.target
        if (top?.id) setActiveId(top.id)
      },
      {
        // Account for sticky site nav + this bar so the active section feels natural.
        rootMargin: "-25% 0px -55% 0px",
        threshold: [0, 0.25, 0.5, 1],
      },
    )

    for (const node of nodes) observer.observe(node)
    return () => observer.disconnect()
  }, [items])

  if (items.length < 3) return null

  return (
    <nav
      aria-label={label}
      className="sticky top-[calc(var(--nav-offset,4.5rem))] z-30 border-b border-b1/80 bg-bg/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1240px] items-center gap-3 overflow-x-auto px-6 py-3 md:px-12">
        <span className="hidden shrink-0 font-dm text-[11px] font-semibold uppercase tracking-[.12em] text-t3 sm:inline">
          {label}
        </span>
        <ul className="flex min-w-0 flex-1 gap-1.5">
          {items.map((item) => {
            const active = item.id === activeId
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={`#${item.id}`}
                  className={
                    active
                      ? "inline-flex min-h-9 items-center rounded-md border border-acc/40 bg-acc/10 px-3 py-1.5 font-dm text-xs font-semibold text-t1"
                      : "inline-flex min-h-9 items-center rounded-md border border-transparent px-3 py-1.5 font-dm text-xs text-t2 transition-colors hover:border-b1 hover:bg-s1 hover:text-t1"
                  }
                  aria-current={active ? "true" : undefined}
                >
                  {item.label}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
