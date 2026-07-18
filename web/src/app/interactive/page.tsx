import type { Metadata } from "next"
import Link from "next/link"
import { V2InteractiveExperience } from "@/components/v2/V2InteractiveExperience"

export const metadata: Metadata = {
  title: "ScaleSmiths V2.0 Interactive Experience",
  description:
    "A focused interactive ScaleSmiths workspace for shaping the right website, app, commerce, portal, or automation route.",
  alternates: {
    canonical: "/interactive",
  },
  openGraph: { url: "/interactive" },
  robots: { index: true, follow: true },
}

export default function InteractivePage() {
  return (
    <>
      <noscript>
        <section aria-labelledby="interactive-fallback-heading" className="min-h-screen bg-bg px-6 py-24 text-t1 md:px-12">
          <div className="mx-auto max-w-[900px] rounded-lg border border-b2 bg-s1 p-8">
            <p className="font-dm text-sm font-semibold uppercase tracking-[0.14em] text-acc">ScaleSmiths V2.0</p>
            <h1 id="interactive-fallback-heading" className="mt-4 font-syne text-4xl font-black leading-[1.04] tracking-normal">
              Welcome to the future of business websites.
            </h1>
            <p className="mt-5 font-dm text-lg leading-relaxed text-t2">
              We are not going to show you a website. We are going to build one around your business.
            </p>
            <h2 className="mt-10 font-syne text-2xl font-black tracking-normal">Journey timeline</h2>
            <ol className="mt-5 grid gap-4 md:grid-cols-4">
              {["Understand", "Simulate", "Forge", "Launch"].map((step) => (
                <li key={step} className="rounded-lg border border-b1 bg-bg p-4 font-dm font-semibold">
                  {step}
                </li>
              ))}
            </ol>
            <p className="mt-8 font-dm text-sm text-t2">
              JavaScript is required for the guided industry selector. You can still use the normal ScaleSmiths site or request a project directly.
            </p>
            <p className="mt-5 flex flex-wrap gap-3">
              <Link href="/" className="btn-ghost">Exit to normal site</Link>
              <Link href="/quote" className="btn-primary">Start a project</Link>
            </p>
          </div>
        </section>
      </noscript>
      <V2InteractiveExperience />
    </>
  )
}
