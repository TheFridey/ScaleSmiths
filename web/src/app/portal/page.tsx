import { redirect } from "next/navigation"
import { getClientSessionFromCookies } from "@/lib/portal-session"

/** Bare `/portal` has no page of its own; send clients to login or their workspace. */
export default async function PortalIndexPage() {
  const session = await getClientSessionFromCookies()
  redirect(session ? `/portal/${session.clientId}` : "/portal/login")
}
