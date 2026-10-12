import Image from "next/image"
import Link from "next/link"

export function Logo({ size = 28, compact = false }: { size?: number; compact?: boolean }) {
  return <Link href="/" className="admin-brand-link" aria-label="ScaleSmiths Admin home">
    <Image src="/brand/favicon.png" alt="" width={size} height={size} unoptimized priority />
    {!compact && <span className="admin-brand-name">ScaleSmiths</span>}
  </Link>
}
