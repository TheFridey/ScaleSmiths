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

export function Logo({ size = 32, showName = true, className, href = "/", label = "ScaleSmiths" }: LogoProps) {
  const asset = showName
    ? { src: "/brand/scalesmiths-wordmark.png", width: 729, height: 118 }
    : { src: "/brand/scalesmiths-mark.png", width: 302, height: 313 }
  const height = showName ? Math.round(size * 1.08) : size
  const width = Math.round((asset.width / asset.height) * height)
  const inner = (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src={asset.src}
        alt={label}
        width={width}
        height={height}
        priority={showName}
        className="block h-auto w-auto object-contain"
      />
    </span>
  )

  return href ? (
    <Link href={href} aria-label={`${label} home`}>{inner}</Link>
  ) : inner
}
