import type { NextAuthConfig } from "next-auth"

const secureCookies = process.env.NODE_ENV === "production"

export const authConfig = {
  trustHost: true,
  useSecureCookies: secureCookies,
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
  jwt: {
    maxAge: 8 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: secureCookies ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: secureCookies,
        maxAge: 8 * 60 * 60,
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.sessionVersion = user.sessionVersion
        token.active = user.active
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ""
        session.user.role = token.role ?? "viewer"
        session.user.sessionVersion = token.sessionVersion ?? 0
        session.user.active = token.active !== false && token.accessRevoked !== true
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
