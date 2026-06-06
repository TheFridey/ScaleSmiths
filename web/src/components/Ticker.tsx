const ITEMS = [
  "STRATEGY","SYSTEMS","SCALE","GROWTH","RESULTS",
  "TRUST","PRECISION","CRAFT","EXCELLENCE","VELOCITY",
]

export function Ticker() {
  const repeated = [...ITEMS, ...ITEMS, ...ITEMS, ...ITEMS]
  return (
    <div
      className="overflow-hidden border-y border-b1 py-[13px]"
      aria-hidden="true"
    >
      <div className="ticker-inner">
        {repeated.map((item, i) => (
          <span key={i} className="inline-flex items-center whitespace-nowrap">
            <span className="font-syne text-[11px] font-bold tracking-[.18em] text-t3 px-[22px]">
              {item}
            </span>
            <span className="text-acc text-[9px] opacity-65">◆</span>
          </span>
        ))}
      </div>
    </div>
  )
}
