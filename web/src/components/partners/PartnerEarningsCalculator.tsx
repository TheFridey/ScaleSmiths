"use client"

import { useState } from "react"
import { formatPartnerMoney, illustrativeCommissionMinor } from "@/lib/partner-applications"

export function PartnerEarningsCalculator() {
  const [sales, setSales] = useState(4)
  return <div className="rounded-2xl border border-[#c8aa6e]/40 bg-s1 p-6 md:p-9">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#dbc18e]">Explore the opportunity</p>
    <h3 className="mt-3 font-syne text-2xl font-bold">What could your network unlock?</h3>
    <label htmlFor="partner-sales" className="mt-7 block text-sm text-t2">Completed qualifying standard client sales: <strong className="text-t1">{sales}</strong></label>
    <input id="partner-sales" type="range" min="0" max="20" step="1" value={sales} onChange={(event) => setSales(Number(event.target.value))} className="mt-5 min-h-11 w-full accent-[#c8aa6e]" />
    <div className="mt-4 flex flex-wrap gap-2" aria-label="Illustrative sale counts">{[1, 4, 5, 8, 10].map((count) => <button key={count} type="button" aria-pressed={sales === count} onClick={() => setSales(count)} className={`min-h-11 rounded-lg border px-4 text-sm ${sales === count ? "border-[#c8aa6e] bg-[#c8aa6e] text-black" : "border-b2 text-t2 hover:border-[#c8aa6e]"}`}>{count} {count === 1 ? "sale" : "sales"}</button>)}</div>
    <output htmlFor="partner-sales" aria-live="polite" className="mt-8 block font-syne text-[clamp(32px,8vw,48px)] font-extrabold text-[#dbc18e] md:text-6xl">{formatPartnerMoney(illustrativeCommissionMinor(sales))}</output>
    <p className="mt-2 text-sm font-semibold text-t1">Illustrative gross commission</p>
    <p className="mt-5 max-w-lg text-sm leading-relaxed text-t2">Before your expenses and tax. Assumes every qualifying deposit, final website balance and first monthly payment is collected. Earnings are not guaranteed; payment and final agreement terms apply. This is not a forecast of typical sales.</p>
  </div>
}
