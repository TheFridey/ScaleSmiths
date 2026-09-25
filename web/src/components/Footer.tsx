import Link from "next/link"
import { Logo } from "./Logo"
import { CookieSettingsButton } from "./CookieSettingsButton"
import {
  BUSINESS_LOCATION,
  CONTACT_EMAIL,
  SERVICE_AREA_STATEMENT,
  SITE_NAME,
  founderProfilePath,
  organizationProfiles,
} from "@/lib/site-identity"

const navigationGroups = [
  {
    label: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: founderProfilePath("rhys"), label: "Rhys" },
      { href: founderProfilePath("trevor-newton-bradley"), label: "Trevor Newton-Bradley" },
      { href: "/work", label: "Work" },
      { href: "/locations", label: "Locations" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    label: "Services",
    links: [
      { href: "/services", label: "Services" },
      { href: "/local-growth", label: "Local Growth" },
      { href: "/custom-systems", label: "Custom Systems" },
      { href: "/web-design-nottingham", label: "Web Design Nottingham" },
      { href: "/local-seo-nottingham", label: "Local SEO Nottingham" },
      { href: "/managed-website-hosting", label: "Managed Hosting" },
      { href: "/services/managed-business-email", label: "Managed Business Email" },
    ],
  },
  {
    label: "Find & grow",
    links: [
      { href: "/services/business-growth-audit", label: "Business Growth Audit" },
      { href: "/digital-growth-partnership", label: "Digital Growth Partnership" },
      { href: "/seo-website-audit", label: "SEO Website Audit" },
      { href: "/quote", label: "Start a Project" },
    ],
  },
]

const legalLinks = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/website-terms", label: "Terms" },
  { href: "/legal/cookies", label: "Cookie Policy" },
  { href: "/legal", label: "Legal" },
]

export function Footer() {
  const profiles = organizationProfiles()

  return (
    <footer className="relative overflow-hidden border-t border-b1 bg-[#050d17] px-6 pb-8 pt-14 sm:pb-28 md:px-12 md:pt-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-acc/40 to-transparent"
      />
      <div className="relative mx-auto max-w-[1240px]">
        <div className="grid gap-12 pb-14 md:grid-cols-[minmax(260px,1fr)_minmax(420px,1.6fr)] md:gap-16 md:pb-16">
          <div>
            <Logo size={42} className="max-w-full [&_img]:max-w-full" />
            <p className="mt-5 max-w-[360px] font-dm text-sm leading-relaxed text-t2">Founder-led business growth and engineering for ambitious organisations.</p>
            <address className="mt-6 grid gap-1 font-dm text-sm not-italic leading-relaxed text-t2">
              <span className="font-semibold text-t1">{SITE_NAME}</span>
              <span>{BUSINESS_LOCATION.locality}, {BUSINESS_LOCATION.region}</span>
              <span>{SERVICE_AREA_STATEMENT}</span>
              <a href={`mailto:${CONTACT_EMAIL}`} className="footer-link mt-2 inline-flex min-h-6 w-fit items-center">{CONTACT_EMAIL}</a>
            </address>
            {profiles.length > 0 ? (
              <ul aria-label="ScaleSmiths profiles" className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                {profiles.map((profile) => (
                  <li key={profile.href}>
                    <a href={profile.href} target="_blank" rel="noopener noreferrer" className="footer-link inline-flex min-h-6 items-center font-dm text-sm text-t2">{profile.label}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <nav aria-label="Footer navigation" className="grid gap-9 sm:grid-cols-3 sm:gap-6">
            {navigationGroups.map((group) => (
              <div key={group.label}>
                <p className="font-dm text-[11px] font-semibold uppercase tracking-[.16em] text-t3">{group.label}</p>
                <ul className="mt-4 grid gap-3">
                  {group.links.map((link) => <li key={link.href}><Link href={link.href} prefetch={false} className="footer-link inline-flex min-h-6 items-center font-dm text-sm text-t2">{link.label}</Link></li>)}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="grid gap-5 border-t border-b1 pt-7 font-dm text-xs text-t3 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-8">
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {legalLinks.map((link) => <Link key={link.href} href={link.href} className="footer-link inline-flex min-h-6 items-center">{link.label}</Link>)}
            <CookieSettingsButton />
          </div>
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        </div>
      </div>
    </footer>
  )
}
