"use client"

import { useEffect, useRef } from "react"

export function ConfirmationDialog({ open, title, children, confirmLabel, danger = false, busy = false, onCancel, onConfirm }: { open: boolean; title: string; children: React.ReactNode; confirmLabel: string; danger?: boolean; busy?: boolean; onCancel: () => void; onConfirm: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onCancel() }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [busy, onCancel, open])
  if (!open) return null
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="presentation">
    <div className="w-full max-w-lg rounded-xl border border-b1 bg-s1 p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
      <h2 id="confirmation-title" className="font-syne text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-2 font-dm text-sm text-t2">{children}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button ref={cancelRef} type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-b2 px-4 py-2 text-sm">Cancel</button>
        <button type="button" disabled={busy} onClick={onConfirm} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${danger ? "bg-red-600" : "bg-acc"}`}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </div>
  </div>
}
