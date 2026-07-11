import "next-auth"
import "next-auth/jwt"
import type { AdminRole } from "@/lib/admin-users"

declare module "next-auth" {
  interface User { role: AdminRole; sessionVersion: number; active: boolean }
  interface Session { user: { id: string; email?: string | null; name?: string | null; role: AdminRole; sessionVersion: number; active: boolean } }
}
declare module "next-auth/jwt" {
  interface JWT { role?: AdminRole; sessionVersion?: number; active?: boolean; accessRevoked?: boolean }
}
