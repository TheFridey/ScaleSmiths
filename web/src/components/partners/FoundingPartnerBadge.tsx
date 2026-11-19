/** ScaleSmiths Founding Partner badge: presentational SVG, no network requests. Shown only for founder-approved recognition. */
export function FoundingPartnerBadge({ year, size = 168 }: { year?: string; size?: number }) {
  const label = `ScaleSmiths Founding Partner${year ? `, recognised ${year}` : ""}`
  return (
    <svg role="img" aria-label={label} width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fp-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e3a1" /><stop offset="0.45" stopColor="#c9a24a" /><stop offset="1" stopColor="#8a6a21" /></linearGradient>
        <linearGradient id="fp-ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#14213d" /><stop offset="1" stopColor="#0a1226" /></linearGradient>
      </defs>
      <path d="M100 8 L176 36 V100 C176 146 144 176 100 192 C56 176 24 146 24 100 V36 Z" fill="url(#fp-ink)" stroke="url(#fp-gold)" strokeWidth="5" strokeLinejoin="round" />
      <path d="M100 22 L162 45 V100 C162 138 136 163 100 177 C64 163 38 138 38 100 V45 Z" fill="none" stroke="url(#fp-gold)" strokeWidth="1.5" opacity="0.7" />
      <g transform="translate(100 78)" fill="url(#fp-gold)"><path d="M0 -24 L7 -7 L25 -7 L11 4 L16 22 L0 11 L-16 22 L-11 4 L-25 -7 L-7 -7 Z" /></g>
      <text x="100" y="124" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="13" letterSpacing="3" fill="#f6e3a1">SCALESMITHS</text>
      <text x="100" y="142" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="11" letterSpacing="2.4" fill="#e9d79b">FOUNDING PARTNER</text>
      {year ? <text x="100" y="161" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="11" fill="#c9a24a">{year}</text> : null}
    </svg>
  )
}
