import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface LogoProps {
  size?: number
  showName?: boolean
  className?: string
  href?: string
  label?: string
}

/**
 * Site mark is the coding-bracket S extracted from the forge brand plate
 * (gold &lt; over silver &gt;). Optional wordmark sits beside it for wider lockups.
 */
export function Logo({ size = 36, showName = true, className, href = "/", label = "ScaleSmiths" }: LogoProps) {
  const mark = (
    <Image
      src="/brand/scalesmiths-mark.png"
      alt={showName ? "" : label}
      width={size}
      height={size}
      priority
      quality={90}
      className="block h-auto w-auto shrink-0 object-contain drop-shadow-[0_2px_12px_rgba(232,160,69,0.22)]"
    />
  )

  const inner = (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {mark}
      {showName ? (
        <>
          <span
            className="font-syne font-semibold uppercase leading-none tracking-[0.22em]"
            style={{ fontSize: Math.max(12, Math.round(size * 0.38)) }}
            aria-hidden="true"
          >
            <span className="text-[#d4cdc3]">Scale</span>
            <span className="text-acc">Smiths</span>
          </span>
          <span className="sr-only">{label}</span>
        </>
      ) : null}
    </span>
  )

  return href ? (
    <Link href={href} prefetch={false} aria-label={`${label} home`}>
      {inner}
    </Link>
  ) : (
    inner
  )
}
