"use client"

import { useEffect } from "react"

/**
 * Marks <html data-scalesmiths-hydrated="true"> once React has hydrated the app.
 * The Next.js app router (an ancestor) patches window.history in its own effects,
 * which have run by the time this marker appears. Browser tests wait for this
 * signal before driving client-only behaviour such as history.pushState, matching
 * the public web app's convention.
 */
export function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.scalesmithsHydrated = "true"
    return () => {
      delete document.documentElement.dataset.scalesmithsHydrated
    }
  }, [])

  return null
}
