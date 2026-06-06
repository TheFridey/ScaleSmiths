import type { Metadata } from "next"
import { notFound }  from "next/navigation"
import Image         from "next/image"
import Link          from "next/link"
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { CTA }       from "@/components/CTA"
import { Project, projects }  from "@/lib/data"
import { buildLogs, getBuildLog, type BuildLog } from "@/lib/build-logs"

interface Props { params: Promise<{ slug: string }> }

function ProjectShowcase({ project }: { project: Project }) {
  const hasScreenshots = Boolean(project.screenshots?.length)

  return (
    <AnimateIn delay={0.12} className="mb-20">
      <div
        className="relative aspect-video overflow-hidden rounded-2xl border border-b1 bg-s1"
        style={{
          backgroundImage: `
            radial-gradient(circle at 18% 16%, ${project.accentColor}33, transparent 28%),
            radial-gradient(circle at 82% 24%, ${project.accentColor}22, transparent 24%),
            radial-gradient(circle at 48% 88%, ${project.accentColor}26, transparent 34%),
            linear-gradient(135deg, rgba(255,255,255,0.055), rgba(255,255,255,0.01) 44%, rgba(0,0,0,0.22))
          `,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-28"
          style={{ background: `linear-gradient(180deg, ${project.accentColor}22, transparent)` }}
          aria-hidden="true"
        />

        {project.heroImage ? (
          <div className="relative z-10 h-full">
            <Image
              src={project.heroImage}
              alt={`${project.name} project showcase`}
              fill
              sizes="(min-width: 768px) 90vw, 100vw"
              priority
              placeholder={project.blurDataURL ? "blur" : "empty"}
              blurDataURL={project.blurDataURL}
              className="object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/5"
              aria-hidden="true"
            />
            <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/30 px-3 py-1 font-dm text-xs font-semibold text-white/80 backdrop-blur md:left-8 md:top-8">
              {project.name}
            </span>
          </div>
        ) : hasScreenshots ? (
          <div className="relative z-10 grid h-full gap-4 p-4 md:grid-cols-[1.45fr_0.8fr] md:p-8">
            {project.screenshots?.slice(0, 3).map((src, index) => (
              <div
                key={src}
                className={index === 0 ? "relative overflow-hidden rounded-xl border border-white/10 bg-black/20 md:row-span-2" : "relative overflow-hidden rounded-xl border border-white/10 bg-black/20"}
              >
                <Image
                  src={src}
                  alt={`${project.name} screenshot ${index + 1}`}
                  fill
                  sizes={index === 0 ? "(min-width: 768px) 60vw, 100vw" : "(min-width: 768px) 30vw, 100vw"}
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative z-10 flex h-full items-center justify-center p-5 md:p-10">
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
              <span className="font-syne text-[clamp(64px,15vw,190px)] font-extrabold leading-none tracking-[-0.05em] text-white opacity-[0.06]">
                {project.name}
              </span>
            </div>

            <div className="grid w-full max-w-[980px] grid-cols-[1fr_0.72fr] gap-4 md:gap-6">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/30 shadow-2xl backdrop-blur">
                <div className="flex h-9 items-center gap-2 border-b border-white/10 bg-white/[0.04] px-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-red/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amb/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-grn/80" />
                  <span className="ml-3 h-3 w-28 rounded-full bg-white/10" />
                </div>
                <div className="space-y-4 p-5">
                  <div className="h-5 w-36 rounded-full" style={{ background: project.accentColor }} />
                  <div className="grid grid-cols-3 gap-3">
                    {[0.7, 0.45, 0.58].map((opacity, index) => (
                      <div key={index} className="h-20 rounded-lg border border-white/10 bg-white/[0.035] p-3">
                        <div className="mb-4 h-2 w-12 rounded-full bg-white/15" />
                        <div className="h-6 rounded-md" style={{ background: `${project.accentColor}${Math.round(opacity * 255).toString(16).padStart(2, "0")}` }} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[1fr_0.55fr] gap-3">
                    <div className="h-28 rounded-lg border border-white/10 bg-white/[0.035] p-4">
                      <div className="mb-3 h-2 w-3/4 rounded-full bg-white/15" />
                      <div className="mb-2 h-2 w-1/2 rounded-full bg-white/10" />
                      <div className="h-12 rounded-md" style={{ background: `linear-gradient(90deg, ${project.accentColor}88, transparent)` }} />
                    </div>
                    <div className="h-28 rounded-lg border border-white/10 bg-white/[0.035] p-4">
                      <div className="mx-auto h-16 w-16 rounded-full border-[10px]" style={{ borderColor: `${project.accentColor}88` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="rounded-xl border border-white/10 bg-black/25 p-5 shadow-xl backdrop-blur">
                  <div className="mb-4 h-2 w-20 rounded-full bg-white/15" />
                  <div className="font-syne text-3xl font-extrabold" style={{ color: project.accentColor }}>
                    {project.year}
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/10" />
                  <div className="mt-2 h-2 w-2/3 rounded-full bg-white/10" />
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 p-5 shadow-xl backdrop-blur">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="h-2 w-24 rounded-full bg-white/15" />
                    <div className="h-8 w-8 rounded-lg" style={{ background: `${project.accentColor}55` }} />
                  </div>
                  <div className="space-y-2">
                    {[0.95, 0.72, 0.86, 0.62].map((width, index) => (
                      <div key={index} className="h-2 rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${width * 100}%`, background: project.accentColor }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hidden flex-1 rounded-xl border border-white/10 bg-black/25 p-5 shadow-xl backdrop-blur md:block">
                  <div className="mb-4 h-2 w-16 rounded-full bg-white/15" />
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 16 }).map((_, index) => (
                      <span
                        key={index}
                        className="aspect-square rounded"
                        style={{ background: index % 3 === 0 ? `${project.accentColor}77` : "rgba(255,255,255,0.08)" }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimateIn>
  )
}

export function generateStaticParams() {
  return [...buildLogs.map((log) => ({ slug: log.slug })), ...projects.map((p) => ({ slug: p.slug }))]
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const log = getBuildLog(slug)
  if (log) {
    return {
      title: log.title,
      description: log.summary,
      alternates: { canonical: `https://scalesmiths.io/work/${log.slug}` },
      openGraph: { title: log.title, description: log.summary },
    }
  }

  const p = projects.find((x) => x.slug === slug)
  if (!p) return {}
  return {
    title: p.name,
    description: p.headline,
    alternates: { canonical: `https://scalesmiths.io/work/${p.slug}` },
    openGraph: {
      title: p.name,
      description: p.headline,
      images: p.heroImage ? [{ url: p.heroImage }] : undefined,
    },
  }
}

function BuildLogPage({ log }: { log: BuildLog }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: log.title,
    description: log.summary,
    url: `https://scalesmiths.io/work/${log.slug}`,
    author: { "@type": "Organization", name: "ScaleSmiths" },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="mx-auto max-w-[1080px] px-6 pt-10 md:px-12">
        <Link href="/work" className="mb-12 inline-flex items-center gap-2 font-dm text-sm text-t2 transition-colors hover:text-t1">
          <ArrowLeft size={14} aria-hidden="true" /> Back to Work
        </Link>
        <AnimateIn>
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Build log</span>
          <h1 className="mt-3 font-syne text-[clamp(38px,7vw,76px)] font-extrabold leading-none tracking-[-0.03em]">
            {log.title}
          </h1>
          <p className="mt-6 max-w-[720px] font-dm text-lg leading-relaxed text-t2">{log.summary}</p>
          <div className="mt-7 flex flex-wrap gap-1.5">
            {log.tags.map((tag) => (
              <span key={tag} className="rounded border border-b1 bg-s2 px-2.5 py-1 font-dm text-[11px] text-t2">{tag}</span>
            ))}
          </div>
        </AnimateIn>

        <div className="my-16 grid gap-6 md:grid-cols-2">
          {[
            ["Problem", log.problem],
            ["Solution", log.solution],
            ["Business value", log.businessValue],
            ["Verifiable outcome", log.outcome],
          ].map(([title, copy]) => (
            <AnimateIn key={title} className="rounded-2xl border border-b1 bg-s1 p-6">
              <h2 className="font-syne text-xl font-bold">{title}</h2>
              <p className="mt-3 font-dm text-sm leading-relaxed text-t2">{copy}</p>
            </AnimateIn>
          ))}
        </div>

        <AnimateIn className="mb-20 rounded-2xl border border-b1 bg-s1 p-6">
          <h2 className="font-syne text-xl font-bold">Technical approach</h2>
          <ul className="mt-5 grid gap-3 md:grid-cols-2">
            {log.technicalApproach.map((item) => (
              <li key={item} className="flex items-center gap-2.5 font-dm text-sm text-t2">
                <CheckCircle2 size={15} className="shrink-0 text-grn" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </AnimateIn>
      </div>
      <CTA />
    </>
  )
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params
  const log = getBuildLog(slug)
  if (log) return <BuildLogPage log={log} />

  const p = projects.find((x) => x.slug === slug)
  if (!p) notFound()

  return (
    <>
      {/* Back link */}
      <div className="px-6 md:px-12 pt-10 max-w-[1240px] mx-auto">
        <Link href="/work" className="inline-flex items-center gap-2 font-dm text-sm text-t2 hover:text-t1 transition-colors mb-12">
          <ArrowLeft size={14} aria-hidden="true" /> Back to Work
        </Link>

        {/* Hero */}
        <AnimateIn>
          {/* Personal badge */}
          <div className="inline-flex items-center gap-2 bg-s2 border border-b2 rounded-full px-4 py-1.5 mb-6">
            <span className="font-dm text-xs text-t2 tracking-wider">
              {p.credit}
            </span>
          </div>

          <div className="flex items-start justify-between gap-8 mb-6">
            <div>
              <h1 className="font-syne text-[clamp(36px,6vw,68px)] font-extrabold tracking-[-0.025em] leading-none">
                {p.name}
              </h1>
              <div className="font-dm text-t2 text-lg mt-2">
                {p.type} · {p.location} · {p.year}
              </div>
            </div>
          </div>

          <p className="font-dm text-[clamp(16px,2vw,20px)] text-t2 leading-relaxed max-w-[680px]">
            {p.headline}
          </p>
        </AnimateIn>

        {/* Tag strip */}
        <AnimateIn delay={0.1} className="flex flex-wrap gap-2 mt-8 mb-16">
          {p.tags.map((tag) => (
            <span key={tag} className="font-dm text-xs text-t2 bg-s2 border border-b1 px-3 py-1.5 rounded-md tracking-[.03em]">
              {tag}
            </span>
          ))}
        </AnimateIn>

        <ProjectShowcase project={p} />

        {/* Body */}
        <div className="grid md:grid-cols-[1fr_320px] gap-14 mb-24">
          {/* Main content */}
          <div>
            <AnimateIn className="mb-12">
              <h2 className="font-syne text-2xl font-bold mb-4 text-t1">The Challenge</h2>
              <p className="font-dm text-base text-t2 leading-relaxed">{p.challenge}</p>
            </AnimateIn>

            <AnimateIn delay={0.05} className="mb-12">
              <h2 className="font-syne text-2xl font-bold mb-4 text-t1">The Solution</h2>
              <p className="font-dm text-base text-t2 leading-relaxed">{p.solution}</p>
            </AnimateIn>

            <AnimateIn delay={0.1}>
              <h2 className="font-syne text-2xl font-bold mb-5 text-t1">Outcomes</h2>
              <ul className="flex flex-col gap-3">
                {p.outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" aria-hidden="true" />
                    <span className="font-dm text-base text-t1">{o}</span>
                  </li>
                ))}
              </ul>
            </AnimateIn>
          </div>

          {/* Sidebar */}
          <aside>
            <AnimateIn delay={0.15} className="bg-s1 border border-b1 rounded-2xl p-6 sticky top-24">
              <h3 className="font-syne text-base font-bold mb-5">Key Features</h3>
              <ul className="flex flex-col gap-2.5 mb-7">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 font-dm text-sm text-t2">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: p.accentColor }}
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="border-t border-b1 pt-5">
                <div className="font-dm text-xs text-t2 mb-1">Project Type</div>
                <div className="font-syne text-sm font-semibold">{p.type}</div>
              </div>
              <div className="mt-4">
                <div className="font-dm text-xs text-t2 mb-1">Location</div>
                <div className="font-syne text-sm font-semibold">{p.location}</div>
              </div>
              <div className="mt-4">
                <div className="font-dm text-xs text-t2 mb-1">Year</div>
                <div className="font-syne text-sm font-semibold">{p.year}</div>
              </div>
              <Link
                href="/quote"
                className="btn-primary mt-7 w-full justify-center font-dm text-sm"
              >
                Start a Similar Project
              </Link>
              {p.repoUrl && (
                <Link
                  href={p.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-b2 text-t2 hover:text-t1 transition-colors px-5 py-2.5 rounded-lg font-dm text-sm font-medium"
                >
                  View Repository <ExternalLink size={14} aria-hidden="true" />
                </Link>
              )}
            </AnimateIn>
          </aside>
        </div>
      </div>
      <CTA />
    </>
  )
}
