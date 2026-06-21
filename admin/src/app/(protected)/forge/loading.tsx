export default function ForgeLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 h-7 w-28 animate-pulse rounded-lg bg-s2" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-s2" />
        <div className="mt-3 h-4 w-full max-w-[620px] animate-pulse rounded bg-s2" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-[154px] animate-pulse rounded-xl border bg-s1" style={{ borderColor:"var(--b1)" }} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.4fr_.8fr]">
        <div className="h-[320px] animate-pulse rounded-xl border bg-s1" style={{ borderColor:"var(--b1)" }} />
        <div className="h-[320px] animate-pulse rounded-xl border bg-s1" style={{ borderColor:"var(--b1)" }} />
      </div>
    </div>
  )
}
