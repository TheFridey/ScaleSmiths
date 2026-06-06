import Link from "next/link"

export function Logo({ size = 28 }: { size?: number }) {
  const h = Math.round(size * 1.12)
  return (
    <Link href="/dashboard" className="inline-flex items-center gap-2.5" aria-label="ScaleSmiths Admin home">
      <svg width={size} height={h} viewBox="-2 -1 54 58" fill="none" aria-hidden="true">
        <path d="M 36 10 A 16 16 0 1 0 36 26" stroke="white" strokeWidth="4.5" strokeLinecap="round"/>
        <path d="M 18 32 A 14 14 0 1 1 18 46" stroke="rgba(195,195,195,0.7)" strokeWidth="4.5" strokeLinecap="round"/>
      </svg>
      <span className="font-syne font-bold" style={{ fontSize: Math.round(size * 0.5) }}>
        <span className="text-white">Scale</span><span style={{color:"#b8b8b8"}}>Smiths</span>
      </span>
    </Link>
  )
}
