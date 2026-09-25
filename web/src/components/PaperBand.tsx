import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react"
import { cn } from "@/lib/utils"

type PaperBandProps<T extends ElementType> = {
  children: ReactNode
  className?: string
  as?: T
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">

/**
 * Shared paper band shell — blueprint daylight with navy↔paper bridge fades.
 * Prefer this over raw `surface-paper` so section padding stays consistent.
 */
export function PaperBand<T extends ElementType = "section">({
  children,
  className,
  as,
  ...rest
}: PaperBandProps<T>) {
  const Tag = (as ?? "section") as ElementType
  return (
    <Tag className={cn("surface-paper px-6 pb-16 pt-20 md:px-12 md:pb-20 md:pt-24", className)} {...rest}>
      {children}
    </Tag>
  )
}
