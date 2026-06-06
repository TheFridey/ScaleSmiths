import Link from "next/link"
import Image from "next/image"
import { ArrowUpRight, ArrowRight } from "lucide-react"
import { AnimateIn, GSAPReveal } from "./AnimateIn"
import { projects } from "@/lib/data"

interface PortfolioProps {
  limit?: number
  showHeading?: boolean
}

export function Portfolio({ limit, showHeading = true }: PortfolioProps) {
  const shown = limit ? projects.slice(0, limit) : projects
  return (
    <section aria-label="Portfolio" className="px-6 md:px-12 py-20">
      <div className="max-w-[1240px] mx-auto">
        {showHeading && (
          <AnimateIn className="flex justify-between items-end mb-12">
            <div>
              <span className="font-dm text-xs text-acc tracking-[.14em] font-semibold uppercase">Our Work</span>
              <h2 className="font-syne text-[clamp(28px,4.5vw,46px)] font-extrabold tracking-[-0.025em] mt-2">
                Selected projects.
              </h2>
            </div>
            {limit && (
              <Link
                href="/work"
                prefetch={false}
                className="hidden md:flex items-center gap-1.5 border border-b2 text-t2 hover:text-t1 transition-colors px-5 py-2.5 rounded-lg font-dm text-sm font-medium"
              >
                View all <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </AnimateIn>
        )}

        <GSAPReveal className="grid md:grid-cols-2 gap-3" stagger={0.08}>
          {shown.map((p, index) => (
            <Link
              key={p.id}
              href={`/work/${p.slug}`}
              prefetch={false}
              className="card-lift group bg-s1 border border-b1 rounded-2xl p-8 block"
              aria-label={`View ${p.name} case study`}
            >
              {p.thumbImage ? (
                <div className="relative mb-7 aspect-[16/10] overflow-hidden rounded-xl border border-b1 bg-s2">
                  <Image
                    src={p.thumbImage}
                    alt={`${p.name} project preview`}
                    fill
                    sizes="(min-width: 768px) 50vw, 100vw"
                    priority={index < 2}
                    placeholder={p.blurDataURL ? "blur" : "empty"}
                    blurDataURL={p.blurDataURL}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-20"
                    style={{ background: `linear-gradient(0deg, ${p.accentColor}44, transparent)` }}
                    aria-hidden="true"
                  />
                </div>
              ) : (
                <div
                  className="h-1 rounded-sm mb-7 transition-opacity duration-300 opacity-30 group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, ${p.accentColor}, transparent)` }}
                  aria-hidden="true"
                />
              )}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-syne text-xl font-bold">{p.name}</h3>
                  <div className="font-dm text-sm text-t2 mt-1">{p.type}</div>
                </div>
                <ArrowUpRight
                  size={18}
                  className="text-t3 group-hover:text-acc transition-colors mt-0.5"
                  aria-hidden="true"
                />
              </div>
              <p className="font-dm text-sm text-t2 leading-relaxed mb-5 line-clamp-3">
                {p.headline}
              </p>
              <ul className="flex flex-wrap gap-1.5" aria-label="Technologies">
                {p.tags.map((tag) => (
                  <li
                    key={tag}
                    className="font-dm text-[11px] text-t2 bg-s2 border border-b1 px-[9px] py-[3px] rounded tracking-[.03em]"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </GSAPReveal>
      </div>
    </section>
  )
}
