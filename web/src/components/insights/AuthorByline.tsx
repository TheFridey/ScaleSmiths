import Image from "next/image"
import Link from "next/link"
import { founderProfileHref, type Founder } from "@/lib/founders"
import { teamImages } from "@/lib/team-images"
import { cn } from "@/lib/utils"

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" })

export function formatInsightDate(iso: string) {
  return dateFormat.format(new Date(`${iso}T00:00:00Z`))
}

/** A real founder photo when supplied; otherwise the founder's monogram. Never a stock avatar. */
export function AuthorAvatar({ founder, size = 48, className }: { founder: Founder; size?: number; className?: string }) {
  const photo = teamImages[founder.photo]
  return (
    <span className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-b2 bg-s2", className)} style={{ width: size, height: size }}>
      {photo.available ? (
        <Image src={photo.src} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="font-syne font-black" style={{ color: founder.accent, fontSize: Math.round(size * (founder.monogram.length > 1 ? 0.28 : 0.42)) }}>
          {founder.monogram}
        </span>
      )}
    </span>
  )
}

interface AuthorBylineProps {
  founder: Founder
  datePublished?: string
  dateModified?: string
  readingMinutes: number
}

export function AuthorByline({ founder, datePublished, dateModified, readingMinutes }: AuthorBylineProps) {
  const updated = dateModified && dateModified !== datePublished ? dateModified : undefined
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <div className="flex items-center gap-3">
        <AuthorAvatar founder={founder} />
        <div>
          <p className="font-dm text-sm text-t2">
            Written by{" "}
            <Link href={founderProfileHref(founder)} prefetch={false} rel="author" className="font-semibold text-t1 underline-offset-4 hover:underline">
              {founder.name}
            </Link>
          </p>
          <p className="font-dm text-xs text-t3">{founder.authorTitle}, ScaleSmiths</p>
        </div>
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-1 font-dm text-xs text-t3">
        {datePublished ? (
          <div className="flex gap-1.5"><dt>Published</dt><dd><time dateTime={datePublished} className="text-t2">{formatInsightDate(datePublished)}</time></dd></div>
        ) : null}
        {updated ? (
          <div className="flex gap-1.5"><dt>Updated</dt><dd><time dateTime={updated} className="text-t2">{formatInsightDate(updated)}</time></dd></div>
        ) : null}
        <div className="flex gap-1.5"><dt className="sr-only">Reading time</dt><dd className="text-t2">{readingMinutes} min read</dd></div>
      </dl>
    </div>
  )
}

/** End-of-article author box linking to the founder profile. */
export function AuthorCard({ founder }: { founder: Founder }) {
  return (
    <aside aria-label={`About the author, ${founder.name}`} className="rounded-2xl border border-b1 bg-s1 p-6 md:p-7">
      <div className="flex items-center gap-4">
        <AuthorAvatar founder={founder} size={64} />
        <div>
          <p className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">About the author</p>
          <p className="mt-1 font-syne text-xl font-bold">{founder.name}</p>
          <p className="font-dm text-sm text-acc">{founder.authorTitle}, ScaleSmiths</p>
        </div>
      </div>
      <p className="mt-5 font-dm text-sm leading-relaxed text-t2">{founder.summary.text}</p>
      <Link href={founderProfileHref(founder)} prefetch={false} className="mt-5 inline-flex font-dm text-sm font-semibold text-t1 underline-offset-4 hover:underline">
        Read {founder.firstName}&apos;s profile
      </Link>
    </aside>
  )
}
