import Link from "next/link"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ShieldCheck } from "lucide-react"
import { FoundingPartnerBadge } from "@/components/partners/FoundingPartnerBadge"
import { getPublicPartnerProfile } from "@/lib/partner-profile-public.server"

// Request-time only: a removal, partner revocation or recognition change must be visible on the next request, never from a stored shell.
export const dynamic = "force-dynamic"
export const revalidate = 0

// Never indexed: these are individual, founder-approved pages, not marketing landing pages. Real partner pages remain a separate release gate.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const profile = await getPublicPartnerProfile((await params).slug)
  return { title: profile ? `${profile.displayName} | ScaleSmiths partner` : "Partner not found", robots: { index: false, follow: false, nocache: true } }
}

export default async function PartnerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const profile = await getPublicPartnerProfile((await params).slug)
  if (!profile) notFound()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24" data-testid="partner-profile">
      <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#dbc18e]">Independent ScaleSmiths partner</p>
      <h1 className="mt-4 break-words font-syne text-4xl font-extrabold leading-tight md:text-5xl">{profile.displayName}</h1>
      <p className="mt-3 flex items-center gap-2 text-sm text-white/80"><ShieldCheck size={16} aria-hidden="true" /> Verified ScaleSmiths partner · {profile.operatingArea}</p>
      {profile.foundingPartnerSince ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-[#dbc18e]/30 p-6 text-center sm:flex-row sm:text-left">
          <FoundingPartnerBadge year={profile.foundingPartnerSince.slice(0, 4)} size={132} />
          <p className="text-sm text-white/80">Recognised by the ScaleSmiths founders as a Founding Partner. This is a recognition of contribution; it does not imply ownership, employment or any other status in ScaleSmiths.</p>
        </div>
      ) : null}
      <section className="mt-10" aria-labelledby="about"><h2 id="about" className="font-syne text-2xl font-bold">About</h2><p className="mt-3 whitespace-pre-line leading-relaxed text-white/85">{profile.biography}</p></section>
      {profile.achievements.length ? (
        <section className="mt-10" aria-labelledby="recognition"><h2 id="recognition" className="font-syne text-2xl font-bold">Recognition</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-white/85">{profile.achievements.map((item) => <li key={item}>{item}</li>)}</ul></section>
      ) : null}
      <section className="mt-10 rounded-2xl border border-white/15 p-6" aria-labelledby="enquire">
        <h2 id="enquire" className="font-syne text-2xl font-bold">Enquiries</h2>
        {profile.enquiryMode === "referral_code" && profile.referralCode ? (
          <p className="mt-3 text-white/85">Quote this partner reference when you <Link className="underline" href="/contact">contact ScaleSmiths</Link>: <code className="rounded bg-white/10 px-2 py-1">{profile.referralCode}</code></p>
        ) : (
          <p className="mt-3 text-white/85">All enquiries are handled by ScaleSmiths. <Link className="underline" href="/contact">Contact ScaleSmiths</Link> and mention {profile.displayName}.</p>
        )}
        <p className="mt-3 text-xs text-white/60">Partners are independent. Scope, pricing and delivery are agreed with ScaleSmiths, not with the partner.</p>
      </section>
    </main>
  )
}
