"use client"

import { useState } from "react"
import { formatPartnerMoney } from "@/lib/partner-applications"
import { BESPOKE_EXAMPLES_PENCE, bespokeCommission, saleCommission, type SaleKind } from "@/lib/partner-programme"

type Mode = SaleKind | "bespoke"
const MODES: ReadonlyArray<{ id: Mode; label: string }> = [
  { id: "standard", label: "Standard website" },
  { id: "discounted", label: "Discounted website" },
  { id: "free-build", label: "Approved free build" },
  { id: "retainer-only", label: "Growth Partnership only" },
  { id: "bespoke", label: "Bespoke project" },
]
const DISCOUNTS = [150000, 100000, 50000]

export function PartnerEarningsCalculator() {
  const [mode, setMode] = useState<Mode>("standard")
  const [sales, setSales] = useState(4)
  const [fee, setFee] = useState(150000)
  const [project, setProject] = useState(25000)
  const bespoke = mode === "bespoke"
  const one = bespoke ? null : saleCommission(mode, BigInt(fee))
  const buildCommission = bespoke ? bespokeCommission(BigInt(project) * BigInt(100)) : one!.build * BigInt(sales)
  const retainerCommission = bespoke ? BigInt(0) : one!.retainer * BigInt(sales)
  const total = buildCommission + retainerCommission
  const pill = (active: boolean) => `min-h-11 rounded-lg border px-4 text-sm ${active ? "border-[#c8aa6e] bg-[#c8aa6e] text-black" : "border-b2 text-t2 hover:border-[#c8aa6e]"}`
  return <div className="rounded-2xl border border-[#c8aa6e]/40 bg-s1 p-6 md:p-9">
    <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#dbc18e]">Explore the opportunity</p>
    <h3 className="mt-3 font-syne text-2xl font-bold">What could your network unlock?</h3>
    <div role="group" aria-label="Sale type" className="mt-6 flex flex-wrap gap-2">{MODES.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => setMode(item.id)} className={pill(mode === item.id)}>{item.label}</button>)}</div>
    {bespoke ? <div className="mt-7">
      <label htmlFor="partner-project" className="block text-sm text-t2">Illustrative eligible collected project value: <strong className="text-t1">{formatPartnerMoney(BigInt(project) * BigInt(100))}</strong></label>
      <input id="partner-project" type="range" min="5000" max="250000" step="5000" value={project} onChange={(e) => setProject(Number(e.target.value))} className="mt-5 min-h-11 w-full accent-[#c8aa6e]" />
      <div className="mt-4 flex flex-wrap gap-2">{BESPOKE_EXAMPLES_PENCE.map((v) => { const pounds = Number(v / BigInt(100)); return <button key={pounds} type="button" aria-pressed={project === pounds} onClick={() => setProject(pounds)} className={pill(project === pounds)}>{formatPartnerMoney(v)}</button> })}</div>
    </div> : <div className="mt-7">
      <label htmlFor="partner-sales" className="block text-sm text-t2">Completed qualifying sales: <strong className="text-t1">{sales}</strong></label>
      <input id="partner-sales" type="range" min="0" max="20" step="1" value={sales} onChange={(e) => setSales(Number(e.target.value))} className="mt-5 min-h-11 w-full accent-[#c8aa6e]" />
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Illustrative sale counts">{[1, 2, 4, 5, 8, 10, 15, 20].map((count) => <button key={count} type="button" aria-pressed={sales === count} onClick={() => setSales(count)} className={pill(sales === count)}>{count}</button>)}</div>
      {mode === "discounted" ? <div role="group" aria-label="Approved build fee" className="mt-5 flex flex-wrap items-center gap-2"><span className="text-sm text-t2">Approved build fee:</span>{DISCOUNTS.map((d) => <button key={d} type="button" aria-pressed={fee === d} onClick={() => setFee(d)} className={pill(fee === d)}>{formatPartnerMoney(BigInt(d))}</button>)}</div> : null}
    </div>}
    <output aria-live="polite" className="mt-8 block font-syne text-[clamp(32px,8vw,48px)] font-extrabold text-[#dbc18e] md:text-6xl">{formatPartnerMoney(total)}</output>
    <p className="mt-2 text-sm font-semibold text-t1">Illustrative gross commission{bespoke ? "" : sales > 0 ? ` · ${formatPartnerMoney(total * BigInt(12))} annual equivalent if repeated monthly` : ""}</p>
    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-lg border border-b2 p-3"><dt className="text-t3">{bespoke ? "Bespoke project commission" : "Build commission"}</dt><dd className="mt-1 font-semibold tabular-nums">{formatPartnerMoney(buildCommission)}</dd></div><div className="rounded-lg border border-b2 p-3"><dt className="text-t3">Initial retainer commission</dt><dd className="mt-1 font-semibold tabular-nums">{formatPartnerMoney(retainerCommission)}</dd></div></dl>
    <p className="mt-5 text-sm leading-relaxed text-t2">Gross, before your expenses and tax. Assumes every eligible payment is actually collected, possibly across several months. No guaranteed earnings or sales volume. Bespoke quotations need founder approval, and arrangements in other countries may vary. Achievement and referral rewards are separate, planned and conditional, and are not included here.</p>
  </div>
}
