import Link from "next/link"
import { ArrowRight, ExternalLink } from "lucide-react"
import {
  founderFocusAreas,
  founderLinks,
  founderProjects,
  type Founder,
} from "@/lib/founders"

/**
 * Premium typographic/monogram presentation — deliberately no stock portraits.
 * When a real founder photograph is confirmed, replace the monogram block only.
 */
function Monogram({ founder }: { founder: Founder }) {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-b2 bg-s2 md:h-28 md:w-28"
      style={{
        backgroundImage: `radial-gradient(circle at 28% 22%, ${founder.accent}33, transparent 62%), linear-gradient(140deg, rgba(255,255,255,.06), rgba(0,0,0,.28))`,
      }}
    >
      <span
        className="font-syne text-[clamp(28px,6vw,38px)] font-black leading-none tracking-[-.04em]"
        style={{ color: founder.accent }}
      >
        {founder.monogram}
      </span>
    </div>
  )
}

export function FounderCard({ founder }: { founder: Founder }) {
  const projects = founderProjects(founder)
  const focusAreas = founderFocusAreas(founder)
  const links = founderLinks(founder)
  const headingId = `founder-${founder.slug}`

  return (
    <article
      id={founder.slug}
      aria-labelledby={headingId}
      className="scroll-mt-24 rounded-2xl border border-b1 bg-s1 p-6 md:p-8"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Monogram founder={founder} />
        <div className="min-w-0">
          <h3 id={headingId} className="font-syne text-[clamp(24px,3.6vw,32px)] font-extrabold tracking-[-.03em]">
            {founder.name}
          </h3>
          <p className="mt-2 font-dm text-sm font-semibold text-acc">{founder.role.text}</p>
          <p className="mt-1 font-dm text-xs text-t3">Hucknall, Nottinghamshire</p>
        </div>
      </div>

      <section aria-label={`${founder.name} responsibilities`} className="mt-7 border-t border-b1 pt-6">
        <h4 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Responsibilities</h4>
        <ul className="mt-4 flex flex-col gap-3">
          {founder.responsibilities.map((item) => (
            <li key={item.text} className="flex gap-3 font-dm text-sm leading-relaxed text-t2">
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: founder.accent }}
                aria-hidden="true"
              />
              {item.text}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={`${founder.name} direct involvement`} className="mt-6">
        <h4 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Direct involvement</h4>
        {founder.involvement.map((item) => (
          <p key={item.text} className="mt-3 font-dm text-sm leading-relaxed text-t2">
            {item.text}
          </p>
        ))}
      </section>

      <section aria-label={`${founder.name} areas of focus`} className="mt-6">
        <h4 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">
          Areas of focus
        </h4>
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {focusAreas.map((area) => (
            <li key={area} className="rounded border border-b1 bg-s2 px-2.5 py-1 font-dm text-[11px] text-t2">
              {area}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={`Selected work by ${founder.name}`} className="mt-6">
        <h4 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Selected work</h4>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {projects.map((project) => (
            <li key={project.slug}>
              <Link
                href={`/work/${project.slug}`}
                prefetch={false}
                className="flex h-full flex-col rounded-xl border border-b1 bg-bg/60 p-4 transition-colors hover:border-b2"
              >
                <span className="font-dm text-[11px] font-semibold uppercase tracking-[.1em] text-acc">
                  {project.type}
                </span>
                <span className="mt-1.5 font-syne text-base font-bold">{project.name}</span>
                <span className="mt-1 font-dm text-xs text-t3">
                  {project.location} · {project.year}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/work"
          prefetch={false}
          className="mt-4 inline-flex items-center gap-2 font-dm text-sm font-semibold text-acc"
        >
          See the full portfolio
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </section>

      {links.length > 0 && (
        <section aria-label={`Contact ${founder.name}`} className="mt-6">
          <h4 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Contact</h4>
          <ul className="mt-4 flex flex-wrap gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  {...(link.href.startsWith("https:") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="inline-flex items-center gap-2 rounded-lg border border-b2 px-4 py-2 font-dm text-sm font-medium text-t2 transition-colors hover:border-b3 hover:text-t1"
                >
                  {link.label}
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

    </article>
  )
}
