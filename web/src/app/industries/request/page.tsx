import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { buildPageMetadata } from "@/lib/page-metadata"
import { missingIndustryHref } from "@/lib/industries/commercial"

export const metadata = buildPageMetadata({
  title: "Tell us your industry",
  description:
    "Cannot find your industry page yet? Tell ScaleSmiths what you run and what is holding growth back. We expand the directory from real demand, not thin copies.",
  path: "/industries/request",
  robots: { index: false, follow: true },
})

export default async function MissingIndustryRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ hint?: string | string[] }>
}) {
  const params = await searchParams
  const hintRaw = Array.isArray(params.hint) ? params.hint[0] : params.hint
  const hint = (hintRaw ?? "").trim().slice(0, 80)
  const href = missingIndustryHref(hint || undefined)

  return (
    <main className="px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-[820px]">
        <Breadcrumbs
          items={[
            { name: "Home", href: "/" },
            { name: "Industries", href: "/industries" },
            { name: "Request" },
          ]}
        />
        <span className="mt-10 block font-dm text-xs font-semibold uppercase tracking-[0.14em] text-acc">Missing industry</span>
        <h1 className="page-hero-display mt-3">Whatever you run, tell us what is holding it back.</h1>
        <p className="mt-6 font-dm text-lg leading-relaxed text-t2">
          If your sector is not listed, tell us what you run and what is getting in the way. We write an industry page when we can say something specific about that business. Until then, the useful next step is a conversation about yours.
        </p>
        {hint ? (
          <p className="mt-4 rounded-xl border border-b1 bg-s1 px-4 py-3 font-dm text-sm text-t2">
            Looking for: <span className="font-semibold text-t1">{hint}</span>
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={href} prefetch={false} className="btn-primary font-dm">
            Start the conversation <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/industries" prefetch={false} className="btn-ghost font-dm">
            Back to industries
          </Link>
        </div>
        <p className="mt-6 font-dm text-sm text-t3">
          Or browse published pages and hubs while we expand coverage from evidence, not vanity page counts.
        </p>
      </div>
    </main>
  )
}
