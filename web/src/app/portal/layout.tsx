import type { Metadata } from "next"
import type { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getClientSessionFromCookies } from "@/lib/portal-session"

// Client portal pages are private account surfaces and must never appear in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function PortalLayout({ children }: { children: ReactNode }) {
  // x-pathname is set in web/src/middleware.ts; keep that middleware matcher as "/portal/:path*".
  const headerStore = await headers()
  const pathname = headerStore.get("x-pathname") ?? ""
  const session = await getClientSessionFromCookies()
  const isPublicPortalPath =
    pathname.startsWith("/portal/login") ||
    pathname.startsWith("/portal/activate") ||
    pathname.startsWith("/portal/api/")

  if (pathname === "/portal") {
    redirect(session ? `/portal/${session.clientId}` : "/portal/login")
  }

  if (!isPublicPortalPath && !session) {
    redirect("/portal/login")
  }

  if (!isPublicPortalPath && session && pathname.startsWith("/portal/")) {
    const clientId = pathname.split("/")[2]
    if (clientId && clientId !== session.clientId) {
      redirect(`/portal/${session.clientId}`)
    }
  }

  return children
}
