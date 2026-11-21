"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowRight, RotateCcw } from "lucide-react"
import { CONTACT_EMAIL } from "@/lib/site-identity"
import { captureGlobalRenderError } from "./global-error-content"

/**
 * Route-level 500. Renders inside the site chrome, so the header, footer and every route
 * stay reachable. No error detail is shown: the digest is the only reference, and it is
 * safe to quote to us because it carries no message or stack.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    captureGlobalRenderError(error)
  }, [error])

  return (
    <div className="px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-[1000px]">
        <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Error 500</p>
        <h1 className="mt-3 font-syne text-[clamp(38px,6.5vw,72px)] font-black leading-[1.02] tracking-[-.04em]">
          This page didn&apos;t load.
        </h1>
        <p className="mt-5 max-w-[620px] font-dm text-lg leading-relaxed text-t2">
          Something went wrong on our side, not yours. It has been logged. Try again, or carry on from one of the routes
          below.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button type="button" onClick={reset} className="btn-primary font-dm">
            <RotateCcw size={16} aria-hidden="true" /> Try again
          </button>
          <Link href="/" prefetch={false} className="btn-ghost font-dm">
            Back to the homepage <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-12 grid gap-3 border-t border-b1 pt-8 font-dm text-sm leading-relaxed text-t2 sm:grid-cols-2">
          <p>
            Planning a project? The{" "}
            <Link href="/quote" prefetch={false} className="font-semibold text-t1 underline underline-offset-4 hover:text-acc">
              project brief
            </Link>{" "}
            and{" "}
            <Link href="/contact" prefetch={false} className="font-semibold text-t1 underline underline-offset-4 hover:text-acc">
              contact routes
            </Link>{" "}
            are separate pages and should still work.
          </p>
          <p>
            Still stuck? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-t1 underline underline-offset-4 hover:text-acc">
              {CONTACT_EMAIL}
            </a>
            {error.digest ? (
              <>
                {" "}and quote reference <code className="rounded bg-s2 px-1.5 py-0.5 text-xs text-t1">{error.digest}</code>
              </>
            ) : null}
            .
          </p>
        </div>
      </div>
    </div>
  )
}
