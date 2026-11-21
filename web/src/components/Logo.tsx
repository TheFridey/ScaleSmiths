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

const WORDMARK_WIDTH = 662
const WORDMARK_HEIGHT = 85

/**
 * Site mark is the coding-bracket S extracted from the forge brand plate
 * (gold &lt; over silver &gt;). Optional wordmark sits beside it for wider lockups.
 */
export function Logo({ size = 36, showName = true, className, href = "/", label = "ScaleSmiths" }: LogoProps) {
  const mark = (
    <Image
      src="/brand/scalesmiths-mark.webp"
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
          {/* The silver and gold metallic wordmark is a brand asset: render it, never retype it. */}
          <Image
            src="/brand/scalesmiths-wordmark.webp"
            alt=""
            width={WORDMARK_WIDTH}
            height={WORDMARK_HEIGHT}
            quality={90}
            className="block w-auto max-w-full shrink object-contain"
            style={{ height: Math.max(14, Math.round(size * 0.56)) }}
          />
          <span className="sr-only">{label}</span>
        </>
      ) : null}
    </span>
  )

  return href ? (
    <Link href={href} prefetch={false} aria-label={`${label} home`} className="inline-flex min-w-0 shrink-0 rounded-lg">
      {inner}
    </Link>
  ) : (
    inner
  )
}
