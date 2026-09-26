"use client"

import { useEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"

/**
 * Full-bleed forge hero video. Plays muted/looped under a dark wash so type
 * stays readable. Falls back silently when the asset is missing or motion is reduced.
 */
export function HeroForgeVideo() {
  const reducedMotion = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (reducedMotion) return
    const video = videoRef.current
    if (!video) return

    const tryPlay = () => {
      void video.play().then(() => setReady(true)).catch(() => {
        // Autoplay blocked or asset missing — keep poster atmosphere only.
        setReady(false)
      })
    }

    if (video.readyState >= 2) tryPlay()
    else video.addEventListener("loadeddata", tryPlay, { once: true })

    return () => {
      video.removeEventListener("loadeddata", tryPlay)
    }
  }, [reducedMotion])

  if (reducedMotion) return null

  return (
    <div
      className={`hero-forge-video pointer-events-none absolute inset-0 z-[1] overflow-hidden transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-[0.38] md:opacity-[0.42]"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/brand/scalesmiths-forge-atmosphere.webp"
      >
        <source src="/brand/scalesmiths-hero-forge.webm" type="video/webm" />
      </video>
      {/* Extra fade so the footage stays atmospheric, not bright */}
      <div className="hero-forge-video-wash absolute inset-0" />
    </div>
  )
}
