import Image from "next/image"
import { cn } from "@/lib/utils"
import type { ClientLogo as ClientLogoAsset } from "@/lib/client-proof"

interface ClientLogoProps {
  name: string
  logo?: ClientLogoAsset
  /** Rendered height in pixels; width follows the logo's own aspect ratio. */
  height?: number
  /** Force a single-tone treatment regardless of the logo's default. */
  monochrome?: boolean
  className?: string
}

/**
 * An approved client logo, or the client's name set as plain type. Never an approximation of a
 * logo: without an approved file the business is identified by name only.
 */
export function ClientLogo({ name, logo, height = 28, monochrome, className }: ClientLogoProps) {
  if (!logo) {
    return <span className={cn("font-syne font-bold leading-tight tracking-[-.01em]", className)}>{name}</span>
  }

  const width = Math.round((logo.width / logo.height) * height)
  const singleTone = monochrome ?? logo.treatment === "monochrome"

  return (
    <Image
      src={logo.src}
      alt={`${name} logo`}
      width={width}
      height={height}
      className={cn("h-auto max-w-full object-contain", singleTone && "brightness-0 invert opacity-80", className)}
      style={{ height, width: "auto" }}
    />
  )
}
