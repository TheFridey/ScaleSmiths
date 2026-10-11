"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"

const HERO_VIDEO_SRC = "/brand/scalesmiths-hero-forge.webm"
const HERO_VIDEO_POSTER = "/brand/scalesmiths-forge-atmosphere.webp"

/**
 * Full-bleed forge hero video. Plays muted/looped under a light wash so the
 * forge remains visible while type stays readable. Falls back silently when
 * the asset is missing or motion is reduced.
 *
 * Source attachment is deferred until the hero is on-screen and the browser is
 * idle so the poster atmosphere can paint first and transferred bytes stay off
 * the critical path.
 */
export function HeroForgeVideo() {
  const reducedMotion = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (reducedMotion) return
    const node = containerRef.current
    if (!node) return

    let cancelled = false
    let idleHandle: number | undefined
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    const startLoad = () => {
      if (!cancelled) setShouldLoad(true)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        if ("requestIdleCallback" in window) {
          idleHandle = window.requestIdleCallback(startLoad, { timeout: 1_200 })
        } else {
          timeoutHandle = setTimeout(startLoad, 200)
        }
      },
      { threshold: 0.01 },
    )
    observer.observe(node)

    return () => {
      cancelled = true
      observer.disconnect()
      if (idleHandle !== undefined && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    }
  }, [reducedMotion])

  useEffect(() => {
    if (!shouldLoad || reducedMotion) return
    const video = videoRef.current
    if (!video) return

    const tryPlay = () => {
      void video.play().then(() => setReady(true)).catch(() => {
        // Autoplay blocked or asset missing, keep poster atmosphere only.
        setReady(false)
      })
    }

    video.addEventListener("loadeddata", tryPlay, { once: true })
    // Source is mounted after first paint; force the element to pick it up.
    video.load()

    return () => {
      video.removeEventListener("loadeddata", tryPlay)
    }
  }, [shouldLoad, reducedMotion])

  if (reducedMotion) return null

  return (
    <div
      ref={containerRef}
      className={`hero-forge-video pointer-events-none absolute inset-0 z-[1] overflow-hidden transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="hero-forge-video-media absolute inset-0 h-full w-full scale-105 object-cover opacity-[0.62] md:opacity-[0.72]"
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        poster={HERO_VIDEO_POSTER}
      >
        {shouldLoad ? <source src={HERO_VIDEO_SRC} type="video/webm" /> : null}
      </video>
      {/* Soft wash: keep type readable without muting the forge footage */}
      <div className="hero-forge-video-wash absolute inset-0" />
    </div>
  )
}
