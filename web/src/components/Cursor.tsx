"use client"

import { useEffect, useRef, useState } from "react"

const LERP = 0.12

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: -100, y: -100 })
  const ring = useRef({ x: -100, y: -100 })
  const hover = useRef({ scale: 1, rotate: 0, dotOpacity: 1 })
  const frame = useRef(0)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const canUseCursor = !window.matchMedia("(pointer:coarse)").matches
    setEnabled(canUseCursor)

    if (!canUseCursor) return

    document.documentElement.classList.add("custom-cursor-enabled")

    const updateHover = (eventTarget: EventTarget | null) => {
      const el = eventTarget instanceof Element ? eventTarget : null
      const onCard = Boolean(el?.closest(".card-lift"))
      const onInteractive = Boolean(el?.closest('a, button, [role="button"]'))

      hover.current = {
        scale: onCard ? 2.2 : onInteractive ? 1.8 : 1,
        rotate: onCard ? 45 : 0,
        dotOpacity: onInteractive ? 0 : 1,
      }
    }

    const onMove = (event: MouseEvent) => {
      target.current = { x: event.clientX, y: event.clientY }

      if (dotRef.current) {
        dotRef.current.style.opacity = String(hover.current.dotOpacity)
        dotRef.current.style.transform = `translate3d(${event.clientX - 4}px, ${event.clientY - 4}px, 0)`
      }

      updateHover(event.target)
    }

    const onLeaveWindow = () => {
      if (dotRef.current) dotRef.current.style.opacity = "0"
      if (ringRef.current) ringRef.current.style.opacity = "0"
    }

    const onEnterWindow = () => {
      if (dotRef.current) dotRef.current.style.opacity = String(hover.current.dotOpacity)
      if (ringRef.current) ringRef.current.style.opacity = "1"
    }

    const animate = () => {
      ring.current.x += (target.current.x - ring.current.x) * LERP
      ring.current.y += (target.current.y - ring.current.y) * LERP

      if (ringRef.current) {
        const { scale, rotate } = hover.current
        ringRef.current.style.transform =
          `translate3d(${ring.current.x - 18}px, ${ring.current.y - 18}px, 0) scale(${scale}) rotate(${rotate}deg)`
      }

      frame.current = requestAnimationFrame(animate)
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    document.addEventListener("mouseleave", onLeaveWindow)
    document.addEventListener("mouseenter", onEnterWindow)
    frame.current = requestAnimationFrame(animate)

    return () => {
      document.documentElement.classList.remove("custom-cursor-enabled")
      window.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseleave", onLeaveWindow)
      document.removeEventListener("mouseenter", onEnterWindow)
      cancelAnimationFrame(frame.current)
    }
  }, [])

  if (!enabled) return null

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="fixed left-0 top-0 z-[250] h-2 w-2 rounded-full pointer-events-none transition-opacity duration-150"
        style={{ backgroundColor: "var(--acc)", transform: "translate3d(-100px, -100px, 0)" }}
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="fixed left-0 top-0 z-[249] h-9 w-9 rounded-full pointer-events-none will-change-transform"
        style={{
          border: "1.5px solid rgba(37,99,235,0.4)",
          transform: "translate3d(-100px, -100px, 0)",
        }}
      />
    </>
  )
}
