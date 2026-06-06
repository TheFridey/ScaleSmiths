import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  trustHost: true,
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : "scalesmiths-admin-dev-secret-change-me"),
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  providers: [],
} satisfies NextAuthConfig
