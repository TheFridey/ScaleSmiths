import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Check, Mail, MonitorSmartphone, ShieldCheck, Wrench } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { FAQ } from "@/components/FAQ"
import { buildManagedBusinessEmailSchema, managedBusinessEmail, managedBusinessEmailPriceLabel } from "@/lib/managed-business-email"

export const metadata: Metadata = {
  title: "Managed Business Email",
  description: "Professional custom-domain business email configured, authenticated and supported by ScaleSmiths. Three 5GB mailboxes from £15, with initial setup included.",
  alternates: { canonical: managedBusinessEmail.slug },
  openGraph: {
    title: "ScaleSmiths Managed Business Email",
    description: "Professional email on your domain, configured properly and managed for you.",
    url: managedBusinessEmail.slug,
  },
}

export default function ManagedBusinessEmailPage() {
  const schema = buildManagedBusinessEmailSchema(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk")
  const spec = managedBusinessEmail.standalone
  return (
    <>
      {schema.map((item, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }} />)}
      <main>
        <section className="px-6 py-20 md:px-12 md:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <AnimateIn>
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-acc">Managed Business Email</span>
              <h1 className="mt-4 max-w-[850px] font-syne text-[clamp(44px,7vw,88px)] font-extrabold leading-[.92] tracking-[-.045em]">Professional email.<br />Your domain.<br />Managed properly.</h1>
              <p className="mt-7 max-w-[680px] text-lg leading-relaxed text-t2">A professional identity, correct technical configuration and a real team to help when something changes. ScaleSmiths handles the setup so you can get on with running the business.</p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href={managedBusinessEmail.onboardingPath} className="btn-primary">Set up my email <ArrowRight size={16} aria-hidden="true" /></Link>
                <span className="text-sm text-t2">Initial setup included. No separate setup fee.</span>
              </div>
            </AnimateIn>
            <AnimateIn delay={0.08} className="rounded-3xl border border-acc/20 bg-s1 p-7 md:p-9">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Starting service</p>
              <div className="mt-4 font-syne text-6xl font-extrabold">{managedBusinessEmailPriceLabel()}</div>
              <p className="mt-2 text-sm text-t3">Billing cadence confirmed during onboarding</p>
              <div className="mt-7 grid grid-cols-2 gap-4 border-y border-b1 py-6">
                <Spec value={String(spec.mailboxes)} label="professional mailboxes" />
                <Spec value={`${spec.storagePerMailboxGb}GB`} label="per mailbox" />
              </div>
              <ul className="mt-6 space-y-3 text-sm text-t2">
                {["Custom business domain", "Free initial DNS and email setup", "Ongoing technical support"].map((item) => <li key={item} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-acc" aria-hidden="true" />{item}</li>)}
              </ul>
            </AnimateIn>
          </div>
        </section>

        <section className="border-y border-b1 bg-s1 px-6 py-20 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <AnimateIn className="max-w-[760px]"><span className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Your address is part of your brand</span><h2 className="mt-3 font-syne text-[clamp(34px,5vw,58px)] font-extrabold">hello@yourbusiness.co.uk</h2><p className="mt-4 text-lg leading-relaxed text-t2">Choose three addresses that fit how the business works—perhaps hello@, name@, sales@, accounts@, bookings@ or support@.</p></AnimateIn>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl bg-b1 sm:grid-cols-2 lg:grid-cols-3">
              {managedBusinessEmail.features.map((feature) => <div key={feature} className="flex min-h-24 items-center gap-3 bg-bg p-5 text-sm text-t2"><Check size={16} className="shrink-0 text-acc" aria-hidden="true" />{feature}</div>)}
            </div>
          </div>
        </section>

        <section className="px-6 py-24 md:px-12">
          <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <AnimateIn><span className="text-xs font-semibold uppercase tracking-[.14em] text-acc">We handle the technical side</span><h2 className="mt-3 font-syne text-[clamp(34px,5vw,58px)] font-extrabold leading-tight">You should not need to understand email records to have professional email.</h2><p className="mt-5 leading-relaxed text-t2">Give ScaleSmiths appropriate access to wherever your domain&apos;s DNS is managed. Where supported, scoped or delegated access is preferred. We configure the mail records, authentication and initial mailboxes without asking you to paste credentials into a public form.</p></AnimateIn>
            <AnimateIn delay={0.08} className="rounded-3xl border border-b1 bg-s1 p-6 md:p-9">
              <div className="grid gap-4 sm:grid-cols-3">
                <Flow Icon={Mail} title="Your domain" copy="The address customers recognise." />
                <Flow Icon={Wrench} title="ScaleSmiths setup" copy="MX, SPF, DKIM and DMARC configured." />
                <Flow Icon={ShieldCheck} title="Managed email" copy="Authenticated, supported and ready for your team." />
              </div>
            </AnimateIn>
          </div>
        </section>

        <section className="bg-s1 px-6 py-24 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <AnimateIn className="max-w-[760px]"><span className="text-xs font-semibold uppercase tracking-[.14em] text-acc">A straightforward start</span><h2 className="mt-3 font-syne text-5xl font-extrabold">Setup is included.</h2><p className="mt-5 text-lg leading-relaxed text-t2">No separate setup fee. Migration from an existing provider is assessed separately because every provider and mailbox history is different.</p></AnimateIn>
            <ol className="mt-12 grid gap-4 md:grid-cols-4">
              {[['01','Choose your addresses','Tell us the domain and three mailbox names you need.'],['02','Arrange DNS access','We agree appropriate access through the onboarding process—never through this public form.'],['03','We configure it','ScaleSmiths sets up the required records, authentication and mailboxes.'],['04','Start using email','Use supported webmail, desktop or mobile clients with the access information provided.']].map(([number,title,copy]) => <li key={number} className="border-t border-acc/40 pt-5"><span className="text-xs font-semibold text-acc">{number}</span><h3 className="mt-3 font-syne text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-t2">{copy}</p></li>)}
            </ol>
            <div className="mt-14 flex flex-col justify-between gap-6 rounded-2xl border border-b1 bg-bg p-7 md:flex-row md:items-center"><div><h3 className="font-syne text-2xl font-bold">Works where your team works.</h3><p className="mt-2 text-sm text-t2">Compatible webmail plus common IMAP/SMTP-capable desktop and mobile email clients.</p></div><MonitorSmartphone size={32} className="text-acc" aria-hidden="true" /></div>
          </div>
        </section>

        <FAQ items={[...managedBusinessEmail.faq]} />

        <section className="px-6 pb-28 md:px-12">
          <div className="mx-auto max-w-[1240px] rounded-3xl border border-acc/20 bg-s1 p-8 md:p-12">
            <h2 className="font-syne text-[clamp(32px,5vw,56px)] font-extrabold">Ready for proper business email?</h2>
            <p className="mt-4 max-w-[680px] leading-relaxed text-t2">Start with three 5GB custom-domain mailboxes from £15. Setup is included, and you do not need to buy a website from ScaleSmiths.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href={managedBusinessEmail.onboardingPath} className="btn-primary">Get business email <ArrowRight size={16} /></Link><Link href="/services" className="btn-ghost">Explore the wider digital estate</Link></div>
          </div>
        </section>
      </main>
    </>
  )
}

function Spec({ value, label }: { value: string; label: string }) { return <div><div className="font-syne text-2xl font-bold">{value}</div><div className="mt-1 text-xs text-t3">{label}</div></div> }
function Flow({ Icon, title, copy }: { Icon: typeof Mail; title: string; copy: string }) { return <div className="relative rounded-2xl border border-b1 bg-bg p-5"><Icon size={19} className="text-acc" aria-hidden="true" /><h3 className="mt-5 font-syne text-lg font-bold">{title}</h3><p className="mt-2 text-xs leading-relaxed text-t2">{copy}</p></div> }
